import test from 'node:test';
import assert from 'node:assert/strict';
import {demoData, getData, getYears, readConfig} from '../js/data.js';

test('sin servicio configurado no se consultan datos ni se activa una demostración', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No se esperaba una solicitud'); };
  try { await assert.rejects(getData({}, 2026), /pendiente de configuración/); assert.equal(calls, 0); }
  finally { globalThis.fetch = original; }
});
test('la caché se separa por ejercicio y actualizar omite la caché', async () => {
  const original = globalThis.fetch, urls = [];
  globalThis.fetch = async url => { const parsed = new URL(url); urls.push(parsed); return {ok: true, json: async () => demoData(Number(parsed.searchParams.get('year')))}; };
  const config = {apiUrl: 'https://example.org/test-cache'};
  try {
    await getData(config, 2026); await getData(config, 2026); await getData(config, 2025); await getData(config, 2026, {force: true});
    assert.equal(urls.length, 3); assert.deepEqual(urls.map(url => url.searchParams.get('year')), ['2026', '2025', '2026']);
    assert.equal(urls.at(-1).searchParams.get('refresh'), '1');
  } finally { globalThis.fetch = original; }
});
test('la API debe devolver ejercicio y campos correctos antes de guardar datos', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ok: true, json: async () => demoData(2025)});
  try { await assert.rejects(getData({apiUrl: 'https://example.org/test-contract'}, 2026), /contrato/); }
  finally { globalThis.fetch = original; }
});
test('el transporte conserva el texto visible original en importes y fechas', async () => {
  const original = globalThis.fetch;
  const data = demoData(2026);
  data.rows[0].values[5] = '0007'; data.rows[0].display[5] = '0007';
  data.rows[0].values[6] = 'SIN IMPORTE'; data.rows[0].display[6] = 'SIN IMPORTE';
  data.rows[0].values[3] = 'PENDIENTE'; data.rows[0].display[3] = 'PENDIENTE';
  globalThis.fetch = async () => ({ok: true, json: async () => data});
  try {
    const result = await getData({apiUrl: 'https://example.org/test-visible-text'}, 2026);
    assert.equal(result.rows[0].values[5], '0007');
    assert.equal(result.rows[0].values[6], 'SIN IMPORTE');
    assert.equal(result.rows[0].display[3], 'PENDIENTE');
  } finally { globalThis.fetch = original; }
});
test('los errores del servidor se presentan sin revelar mensajes internos', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ok: true, json: async () => ({error: {code: 'CONFIG', message: 'private-server-detail'}})});
  try { await assert.rejects(getYears({apiUrl: 'https://example.org/test-error'}), error => !error.message.includes('private-server-detail') && error.message.includes('configuración')); }
  finally { globalThis.fetch = original; }
});
test('la cancelación de solicitudes se transmite al transporte', async () => {
  const original = globalThis.fetch, controller = new AbortController();
  globalThis.fetch = async (_url, {signal}) => new Promise((_resolve, reject) => { signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once: true}); });
  try {
    const pending = getData({apiUrl: 'https://example.org/test-abort'}, 2026, {signal: controller.signal});
    controller.abort(); await assert.rejects(pending, error => error.name === 'AbortError');
  } finally { globalThis.fetch = original; }
});
test('la configuración rechaza direcciones inseguras y años no validados', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ok: true, json: async () => ({apiUrl: 'javascript:alert(1)'})});
  try {
    await assert.rejects(readConfig(), /HTTPS/);
    globalThis.fetch = async () => ({ok: true, json: async () => ({years: [{year: 2026, enabled: false}], defaultYear: 2026})});
    await assert.rejects(getYears({apiUrl: 'https://example.org/test-years'}), /ejercicios/);
  } finally { globalThis.fetch = original; }
});
