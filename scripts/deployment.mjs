import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function endpoint(value, admin) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Falta configurar la dirección del servicio de ' + (admin ? 'administración.' : 'consulta.')); }
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || url.port || url.username || url.password || url.hash ||
      !/^\/(?:macros\/s|a\/macros\/[^/]+\/s)\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) {
    throw new Error('La dirección debe ser un despliegue HTTPS /exec de Google Apps Script.');
  }
  const entries = [...url.searchParams];
  if (admin ? entries.length !== 1 || url.searchParams.get('action') !== 'admin' : entries.length !== 0) {
    throw new Error('La consulta no debe incluir parámetros; administración debe incluir únicamente action=admin.');
  }
  return url;
}

export function validateDeploymentConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config) ||
      Object.keys(config).some(key => !['apiUrl', 'adminUrl'].includes(key))) {
    throw new Error('config.json sólo puede contener apiUrl y adminUrl; la configuración de hojas permanece privada.');
  }
  const api = endpoint(config.apiUrl, false), admin = endpoint(config.adminUrl, true);
  if (api.pathname === admin.pathname) throw new Error('Configura despliegues separados para consulta y administración.');
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    validateDeploymentConfig(JSON.parse(await readFile('config.json', 'utf8')));
    console.log('Direcciones públicas configuradas. Esto no sustituye las pruebas de conexión y permisos.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
