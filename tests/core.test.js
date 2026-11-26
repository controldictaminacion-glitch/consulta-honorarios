import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize, validUrl, validateData, isoDateKey, filterRows, sortRows, summarize, readFilters, writeFilters} from '../js/core.js';
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
test('se rechazan ejercicio incorrecto, columnas, filas, objetos y números no finitos', () => {
  assert.throws(() => validateData(demoData(2025), 2026));
  let data = demoData(2026); data.columns.pop(); assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.rows[0].values[6] = Infinity; assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.rows[0].values[6] = NaN; assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.rows[0].values[6] = {amount: 1200}; assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.rows[0].display.pop(); assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.loadedAt = 'ayer'; assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.loadedAt = 2026; assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.sourceUpdatedAt = 'ayer'; assert.throws(() => validateData(data, 2026));
  data = demoData(2026); data.columns[6].type = 'text'; assert.throws(() => validateData(data, 2026));
});

test('los importes y folios de texto se conservan sin convertirlos ni sumarlos', () => {
  const data = demoData(2026);
  const baseline = summarize(data.rows);
  const original = data.rows[0].values.slice();
  data.rows[0].values[0] = '00001'; data.rows[0].display[0] = '00001';
  data.rows[0].values[5] = '00007'; data.rows[0].display[5] = '00007';
  data.rows[0].values[6] = '1,200.25'; data.rows[0].display[6] = '$1,200.25';
  const originalDictamen = data.rows[1].values[10];
  data.rows[1].values[10] = '=SUM(1,2)'; data.rows[1].display[10] = '=SUM(1,2)';
  validateData(data, 2026);
  const result = summarize(data.rows);
  assert.equal(data.rows[0].values[0], '00001');
  assert.equal(data.rows[0].values[5], '00007');
  assert.equal(data.rows[0].display[6], '$1,200.25');
  assert.equal(data.rows[1].values[10], '=SUM(1,2)');
  assert.equal(result.folios.value, baseline.folios.value - original[5]);
  assert.equal(result.folios.missing, 1);
  assert.equal(result.cost.value, baseline.cost.value - original[6]);
  assert.equal(result.cost.missing, 1);
  assert.equal(result.dictamen.value, baseline.dictamen.value - originalDictamen);
  assert.equal(result.dictamen.missing, baseline.dictamen.missing + 1);
  assert.equal(filterRows(data, {min: '0'}).length, data.rows.length - 1);
});

test('ordenar columnas numéricas con texto usa la comparación original sin coerción', () => {
  const data = demoData(2026);
  const rows = [data.rows[0], data.rows[1], data.rows[2]];
  rows[0].values[6] = '2,000.00'; rows[1].values[6] = '0010'; rows[2].values[6] = 'SIN IMPORTE';
  const expected = rows.slice().sort((a, b) => a.values[6].localeCompare(b.values[6], 'es', {numeric: true, sensitivity: 'base'}));
  assert.deepEqual(sortRows(rows, data.columns, 6, 1), expected);
  assert.deepEqual(sortRows(rows, data.columns, 6, -1), expected.slice().reverse());
  assert.equal(rows[1].values[6], '0010');
});

test('las fechas visibles no interpretables no bloquean la tabla ni entran en filtros de fecha', () => {
  const data = demoData(2026);
  for (const [index, value] of ['Pendiente', '31/01/2026', '2026-02-30', '2026-01-01 texto'].entries()) {
    data.rows[index].values[3] = value; data.rows[index].display[3] = value;
  }
  validateData(data, 2026);
  assert.equal(filterRows(data, {}).length, 64);
  assert.equal(filterRows(data, {from: '2026-01-01', to: '2026-12-31'}).length, 60);
  assert.equal(isoDateKey('2026-02-28'), '2026-02-28');
  assert.equal(isoDateKey('2026-02-30'), '');
  assert.equal(isoDateKey('2024-02-29T00:00:00.000Z'), '2024-02-29');
  assert.equal(isoDateKey('2025-02-29'), '');
  assert.equal(isoDateKey(20260101), '');
  assert.equal(data.rows[0].display[3], 'Pendiente');
  const sorted = sortRows(data.rows.slice(0, 4), data.columns, 3, 1);
  assert.equal(sorted.length, 4);
  assert.deepEqual(new Set(sorted.map(row => row.values[3])), new Set(['Pendiente', '31/01/2026', '2026-02-30', '2026-01-01 texto']));
  assert.equal(readFilters('#from=2026-02-30&to=2026-12-31').from, undefined);
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
