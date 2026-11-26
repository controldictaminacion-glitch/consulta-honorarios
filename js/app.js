import {normalize, validUrl, filterRows, sortRows, summarize, readFilters, writeFilters} from './core.js';
import {readConfig, getYears, getData} from './data.js';
import {createExcel, createPdf, downloadBlob} from './exporters.js';

const $ = id => document.getElementById(id);
const money = new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN', maximumFractionDigits: 2});
const integer = new Intl.NumberFormat('es-MX', {maximumFractionDigits: 0});
const state = {config: {}, data: null, compare: null, filtered: [], page: 1, sort: null, dir: 1, loading: false, exporting: false, request: 0, compareRequest: 0};
const saved = readFilters(location.hash);
let searchTimer;

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { $('toast').hidden = true; }, 6500);
}
function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
function filters() {
  return {year: $('year').value, compare: $('compareYear').value, query: $('search').value.trim(), match: $('matchMode').value, status: $('status').value, min: $('minCost').value, max: $('maxCost').value, from: $('dateFrom').value, to: $('dateTo').value, sort: state.sort, dir: state.dir, size: $('pageSize').value};
}
function updateHash() {
  const hash = writeFilters(filters());
  history.replaceState(null, '', `${location.pathname}${location.search}#${hash}`);
}
function showNumber(value, formatter = integer) { return value == null ? '—' : formatter.format(value); }
function formatCell(row, i, columns = state.data.columns) {
  const value = row.values[i], type = columns[i].type;
  if (value === null || value === '') return '—';
  if (type === 'currency' && typeof value === 'number') return money.format(value);
  if (type === 'number' && typeof value === 'number') return integer.format(value);
  return row.display[i] || String(value);
}
function setDownloads() {
  const count = state.data ? ($('scope').value === 'all' ? state.data.rows.length : state.filtered.length) : 0;
  for (const id of ['excel', 'pdf']) $(id).disabled = state.loading || state.exporting || !count;
}
function header() {
  const tr = document.createElement('tr');
  state.data.columns.forEach((col, i) => {
    const th = document.createElement('th'); th.scope = 'col';
    th.setAttribute('aria-sort', state.sort === i ? (state.dir === 1 ? 'ascending' : 'descending') : 'none');
    const button = document.createElement('button'); button.type = 'button'; button.title = `Ordenar por ${col.title}`;
    const label = document.createElement('span'); label.textContent = col.title;
    const icon = document.createElement('span'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = state.sort === i ? (state.dir === 1 ? '↑' : '↓') : '↕';
    button.append(label, icon);
    button.addEventListener('click', () => { state.dir = state.sort === i ? -state.dir : 1; state.sort = i; applyFilters(); });
    th.append(button); tr.append(th);
  });
  $('thead').replaceChildren(tr);
}
function render() {
  if (!state.data) return;
  header();
  const rows = state.filtered, size = Number($('pageSize').value) || Math.max(rows.length, 1), pages = Math.max(1, Math.ceil(rows.length / size));
  state.page = Math.min(Math.max(state.page, 1), pages);
  const start = (state.page - 1) * size, end = Math.min(start + size, rows.length), fragment = document.createDocumentFragment();
  for (const row of rows.slice(start, end)) {
    const tr = document.createElement('tr');
    state.data.columns.forEach((column, i) => {
      const td = document.createElement('td');
      if (i === 1) td.className = 'organ';
      if (column.type === 'currency') td.className = 'money';
      if (column.type === 'number') td.className = 'numeric';
      if (column.type === 'date') td.className = 'date';
      const url = column.type === 'link' ? validUrl(row.values[i]) : null;
      if (url) {
        const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer'; a.textContent = 'Abrir procedencia'; td.append(a);
      } else if (i === 8 && row.values[i]) {
        const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = formatCell(row, i); td.append(chip);
      } else td.textContent = formatCell(row, i);
      tr.append(td);
    });
    fragment.append(tr);
  }
  $('tbody').replaceChildren(fragment);
  $('empty').hidden = rows.length > 0;
  $('empty').textContent = 'No se encontraron registros. Ajusta los filtros o limpia la búsqueda.';
  $('resultCount').textContent = `${rows.length ? `${integer.format(start + 1)}–${integer.format(end)}` : '0'} de ${integer.format(rows.length)} resultados · Base: ${integer.format(state.data.rows.length)}`;
  $('pageLabel').textContent = `Página ${state.page} de ${pages}`;
  $('previous').disabled = state.page <= 1;
  $('next').disabled = state.page >= pages;
  const totals = summarize(rows, state.data.unavailableColumns);
  $('metricRecords').textContent = integer.format(totals.records);
  $('metricOrgs').textContent = `${integer.format(totals.organs)} órganos distintos`;
  for (const [key, id, missing, formatter] of [['folios', 'metricFolios', 'missingFolios', integer], ['cost', 'metricCost', 'missingCost', money], ['dictamen', 'metricDictamen', 'missingDictamen', money]]) {
    $(id).textContent = showNumber(totals[key].value, formatter);
    $(missing).textContent = totals[key].unavailable ? 'Campo no disponible en esta fuente' : totals[key].missing ? `${integer.format(totals[key].missing)} filas sin valor numérico; suma parcial` : key === 'folios' ? 'Suma de las filas consultadas' : 'Pesos mexicanos';
  }
  $('scope').options[0].textContent = `Resultados actuales (${integer.format(rows.length)})`;
  $('scope').options[1].textContent = `Tabla completa (${integer.format(state.data.rows.length)})`;
  setDownloads(); renderComparison();
}
function validFilters() {
  const f = filters();
  if (f.min !== '' && f.max !== '' && Number(f.min) > Number(f.max)) { notice('El costo mínimo debe ser menor o igual al máximo.'); return false; }
  if (f.from && f.to && f.from > f.to) { notice('La fecha inicial debe ser anterior o igual a la final.'); return false; }
  return true;
}
function applyFilters(reset = true) {
  if (!state.data || !validFilters()) return;
  notice('');
  state.filtered = sortRows(filterRows(state.data, filters()), state.data.columns, state.sort, state.dir);
  if (reset) state.page = 1;
  updateHash(); render();
}
function displayDate(value, timeZone) {
  if (!value) return 'no disponible';
  try { return new Date(value).toLocaleString('es-MX', {timeZone: timeZone || 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short'}); }
  catch { return new Date(value).toLocaleString('es-MX'); }
}
function populateChoices(data) {
  const names = [...new Set(data.rows.map(row => String(row.values[1] || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  $('organs').replaceChildren(...names.map(name => { const option = document.createElement('option'); option.value = name; return option; }));
  const selected = $('status').value || saved.status || '';
  const statuses = [...new Set(data.rows.map(row => String(row.values[8] || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  $('status').replaceChildren(new Option('Todos', ''), ...statuses.map(value => new Option(value, value)));
  if (selected && !statuses.includes(selected)) $('status').append(new Option(selected, selected));
  $('status').value = selected;
  $('statusLabel').textContent = data.columns[8].title;
  const dateColumn = data.columns.find(column => column.type === 'date');
  $('dateLabel').textContent = dateColumn ? `${dateColumn.title}: desde` : 'Fecha desde';
  $('dateFrom').disabled = $('dateTo').disabled = !dateColumn;
}
function clearData() {
  state.data = null; state.filtered = [];
  $('tbody').replaceChildren(); $('thead').replaceChildren();
  for (const id of ['metricRecords', 'metricFolios', 'metricCost', 'metricDictamen']) $(id).textContent = '—';
  $('metricOrgs').textContent = 'Esperando información';
  for (const id of ['missingFolios', 'missingCost', 'missingDictamen']) $(id).textContent = 'Información no disponible';
  $('resultCount').textContent = 'Esperando información'; $('updated').textContent = 'Última actualización: no disponible';
  $('pageLabel').textContent = 'Página 1 de 1'; $('previous').disabled = $('next').disabled = true;
  $('empty').hidden = false; $('empty').textContent = 'Consultando el ejercicio seleccionado…';
  $('compareBody').replaceChildren(); setDownloads();
}
async function loadData(force = false) {
  const request = ++state.request, year = Number($('year').value);
  state.controller?.abort(); state.controller = new AbortController();
  state.compareController?.abort(); ++state.compareRequest; state.compare = null;
  if (state.data?.year !== year) clearData();
  state.loading = true; $('refresh').disabled = true; $('year').disabled = true;
  $('tableWrap').setAttribute('aria-busy', 'true'); notice(''); setDownloads();
  try {
    const data = await getData(state.config, year, {force, signal: state.controller.signal});
    if (request !== state.request) return;
    state.data = data; populateChoices(data);
    $('updated').textContent = `Fuente actualizada: ${displayDate(data.sourceUpdatedAt, data.timeZone)} · Consulta: ${displayDate(data.loadedAt, data.timeZone)}`;
    $('sourceState').textContent = `${state.config.demo ? 'Demostración' : 'Consulta de la fuente configurada'} · Ejercicio ${year}${data.unavailableColumns?.length ? ' · Algunos campos no están disponibles' : ''}${data.warnings?.length ? ' · Hay valores de texto excluidos de las sumas' : ''}`;
    $('sourceFooter').textContent = `Fuente: ${data.title || 'Servicio institucional'} · ${year}`;
    document.title = `Consulta de Honorarios ${year}`;
    applyFilters(); await loadComparison(force);
  } catch (error) {
    if (request !== state.request || error.name === 'AbortError') return;
    notice((state.data ? 'No se pudo actualizar. Se conserva la consulta anterior del mismo ejercicio. ' : '') + error.message);
    if (!state.data) { $('resultCount').textContent = 'Consulta no disponible'; $('empty').textContent = 'La información aparecerá cuando el servicio y las fuentes estén configurados y validados.'; }
    $('compareStatus').textContent = 'La comparación requiere que ambos ejercicios estén disponibles.';
  } finally {
    if (request === state.request) {
      state.loading = false; $('refresh').disabled = false; $('year').disabled = false;
      $('tableWrap').setAttribute('aria-busy', 'false'); setDownloads();
    }
  }
}
async function loadComparison(force = false) {
  const request = ++state.compareRequest, year = Number($('compareYear').value);
  state.compareController?.abort(); state.compareController = new AbortController(); state.compare = null;
  $('compareBody').replaceChildren();
  if (!year) { $('compareStatus').textContent = 'Selecciona otro ejercicio para comparar.'; updateHash(); return; }
  if (year === Number($('year').value)) { $('compareStatus').textContent = 'Selecciona un ejercicio distinto al de la consulta.'; updateHash(); return; }
  if (!state.data) { $('compareStatus').textContent = 'Carga la consulta antes de comparar ejercicios.'; return; }
  $('compareStatus').textContent = `Consultando ${year}…`;
  try {
    const data = await getData(state.config, year, {force, signal: state.compareController.signal});
    if (request !== state.compareRequest) return;
    state.compare = data; updateHash(); renderComparison();
  } catch (error) {
    if (request !== state.compareRequest || error.name === 'AbortError') return;
    $('compareStatus').textContent = `Comparación no disponible: ${error.message}`;
  }
}
function renderComparison() {
  if (!state.data || !state.compare) return;
  const f = filters();
  const missingFilter = [state.data, state.compare].find(data => (f.status && data.unavailableColumns?.includes(8)) || ((f.from || f.to) && (data.columns.findIndex(column => column.type === 'date') < 0 || data.unavailableColumns?.includes(data.columns.findIndex(column => column.type === 'date')))));
  if (missingFilter) {
    $('compareBody').replaceChildren();
    $('compareStatus').textContent = `No comparable: ${missingFilter.year} no dispone de uno de los campos filtrados. Ajusta los filtros para comparar.`;
    return;
  }
  const a = summarize(state.filtered, state.data.unavailableColumns), b = summarize(filterRows(state.compare, filters()), state.compare.unavailableColumns);
  $('compareHeadA').textContent = String(state.data.year); $('compareHeadB').textContent = String(state.compare.year);
  $('compareStatus').textContent = 'Mismos filtros en ambos ejercicios. Las cifras incompletas se indican como no comparables.';
  const fragment = document.createDocumentFragment();
  for (const [label, key, formatter] of [['Registros', 'records', integer], ['Órganos distintos', 'organs', integer], ['Folios', 'folios', integer], ['Costo total', 'cost', money], ['Costo del dictamen', 'dictamen', money]]) {
    const complex = typeof a[key] === 'object', av = complex ? a[key].value : a[key], bv = complex ? b[key].value : b[key];
    const complete = av !== null && bv !== null && (!complex || (!a[key].missing && !b[key].missing));
    const tr = document.createElement('tr'), heading = document.createElement('th'); heading.scope = 'row'; heading.textContent = label; tr.append(heading);
    const delta = complete ? `${showNumber(av - bv, formatter)}${bv !== 0 ? ` (${new Intl.NumberFormat('es-MX', {maximumFractionDigits: 1, signDisplay: 'exceptZero'}).format((av - bv) / Math.abs(bv) * 100)} %)` : ' (base cero)'} ` : 'No comparable';
    for (const text of [showNumber(av, formatter), showNumber(bv, formatter), delta]) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
    fragment.append(tr);
  }
  $('compareBody').replaceChildren(fragment);
}
function filterDescription() {
  const f = filters(), parts = [];
  if (f.query) parts.push(`Órgano ${f.match === 'exact' ? 'exacto' : 'contiene'}: ${f.query}`);
  if (f.status) parts.push(`${state.data.columns[8].title}: ${f.status}`);
  if (f.min !== '') parts.push(`Costo mínimo: ${f.min}`);
  if (f.max !== '') parts.push(`Costo máximo: ${f.max}`);
  if (f.from) parts.push(`Fecha desde: ${f.from}`);
  if (f.to) parts.push(`Fecha hasta: ${f.to}`);
  return parts.join(' · ');
}
async function download(format) {
  if (!state.data || state.loading || state.exporting || !validFilters()) return;
  clearTimeout(searchTimer); applyFilters(false);
  const all = $('scope').value === 'all', rows = all ? sortRows(state.data.rows, state.data.columns, state.sort, state.dir) : state.filtered.slice();
  if (!rows.length) { toast('No hay registros para descargar.'); return; }
  state.exporting = true; setDownloads(); toast(`Preparando ${format === 'xlsx' ? 'Excel' : 'PDF'}…`);
  try {
    const context = {year: state.data.year, title: state.data.title, columns: state.data.columns, rows, loadedAt: state.data.loadedAt, sourceUpdatedAt: state.data.sourceUpdatedAt, timeZone: state.data.timeZone, query: all ? '' : filterDescription(), matchMode: $('matchMode').value, scope: all ? 'Tabla completa' : 'Resultados actuales'};
    const blob = format === 'xlsx' ? await createExcel(context) : await createPdf(context);
    const name = `Honorarios_${context.year}_${all ? 'Completo' : 'Consulta'}_${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_')}.${format}`;
    downloadBlob(blob, name);
    const old = $('downloadFallback'); if (old) { URL.revokeObjectURL(old.href); old.remove(); }
    const link = document.createElement('a'); link.id = 'downloadFallback'; link.href = URL.createObjectURL(blob); link.download = name; link.textContent = 'Descargar archivo preparado'; link.className = 'btn';
    document.querySelector('.controls').append(link); toast('Archivo preparado. Puedes usar el enlace de descarga.');
  } catch (error) { toast(`No se pudo generar el archivo: ${error.message}`); }
  finally { state.exporting = false; setDownloads(); }
}
async function initialize() {
  $('search').value = saved.query || ''; $('matchMode').value = saved.match;
  $('minCost').value = saved.min || ''; $('maxCost').value = saved.max || ''; $('dateFrom').value = saved.from || ''; $('dateTo').value = saved.to || ''; $('pageSize').value = saved.size;
  state.sort = saved.sort == null ? null : Number(saved.sort); state.dir = Number(saved.dir);
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  try {
    state.config = await readConfig(); state.config.demo = demo;
    $('demoNotice').hidden = !demo;
    if (state.config.adminUrl && validUrl(state.config.adminUrl)) { $('admin').href = state.config.adminUrl; $('admin').hidden = false; }
    const result = await getYears(state.config);
    const years = [...result.years];
    for (const year of [2025, 2026]) if (!years.some(item => item.year === year)) years.push({year, enabled: false});
    years.sort((a, b) => b.year - a.year);
    const option = item => { const result = new Option(`${item.year}${item.enabled ? '' : ' · no disponible'}`, String(item.year)); result.disabled = !item.enabled; return result; };
    $('year').replaceChildren(...years.map(option)); $('compareYear').replaceChildren(new Option('Sin comparación', ''), ...years.map(option));
    $('year').value = years.some(item => item.enabled && String(item.year) === saved.year) ? saved.year : String(result.defaultYear);
    $('compareYear').value = years.some(item => item.enabled && String(item.year) === saved.compare) ? saved.compare : '';
    await loadData();
  } catch (error) { notice(error.message); clearData(); $('empty').textContent = 'La información aparecerá cuando el servicio y las fuentes estén configurados y validados.'; $('resultCount').textContent = 'Consulta pendiente de configuración'; }
}
$('searchForm').addEventListener('submit', event => { event.preventDefault(); clearTimeout(searchTimer); applyFilters(); });
$('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => applyFilters(), 180); });
for (const id of ['matchMode', 'status', 'minCost', 'maxCost', 'dateFrom', 'dateTo']) $(id).addEventListener('change', () => applyFilters());
$('clear').addEventListener('click', () => { for (const id of ['search', 'status', 'minCost', 'maxCost', 'dateFrom', 'dateTo']) $(id).value = ''; $('matchMode').value = 'contains'; applyFilters(); $('search').focus(); });
$('refresh').addEventListener('click', () => loadData(true)); $('year').addEventListener('change', () => loadData());
$('compareYear').addEventListener('change', () => loadComparison());
$('scope').addEventListener('change', setDownloads);
$('pageSize').addEventListener('change', () => { state.page = 1; if (state.data) { updateHash(); render(); } });
$('previous').addEventListener('click', () => { state.page--; render(); $('tableWrap').scrollTop = 0; });
$('next').addEventListener('click', () => { state.page++; render(); $('tableWrap').scrollTop = 0; });
$('excel').addEventListener('click', () => download('xlsx')); $('pdf').addEventListener('click', () => download('pdf'));
$('share').addEventListener('click', async () => { updateHash(); try { await navigator.clipboard.writeText(location.href); toast('Enlace con filtros copiado.'); } catch { const link = document.createElement('a'); link.href = location.href; link.textContent = 'Abrir enlace con filtros'; link.className = 'btn'; document.querySelector('.year-bar').append(link); toast('Copia la dirección de la barra del navegador para compartir la consulta.'); } });
window.addEventListener('hashchange', () => { if (location.hash !== '#consulta') location.reload(); });
initialize();
