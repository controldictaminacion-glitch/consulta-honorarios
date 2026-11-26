import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, extname } from 'node:path';
import { validateDeploymentConfig } from './deployment.mjs';

const forbidden = [
  /[A-Z0-9._%+-]+@(?:gmail|hotmail|outlook)\.com/ig,
  /docs\.google\.com\/spreadsheets\/d\/[\w-]{20,}/g,
  /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/g,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
];
let failed = false;
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist'].includes(entry.name)) continue;
    const file = resolve(dir, entry.name);
    if (entry.isDirectory()) { await scan(file); continue; }
    const content = await readFile(file, 'utf8');
    // Los dos endpoints son públicos por diseño; sólo se permiten en config.json.
    // Los IDs de hojas, correos y secretos siguen prohibidos en todos los archivos.
    const deploymentUrl = /script\.google\.com\/(?:macros\/s|a\/macros\/[^/]+\/s)\/[\w-]{30,}/g;
    const runtimeConfig = file === resolve(process.cwd(), 'config.json');
    if (!runtimeConfig && deploymentUrl.test(content)) {
      console.error('Dirección real de servicio fuera de config.json en', file); failed = true;
    }
    if (runtimeConfig) {
      try {
        const config = JSON.parse(content);
        if (!config || Array.isArray(config) || Object.keys(config).some(key => !['apiUrl', 'adminUrl'].includes(key)) ||
            typeof config.apiUrl !== 'string' || typeof config.adminUrl !== 'string') throw new Error('Configuración pública inválida');
        if (config.apiUrl || config.adminUrl) validateDeploymentConfig(config);
      } catch {
        console.error('config.json debe contener sólo los dos endpoints públicos o ambos vacíos.'); failed = true;
      }
    }
    for (const rule of forbidden) {
      rule.lastIndex = 0;
      if (rule.test(content)) { console.error('Posible configuración privada en', file); failed = true; }
    }
    if (['.js', '.mjs', '.gs'].includes(extname(file).toLowerCase())) {
      const result = extname(file).toLowerCase() === '.gs'
        ? spawnSync(process.execPath, ['--check', '--input-type=commonjs'], { input: content, encoding: 'utf8' })
        : spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) { console.error(result.stderr); failed = true; }
    }
  }
}
await scan(process.cwd());
if (failed) process.exitCode = 1;
else console.log('Sintaxis y revisión de configuración privada correctas.');
