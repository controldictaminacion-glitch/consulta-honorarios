import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

// Sólo archivos públicos; nunca empaquetar backend, pruebas o configuración privada.
const root = process.cwd();
const target = resolve(root, 'dist');
if (target !== resolve(root, './dist')) throw new Error('Destino inválido');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const name of ['index.html', 'css', 'js', 'vendor', 'config.json', '.nojekyll']) {
  await cp(resolve(root, name), resolve(target, name), { recursive: true });
}
console.log('Paquete estático preparado en dist; no se ha publicado.');
