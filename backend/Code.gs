/**
 * Servicio nuevo de consulta. No reemplaza las reglas de obtenerDatos original.
 * Configuración sensible: exclusivamente Propiedades del script.
 * Dos despliegues del mismo proyecto: lectura como propietario; admin como usuario.
 */
const CONFIG_KEY_ = 'HONORARIOS_CONFIG_JSON';
const ALLOWED_TYPES_ = ['text', 'number', 'currency', 'date', 'link'];

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'years');
  if (action === 'admin') {
    try {
      requireAdmin_();
      return HtmlService.createHtmlOutputFromFile('Admin').setTitle('Administración de honorarios');
    } catch (_) {
      return HtmlService.createHtmlOutput('<h1>Acceso restringido</h1><p>Ingresa con una cuenta autorizada en el acceso de administración.</p>');
    }
  }
  try {
    if (properties_().getProperty('PUBLIC_READ_ENABLED') !== 'true') fail_('READ_DISABLED');
    const config = config_();
    if (action === 'years') {
      return json_({ years: config.years.map(s => ({ year: s.year, enabled: Boolean(s.enabled && s.validated) })), defaultYear: config.defaultYear });
    }
    if (action !== 'data') fail_('BAD_REQUEST');
    const year = Number(e.parameter.year);
    const source = config.years.find(s => s.year === year && s.enabled && s.validated);
    if (!source) fail_('SOURCE_UNAVAILABLE');
    return json_(data_(source, config.revision, e.parameter.refresh === '1'));
  } catch (error) {
    return json_({ error: { code: publicCode_(error), message: 'La fuente no está disponible o requiere validación administrativa.' } });
  }
}

function adminGetConfig() {
  requireAdmin_();
  const current = config_();
  return {
    revision: current.revision,
    defaultYear: current.defaultYear,
    years: current.years.map(s => Object.assign({}, s, {
      sourceUrl: s.spreadsheetId ? 'https://docs.google.com/spreadsheets/d/' + s.spreadsheetId + '/edit?gid=' + s.sheetId : ''
    }))
  };
}

function adminValidateSource(source) {
  requireAdmin_();
  try {
    const clean = normalizeSource_(source);
    const checked = readData_(clean);
    return { ok: true, rows: checked.rows.length, message: 'Ejercicio, encabezados, tipos y reglas declaradas válidos en ' + checked.rows.length + ' filas. Falta guardar para aplicar.' };
  } catch (_) {
    throw new Error('No se pudo validar: revisa permisos, ejercicio, encabezados, tipos y reglas de selección.');
  }
}

function adminSaveConfig(draft, expectedRevision) {
  const actor = requireAdmin_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Hay otro cambio en proceso. Intenta de nuevo.');
  try {
    const old = config_();
    if (Number(expectedRevision) !== old.revision) throw new Error('La configuración cambió. Vuelve a cargar antes de guardar.');
    if (!draft || !Array.isArray(draft.years) || draft.years.length < 2 || draft.years.length > 30) fail_('BAD_CONFIG');
    const years = draft.years.map(normalizeSource_);
    if (new Set(years.map(s => s.year)).size !== years.length || !years.some(s => s.year === 2025) || !years.some(s => s.year === 2026)) fail_('BAD_CONFIG');
    years.forEach(source => {
      source.validated = false;
      if (source.enabled) {
        readData_(source);
        source.validated = true;
      }
    });
    const defaultYear = Number(draft.defaultYear);
    if (!years.some(s => s.year === defaultYear && s.enabled && s.validated)) fail_('BAD_CONFIG');
    const next = { revision: old.revision + 1, defaultYear: defaultYear, years: years };
    const audit = auditSheet_(); // Sin bitácora privada no hay cambios.
    const id = Utilities.getUuid();
    audit.appendRow([new Date(), actor, id, next.revision, 'CONFIG_REQUESTED', digest_(old), digest_(next)]);
    const row = audit.getLastRow();
    try {
      properties_().setProperty(CONFIG_KEY_, JSON.stringify(next));
    } catch (_) {
      audit.getRange(row, 5).setValue('CONFIG_FAILED');
      throw new Error('No se guardó la configuración. Revisa la bitácora privada.');
    }
    // Si falla esta marca, CONFIG_REQUESTED + revisión/hash permiten conciliar el cambio.
    try { audit.getRange(row, 5).setValue('CONFIG_APPLIED'); } catch (_) { /* El registro previo permanece. */ }
    return { revision: next.revision, message: 'Configuración guardada y registrada.' };
  } catch (error) {
    if (/configuración cambió|No se guardó/.test(String(error.message))) throw error;
    throw new Error('No se aplicó el cambio. Revisa fuentes, mapeo, validación anual, conciliación y bitácora privada.');
  } finally {
    lock.releaseLock();
  }
}

function adminGetAudit() {
  requireAdmin_();
  const sheet = auditSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(Math.max(2, last - 99), 1, Math.min(100, last - 1), 7).getDisplayValues();
}

