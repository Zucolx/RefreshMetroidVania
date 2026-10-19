// Copia el juego estático a dist/ (sin bundler ni dependencias). Uso: node tools/build-web.mjs [carpeta]
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raíz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destino = resolve(raíz, process.argv[2] || 'dist');

rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
for (const f of ['index.html', 'style.css', 'manifest.webmanifest', 'assets', 'src']) {
  if (!existsSync(resolve(raíz, f))) continue;
  cpSync(resolve(raíz, f), resolve(destino, f), { recursive: true });
}
console.log('Build web listo en', destino);
