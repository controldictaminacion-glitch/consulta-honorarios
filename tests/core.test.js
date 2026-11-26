import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize, validUrl, validateData, filterRows, sortRows, summarize, readFilters, writeFilters} from '../js/core.js';
import {demoData} from '../js/data.js';

test('la búsqueda normaliza acentos, mayúsculas y espacios', () => {
  assert.equal(normalize('  ÓRGANO   ÁLAMO '), 'organo alamo');
  const data = demoData(2026);
  assert.equal(filterRows(data, {query: 'organo demostrativo alamo', match: 'exact'}).length, 16);
  assert.equal(filterRows(data, {query: 'ORGANO', match: 'contains'}).length, 32);
});
test('los filtros combinan estatus, costo y fecha sin convertir ausentes en cero', () => {
  const data = demoData(2026);
  const rows = filterRows(data, {query: '', status: 'SUN', min: '1200', max: '5000', from: '2026-01-01', to: '2026-01-01'});
  assert.equal(rows.length, 2);
  data.rows[0].values[6] = null;
  assert.equal(filterRows(data, {min: '0'}).length, 63);
  assert.equal(filterRows(data, {from: '2025-01-01', to: '2025-12-31'}).length, 0);
});
test('el orden numérico conserva filas, no modifica la fuente y deja ausentes al final', () => {
  const data = demoData(2026), original = data.rows.slice();
  const rows = sortRows(data.rows, data.columns, 6, -1);
  assert.equal(rows[0].values[6], 76800.25);
  assert.deepEqual(data.rows, original);
  data.rows[0].values[6] = null;
  assert.equal(sortRows(data.rows, data.columns, 6, 1).at(-1).values[6], null);
  assert.equal(sortRows(data.rows, data.columns, 6, -1).at(-1).values[6], null);
});
test('los folios identificadores conservan ceros y los importes conservan centavos', () => {
  const data = validateData(demoData(2026), 2026);
  assert.equal(data.rows[0].values[0], '001');
  assert.equal(data.rows[0].values[6], 1200.25);
  assert.equal(summarize(data.rows).cost.value, 2496016);
});
test('un importe ausente es desconocido y se cuenta como incompleto', () => {
  const data = demoData(2026); data.rows.forEach(row => { row.values[10] = null; });
  assert.deepEqual(summarize(data.rows).dictamen, {value: null, missing: 64});
  assert.deepEqual(summarize([]).dictamen, {value: 0, missing: 0});
  assert.deepEqual(summarize([], [10]).dictamen, {value: null, missing: 0, unavailable: true});
});
test('se rechazan ejercicio incorrecto, columnas, filas, fechas y números no validados', () => {
  assert.throws(() => validateData(demoData(2025), 2026));
  let data = demoData(2026); data.columns.pop(); assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.rows[0].values[6] = '1,200.25'; assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.rows[0].values[6] = Infinity; assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.rows[0].display.pop(); assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.loadedAt = 'ayer'; assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.rows[0].values[3] = 'ayer'; assert.throws(() => validateData(data, 2026));
});
test('los enlaces de procedencia permiten solo protocolos web sin credenciales', () => {
  assert.equal(validUrl('javascript:alert(1)'), null);
  assert.equal(validUrl('data:text/html,hello'), null);
  assert.equal(validUrl('https://user:password@example.org'), null);
  assert.equal(validUrl('https://example.org/consulta'), 'https://example.org/consulta');
});
test('los enlaces con filtros restauran solo campos permitidos y valores seguros', () => {
  const value = {year: 2025, query: 'Órgano Álamo', min: 100, status: 'Validado', sort: 6, dir: -1, size: '100'};
  const restored = readFilters('#' + writeFilters(value));
  assert.equal(restored.query, value.query); assert.equal(restored.year, '2025'); assert.equal(restored.sort, '6'); assert.equal(restored.dir, '-1');
  assert.deepEqual(readFilters('#admin=true&apiUrl=https://example.org&min=no&sort=999&year=abcd'), {match: 'contains', size: '25', dir: '1'});
});
