#!/usr/bin/env node
// Validador de niveles: node tools/validar-niveles.mjs [nivel]
// Sale con código 1 si algún nivel tiene problemas. Sin dependencias.
import { LEVELS } from '../src/levels/index.js';
import { validateWorld } from '../src/validate.js';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const only = args.find((a) => !a.startsWith('-'));
const list = only ? LEVELS.filter((l) => l.id === only) : LEVELS;
if (!list.length) {
  console.error(`Nivel desconocido: ${only}. Disponibles: ${LEVELS.map((l) => l.id).join(', ')}`);
  process.exit(2);
}

let failed = 0;
for (const lv of list) {
  const t0 = Date.now();
  let world;
  try { world = lv.build(); } catch (e) {
    console.log(`✗ ${lv.id.padEnd(8)} error al construir: ${e.message}`);
    failed++;
    continue;
  }
  const r = validateWorld(world);
  const ms = Date.now() - t0;
  const head = `${r.ok ? '✓' : '✗'} ${lv.id.padEnd(8)} ${String(world.w).padStart(3)}×${world.h} · ${r.stats.reachable} posiciones alcanzables · habilidades [${r.stats.abilities.join(', ')}] · ${ms} ms`;
  console.log(head);
  for (const e of r.errors) console.log(`    ✗ ${e}`);
  if (verbose) for (const w of r.warnings) console.log(`    ! ${w}`);
  if (!r.ok) failed++;
}
if (failed) {
  console.log(`\n${failed} nivel(es) con problemas.`);
  process.exit(1);
}
console.log(`\n${list.length} nivel(es) validados sin errores.`);