function requireAdmin_() {
  const active = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const effective = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  let admins;
  try { admins = JSON.parse(properties_().getProperty('ADMIN_EMAILS_JSON') || '[]'); } catch (_) { fail_('FORBIDDEN'); }
  if (!active || active !== effective || !Array.isArray(admins) || !admins.map(String).map(s => s.trim().toLowerCase()).includes(active)) fail_('FORBIDDEN');
  return active;
}

function properties_() { return PropertiesService.getScriptProperties(); }
function config_() {
  const value = properties_().getProperty(CONFIG_KEY_);
  if (!value) return { revision: 0, defaultYear: 2026, years: [{ year: 2025, enabled: false, validated: false }, { year: 2026, enabled: false, validated: false }] };
  const result = JSON.parse(value);
  if (!Number.isInteger(result.revision) || !Array.isArray(result.years)) fail_('BAD_CONFIG');
  return result;
}
function fail_(code) { const error = new Error(code); error.code = code; throw error; }
function publicCode_(error) {
  return ['READ_DISABLED', 'BAD_REQUEST', 'SOURCE_UNAVAILABLE'].includes(error && error.code) ? error.code : 'SOURCE_UNAVAILABLE';
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function digest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value)).map(n => (n & 255).toString(16).padStart(2, '0')).join('');
}

