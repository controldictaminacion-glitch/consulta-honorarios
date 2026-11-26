import {validateData, validUrl} from './core.js';
const TTL = 60000;
const cache = new Map();
export async function readConfig() {
  const response = await fetch('./config.json', {cache: 'no-store'});
  if (!response.ok) throw new Error('No se pudo leer la configuración del servicio.');
  const config = await response.json();
  for (const key of ['apiUrl', 'adminUrl']) {
    if (config[key] && (!validUrl(config[key]) || new URL(config[key]).protocol !== 'https:')) throw new Error('La dirección configurada debe usar HTTPS.');
  }
  return config;
}
async function request(config, action, year, options = {}) {
  if (!config.apiUrl) throw new Error('Servicio pendiente de configuración. La consulta se habilitará después de validar las fuentes.');
  const url = new URL(config.apiUrl);
  url.searchParams.set('action', action);
  if (year != null) url.searchParams.set('year', year);
  if (options.force) url.searchParams.set('refresh', '1');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, {once: true});
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
  try {
    const response = await fetch(url, {signal: controller.signal, credentials: 'omit', redirect: 'follow', cache: 'no-store'});
    if (!response.ok) throw new Error('El servicio de consulta no está disponible.');
    const result = await response.json();
    if (result.error || result.ok === false) throw new Error('El servicio no pudo validar esta consulta. Revisa la configuración de las fuentes.');
    return result;
  } catch (error) {
    if (timedOut) throw new Error('El servicio tardó demasiado en responder. Puedes volver a intentarlo.');
    throw error;
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}
export async function getYears(config, options = {}) {
  if (config.demo) return {years: [{year: 2025, enabled: true}, {year: 2026, enabled: true}], defaultYear: 2026};
  const result = await request(config, 'years', null, options);
  if (!Array.isArray(result.years) || !result.years.every(item => Number.isInteger(item.year) && item.year >= 2000 && item.year <= 2100 && typeof item.enabled === 'boolean') || !result.years.some(item => item.enabled && item.year === result.defaultYear)) throw new Error('La lista de ejercicios no es válida.');
  return result;
}
export async function getData(config, year, options = {}) {
  const key = `${config.demo ? 'demo' : config.apiUrl}:${year}`;
  const saved = cache.get(key);
  if (!options.force && saved && Date.now() - saved.at < TTL) return saved.data;
  const result = config.demo ? demoData(year) : await request(config, 'data', year, options);
  const data = validateData(result, year);
  if (!options.signal?.aborted) cache.set(key, {at: Date.now(), data});
  return data;
}
export function demoData(year) {
  const columns = [
    ['No.', 'text'], ['Órgano de la APCDMX', 'text'], ['Financiamiento', 'text'], ['Inicio', 'date'], ['Término', 'date'], ['Folios', 'number'], ['Costo total', 'currency'], ['Oficio', 'text'], ['Tipo de ingreso', 'text'], ['Procedencia', 'link'], ['Costo del dictamen', 'currency']
  ].map(([title, type]) => ({title, type}));
  const rows = Array.from({length: 64}, (_, i) => {
    const values = [String(i + 1).padStart(3, '0'), ['Órgano demostrativo Álamo', 'Entidad demostrativa Sur', 'Dependencia demostrativa Centro', 'Órgano demostrativo Norte'][i % 4], `Financiamiento de prueba ${i % 3 + 1}`, `${year}-01-01`, `${year}-12-31`, i % 9 + 1, (i + 1) * (year === 2025 ? 1000 : 1200) + 0.25, `DEMO-${year}-${i + 1}`, ['SUN', 'FUERA_SUN'][i % 2], null, i % 11 === 0 ? null : (i + 1) * 600 + 0.5];
    return {values, display: values.map(value => value == null ? '' : String(value))};
  });
  return {year: Number(year), title: `Demostración de honorarios ${year}`, columns, rows, loadedAt: new Date().toISOString(), sourceUpdatedAt: null, timeZone: 'America/Mexico_City'};
}
