export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export function validUrl(value) {
  try { const url = new URL(String(value)); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function validateData(data, year) {
  if (!data || data.year !== Number(year) || !Array.isArray(data.columns) || data.columns.length !== 11 || !Array.isArray(data.rows) || data.rows.length > 100000) throw new Error('La fuente no cumple el contrato de consulta.');
  const types = ['text', 'number', 'currency', 'date', 'link'];
  if (!data.columns.every(col => col && typeof col.title === 'string' && col.title.length <= 300 && types.includes(col.type))) throw new Error('La definición de columnas no es válida.');
  if (data.columns[5].type !== 'number' || data.columns[6].type !== 'currency' || data.columns[10].type !== 'currency') throw new Error('Las columnas de folios e importes no corresponden al contrato.');
  if (data.unavailableColumns != null && (!Array.isArray(data.unavailableColumns) || !data.unavailableColumns.every(i => Number.isInteger(i) && i >= 0 && i < 11))) throw new Error('La definición de campos ausentes no es válida.');
  for (const row of data.rows) {
    if (!row || !Array.isArray(row.values) || row.values.length !== 11 || !Array.isArray(row.display) || row.display.length !== 11) throw new Error('La fuente contiene una fila incompleta.');
    row.values.forEach((value, i) => {
      if (!(value === null || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)))) throw new Error('La fuente contiene valores inválidos.');
      if (['currency', 'number'].includes(data.columns[i].type) && value !== null && value !== '' && typeof value !== 'number') throw new Error('La fuente contiene importes o folios sin validar.');
      if (data.columns[i].type === 'date' && value !== null && value !== '' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) || !Number.isFinite(Date.parse(value)))) throw new Error('La fuente contiene fechas sin validar.');
      if (typeof row.display[i] !== 'string') throw new Error('El formato de una fila no es válido.');
    });
  }
  if (!Number.isFinite(Date.parse(data.loadedAt)) || (data.sourceUpdatedAt != null && !Number.isFinite(Date.parse(data.sourceUpdatedAt)))) throw new Error('La fecha de actualización no es válida.');
  return data;
}
export function filterRows(data, filters) {
  const query = normalize(filters.query), status = normalize(filters.status);
  const dates = data.columns.map((col, i) => col.type === 'date' ? i : -1).filter(i => i >= 0);
  return data.rows.filter(row => {
    const organ = normalize(row.values[1]);
    if (query && (filters.match === 'exact' ? organ !== query : !organ.includes(query))) return false;
    if (status && normalize(row.values[8]) !== status) return false;
    const amount = row.values[6];
    if (filters.min !== '' && filters.min != null && (typeof amount !== 'number' || amount < Number(filters.min))) return false;
    if (filters.max !== '' && filters.max != null && (typeof amount !== 'number' || amount > Number(filters.max))) return false;
    if (filters.from || filters.to) {
      // The first date column is the explicitly displayed date field for this filter.
      const date = dates.length ? String(row.values[dates[0]] ?? '').slice(0, 10) : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (filters.from && date < filters.from) || (filters.to && date > filters.to)) return false;
    }
    return true;
  });
}
export function sortRows(rows, columns, index = null, direction = 1) {
  if (index == null) return rows.slice();
  const numeric = ['number', 'currency'].includes(columns[index]?.type);
  return rows.slice().sort((a, b) => {
    const x = a.values[index], y = b.values[index];
    const emptyX = x === null || x === '', emptyY = y === null || y === '';
    if (emptyX || emptyY) return emptyX ? (emptyY ? 0 : 1) : -1;
    return (numeric ? x - y : String(x).localeCompare(String(y), 'es', {numeric: true, sensitivity: 'base'})) * direction;
  });
}
export function sumColumn(rows, index) {
  const numbers = rows.map(row => row.values[index]).filter(value => typeof value === 'number' && Number.isFinite(value));
  return {value: rows.length && !numbers.length ? null : numbers.reduce((sum, value) => sum + value, 0), missing: rows.length - numbers.length};
}
export function summarize(rows, unavailableColumns = []) {
  const sum = index => unavailableColumns.includes(index) ? {value: null, missing: rows.length, unavailable: true} : sumColumn(rows, index);
  return {records: rows.length, organs: new Set(rows.map(row => normalize(row.values[1])).filter(Boolean)).size, folios: sum(5), cost: sum(6), dictamen: sum(10)};
}
const allowed = ['year', 'compare', 'query', 'match', 'status', 'min', 'max', 'from', 'to', 'sort', 'dir', 'size'];
export function readFilters(hash) {
  const params = new URLSearchParams(String(hash).replace(/^#/, '')), result = {};
  allowed.forEach(key => { if (params.has(key)) result[key] = params.get(key).slice(0, 300); });
  for (const key of ['min', 'max']) if (result[key] && !Number.isFinite(Number(result[key]))) delete result[key];
  for (const key of ['from', 'to']) if (result[key] && !/^\d{4}-\d{2}-\d{2}$/.test(result[key])) delete result[key];
  if (!/^\d{4}$/.test(result.year)) delete result.year;
  if (result.compare && !/^\d{4}$/.test(result.compare)) delete result.compare;
  if (!['contains', 'exact'].includes(result.match)) result.match = 'contains';
  if (!['25', '50', '100', '0'].includes(result.size)) result.size = '25';
  if (!/^([0-9]|10)$/.test(result.sort)) delete result.sort;
  result.dir = result.dir === '-1' ? '-1' : '1';
  return result;
}
export function writeFilters(filters) {
  const params = new URLSearchParams();
  allowed.forEach(key => { const value = filters[key]; if (value !== '' && value != null) params.set(key, String(value)); });
  return params.toString();
}
