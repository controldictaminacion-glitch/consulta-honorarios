import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, extname } from 'node:path';

const forbidden = [
  /[A-Z0-9._%+-]+@(?:gmail|hotmail|outlook)\.com/ig,
  /docs\.google\.com\/spreadsheets\/d\/[\w-]{20,}/g,
  /script\.google\.com\/macros\/s\/[\w-]{30,}/g,
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