function normalizeSource_(input) {
  if (!input || !Number.isInteger(Number(input.year)) || Number(input.year) < 2020 || Number(input.year) > 2100) fail_('BAD_CONFIG');
  const year = Number(input.year);
  if (!input.enabled && !input.sourceUrl && !input.spreadsheetId) return { year: year, enabled: false, validated: false };
  let spreadsheetId = input.spreadsheetId;
  let sheetId = Number(input.sheetId);
  if (input.sourceUrl) {
    const match = String(input.sourceUrl).match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)\/(?:edit)?(?:[?#].*)?$/);
    const gid = String(input.sourceUrl).match(/(?:[?#&])gid=(\d+)(?:[&#]|$)/);
    if (!match || !gid) fail_('BAD_CONFIG');
    spreadsheetId = match[1];
    sheetId = Number(gid[1]);
  }
  if (!/^[A-Za-z0-9_-]{15,}$/.test(String(spreadsheetId)) || !Number.isSafeInteger(sheetId) || sheetId < 0) fail_('BAD_CONFIG');
  const result = {
    year: year, spreadsheetId: String(spreadsheetId), sheetId: sheetId, enabled: Boolean(input.enabled), validated: false,
    headerRow: Number(input.headerRow), startRow: Number(input.startRow),
    yearEvidenceCell: String(input.yearEvidenceCell || ''),
    rulesConfirmed: input.rulesConfirmed === true,
    reconciliationNote: String(input.reconciliationNote || '').trim().slice(0, 1000),
    columns: Array.isArray(input.columns) ? input.columns.map(c => ({ title: String(c.title || '').slice(0, 200), type: String(c.type || ''), column: c.column === null ? null : Number(c.column), sourceHeader: String(c.sourceHeader || '') })) : [],
    rowSelection: input.rowSelection || null
  };
  return result;
}

function validateSource_(source) {
  if (!source.rulesConfirmed || source.reconciliationNote.length < 20) fail_('RECONCILIATION_REQUIRED');
  if (!Number.isInteger(source.headerRow) || source.headerRow < 1 || !Number.isInteger(source.startRow) || source.startRow <= source.headerRow) fail_('BAD_CONFIG');
  if (!/^[A-Z]{1,3}[1-9]\d{0,5}$/.test(source.yearEvidenceCell)) fail_('BAD_CONFIG');
  if (source.columns.length !== 11 || source.columns.some(c => !c.title || !ALLOWED_TYPES_.includes(c.type) || (c.column !== null && (!c.sourceHeader || !Number.isInteger(c.column) || c.column < 1 || c.column > 1000)) || (c.column === null && c.sourceHeader !== ''))) fail_('BAD_CONFIG');
  if (source.columns[1].type !== 'text' || source.columns[5].type !== 'number' || source.columns[6].type !== 'currency' || source.columns[10].type !== 'currency') fail_('BAD_CONFIG');
  if ([1, 5, 6].some(index => source.columns[index].column === null)) fail_('BAD_CONFIG');
  const rule = source.rowSelection;
  if (!rule || !Number.isInteger(rule.requiredColumn) || rule.requiredColumn < 1 || rule.requiredColumn > 1000 || !Array.isArray(rule.excludeExact) || !Array.isArray(rule.excludeRows) || rule.excludeRows.some(n => !Number.isInteger(n) || n < 1) || rule.excludeExact.some(s => typeof s !== 'string')) fail_('BAD_CONFIG');
  if (rule.lastRow !== undefined && (!Number.isInteger(rule.lastRow) || rule.lastRow < source.startRow)) fail_('BAD_CONFIG');
  const book = SpreadsheetApp.openById(source.spreadsheetId);
  const sheet = book.getSheets().find(s => s.getSheetId() === source.sheetId);
  if (!sheet) fail_('SOURCE_UNAVAILABLE');
  const evidence = sheet.getRange(source.yearEvidenceCell).getDisplayValue();
  if (!(new RegExp('(^|[^0-9])' + source.year + '([^0-9]|$)')).test(evidence)) fail_('YEAR_MISMATCH');
  const titleYears = String(book.getName()).match(/\b20\d{2}\b/g) || [];
  if (titleYears.some(year => Number(year) !== source.year)) fail_('YEAR_MISMATCH');
  const width = Math.max.apply(null, source.columns.map(c => c.column).concat(rule.requiredColumn));
  const headers = sheet.getRange(source.headerRow, 1, 1, width).getDisplayValues()[0];
  source.columns.forEach(c => { if (c.column !== null && normalize_(headers[c.column - 1]) !== normalize_(c.sourceHeader)) fail_('SCHEMA_MISMATCH'); });
  return { book: book, sheet: sheet, width: width };
}

function normalize_(value) { return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function safeLink_(value) { return /^https?:\/\//i.test(String(value || '')) ? String(value) : null; }

function data_(source, revision, refresh) {
  const cache = CacheService.getScriptCache();
  const key = 'honorarios-' + revision + '-' + source.year;
  const cached = refresh ? null : cache.get(key);
  if (cached) return JSON.parse(cached);
  const result = readData_(source);
  const serialized = JSON.stringify(result);
  if (serialized.length < 85000) cache.put(key, serialized, 90);
  return result;
}

function readData_(source) {
  const checked = validateSource_(source); // Nunca confiar solo en el indicador persistido.
  const sheet = checked.sheet;
  const last = Math.min(sheet.getLastRow(), source.rowSelection.lastRow || sheet.getLastRow());
  const count = Math.max(0, last - source.startRow + 1);
  if (count > 20000 || count * checked.width > 500000) fail_('SOURCE_UNAVAILABLE');
  const rows = [];
  if (count) {
    const range = sheet.getRange(source.startRow, 1, count, checked.width);
    const values = range.getValues(), displays = range.getDisplayValues(), rich = range.getRichTextValues();
    const excluded = new Set(source.rowSelection.excludeRows);
    const labels = new Set(source.rowSelection.excludeExact.map(normalize_));
    values.forEach((row, index) => {
      const label = normalize_(row[source.rowSelection.requiredColumn - 1]);
      if (!label || excluded.has(source.startRow + index) || labels.has(label)) return;
      const result = { values: [], display: [] };
      source.columns.forEach(c => {
        if (c.column === null) {
          result.values.push(null);
          result.display.push('');
          return;
        }
        const position = c.column - 1;
        const value = row[position];
        let output = value === '' || value === null ? null : value;
        if (c.type === 'currency' || c.type === 'number') {
          if (output !== null && (typeof output !== 'number' || !Number.isFinite(output))) fail_('SCHEMA_MISMATCH');
          if (c.type === 'number' && output !== null && !Number.isSafeInteger(output)) fail_('SCHEMA_MISMATCH');
        } else if (c.type === 'date') {
          if (output !== null && (!(output instanceof Date) || !Number.isFinite(output.getTime()))) fail_('SCHEMA_MISMATCH');
          output = output === null ? null : Utilities.formatDate(output, 'America/Mexico_City', 'yyyy-MM-dd');
        } else if (c.type === 'link') {
          const richCell = rich[index][position];
          output = safeLink_(richCell && richCell.getLinkUrl()) || safeLink_(value);
        } else output = output === null ? null : String(output);
        result.values.push(output);
        result.display.push(String(displays[index][position] || ''));
      });
      rows.push(result);
    });
  }
  const result = {
    year: source.year, title: 'Consulta de honorarios ' + source.year,
    columns: source.columns.map(c => ({ title: c.title, type: c.type })), rows: rows,
    unavailableColumns: source.columns.map((c, index) => c.column === null ? index : -1).filter(index => index !== -1),
    loadedAt: new Date().toISOString(), sourceUpdatedAt: DriveApp.getFileById(source.spreadsheetId).getLastUpdated().toISOString(),
    timeZone: 'America/Mexico_City'
  };
  return result;
}

function auditSheet_() {
  const id = properties_().getProperty('AUDIT_SPREADSHEET_ID');
  if (!id) fail_('AUDIT_REQUIRED');
  const sheet = SpreadsheetApp.openById(id).getSheetByName('Bitacora');
  if (!sheet || sheet.getLastRow() < 1) fail_('AUDIT_REQUIRED');
  const expected = ['Fecha', 'Cuenta', 'Operacion', 'Revision', 'Estado', 'HashAnterior', 'HashNuevo'];
  const headers = sheet.getRange(1, 1, 1, 7).getDisplayValues()[0];
  if (expected.some((value, index) => normalize_(value) !== normalize_(headers[index]))) fail_('AUDIT_REQUIRED');
  return sheet;
}
