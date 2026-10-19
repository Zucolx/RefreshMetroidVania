import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { flatWorld, T } from './helpers.mjs';
import { validateWorld } from '../src/validate.js';
import { LEVELS } from '../src/levels/index.js';

test('los 6 niveles integrados pasan el validador (el teatro con trampillas abiertas)', () => {
  assert.equal(LEVELS.length, 6);
  for (const lv of LEVELS) {
    const w = lv.build();
    const r = validateWorld(w);
    assert.ok(r.ok, `${lv.id}: ${r.errors.join(' | ')}`);
  }
});

test('el CLI sale con código 0 y, ante un nivel desconocido, con código 2', () => {
  const out = execFileSync('node', ['tools/validar-niveles.mjs', 'forest'], { encoding: 'utf8' });
  assert.match(out, /forest/);
  const r = spawnSync('node', ['tools/validar-niveles.mjs', 'nada'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});

test('detecta zonas-trampa (un pozo profundo sin escalera)', () => {
  const w = flatWorld({ w: 60, h: 40, floor: 30 });
  w.fill(20, 30, 4, 8, T.AIR);     // pozo de 8 tiles de profundidad con suelo sólido abajo
  w.exit = { x: 50, y: 29 };
  const r = validateWorld(w);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /zona-trampa/.test(e)), r.errors.join('|'));
});

test('un pozo de pinchos no atrapa (devuelve a suelo seguro)', () => {
  const w = flatWorld({ w: 60, h: 40, floor: 30 });
  w.fill(20, 30, 3, 8, T.AIR); w.fill(20, 37, 3, 1, T.SPIKE);
  w.exit = { x: 50, y: 29 };
  const r = validateWorld(w);
  assert.ok(r.ok, r.errors.join('|'));
});

test('detecta salidas inalcanzables y puntos clave sin suelo firme', () => {
  const w = flatWorld({ w: 80, h: 40, floor: 30 });
  w.fill(30, 30, 20, 10, T.AIR);   // foso ancho (20 tiles) sin hazard abajo → trampa/inalcanzable
  w.exit = { x: 60, y: 29 };
  let r = validateWorld(w);
  assert.equal(r.ok, false);
  const v = flatWorld({ w: 60, h: 40, floor: 30 });
  v.exit = { x: 30, y: 20 };       // flotando
  r = validateWorld(v);
  assert.ok(r.errors.some((e) => /sin suelo firme/.test(e)));
});

test('el laboratorio exige salto alto y dash', () => {
  const lab = LEVELS.find((l) => l.id === 'lab');
  assert.equal(validateWorld(lab.build(), { abilities: ['jump', 'double', 'dash'] }).ok, false, 'sin salto alto falla');
  assert.equal(validateWorld(lab.build(), { abilities: ['jump', 'double', 'high'] }).ok, false, 'sin dash falla');
  assert.equal(validateWorld(lab.build()).ok, true);
});

test('escalones ≤ 3 tiles y escaleras cada 3 sobre el suelo real', () => {
  for (const lv of LEVELS) {
    const w = lv.build();
    for (const l of w.meta.ladders || []) {
      const rungs = l.rungs;
      assert.equal(rungs[0], l.yBottom - 3, `${lv.id}: primera plataforma a 3 tiles del suelo`);
      for (let i = 1; i < rungs.length; i++) assert.equal(rungs[i - 1] - rungs[i], 3);
      assert.ok(rungs[rungs.length - 1] - l.yTop <= 3);
    }
  }
});

test('checkpoints, amuletos y salida sobre suelo firme; amuleto de cada bioma presente', () => {
  const want = { forest: 'water', volcano: 'fire', valley: 'earth', castle: 'wind', theater: 'threads' };
  for (const lv of LEVELS) {
    const w = lv.build();
    for (const c of [...w.checkpoints, ...w.amulets, w.exit].filter(Boolean)) assert.equal(w.get(c.x, c.y + 1), T.SOLID);
    if (want[lv.id]) assert.deepEqual(w.amulets.map((a) => a.type), [want[lv.id]]);
    assert.ok(w.exit, `${lv.id} tiene salida`);
  }
});

test('el teatro es no lineal y tiene trampillas, cortinas, focos, cuerdas y noria', () => {
  const w = LEVELS.find((l) => l.id === 'theater').build();
  const types = new Set(w.props.map((p) => p.type));
  for (const t of ['trapdoor', 'curtain', 'spotlight', 'rope', 'ferris']) assert.ok(types.has(t), t);
  const enemies = new Set(w.enemies.map((e) => e.type));
  for (const t of ['marionette', 'shadow', 'mask', 'clown']) assert.ok(enemies.has(t), t);
});

test('serialización: toJSON/fromJSON conserva el nivel', async () => {
  const { World } = await import('../src/world.js');
  for (const lv of LEVELS) {
    const w = lv.build();
    const w2 = World.fromJSON(JSON.parse(JSON.stringify(w.toJSON())));
    assert.deepEqual(Array.from(w2.tiles), Array.from(w.tiles));
    assert.equal(w2.enemies.length, w.enemies.length);
    assert.equal(w2.theme, w.theme);
  }
});
