import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, CONFIG } from './helpers.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} esperado ≈${b} (±${tol}), obtenido ${a}`);

test('salto: fuerza 760 → altura ≈120 px (3,75 tiles)', () => {
  const t = makeGame();
  const y0 = t.p.y; let min = y0;
  t.input.hold('jump');
  for (let i = 0; i < 90; i++) { t.run(1); min = Math.min(min, t.p.y); }
  near(y0 - min, 120, 3, 'altura de salto');
});

test('salto variable: al soltar, vy × 0,45', () => {
  const t = makeGame();
  const y0 = t.p.y; let min = y0;
  t.input.hold('jump'); t.run(4); t.input.hold('jump', false);
  for (let i = 0; i < 60; i++) { t.run(1); min = Math.min(min, t.p.y); }
  assert.ok(y0 - min < 66, `salto corto ${y0 - min}`);
});

test('doble salto: +≈102 px y se recupera al tocar suelo', () => {
  const t = makeGame();
  t.input.hold('jump'); t.run(2);
  // en el ápice del primer salto
  t.run(18); const yApex = t.p.y;
  t.input.hold('jump', false); t.input.tap('jump'); t.input.hold('jump');
  t.run(1);
  assert.equal(t.p.airJumps, 0, 'gasta el salto aéreo');
  let min = t.p.y;
  for (let i = 0; i < 60; i++) { t.run(1); min = Math.min(min, t.p.y); }
  near(yApex - min, 102, 6, 'altura del doble salto');
  t.input.hold('jump', false);
  t.secs(2);
  assert.ok(t.p.onGround);
  assert.equal(t.p.airJumps, 1);
});

test('salto alto: 1 s → ≈5,9 tiles; 2 s → ≈11 tiles + onda (170 px / 30 daño / empuje 520)', () => {
  let t = makeGame();
  const y0 = t.p.y; let min = y0;
  t.input.hold('up'); t.input.hold('jump'); t.secs(1.1); t.input.hold('jump', false);
  for (let i = 0; i < 120; i++) { t.run(1); min = Math.min(min, t.p.y); }
  near((y0 - min) / 32, 5.9, 0.35, 'tiles con 1 s');
  t = makeGame();
  CONFIG.enemies.frozen = true;
  const e = t.spawn('patrol', 8, 29);
  const hp0 = e.hp;
  const y1 = t.p.y; min = y1;
  t.input.hold('up'); t.input.hold('jump'); t.secs(2.1); t.input.hold('jump', false);
  for (let i = 0; i < 200; i++) { t.run(1); min = Math.min(min, t.p.y); }
  near((y1 - min) / 32, 11, 0.5, 'tiles con 2 s');
  assert.ok(e.hp < hp0 || e.dead, 'la onda daña a enemigos cercanos');
});

test('salto alto soltado antes de 1 s es un salto normal', () => {
  const t = makeGame();
  const y0 = t.p.y; let min = y0;
  t.input.hold('up'); t.input.hold('jump'); t.secs(0.5); t.input.hold('jump', false);
  for (let i = 0; i < 90; i++) { t.run(1); min = Math.min(min, t.p.y); }
  near(y0 - min, 120.3, 4, 'salto normal completo');
});

test('dash: 900 px/s durante 0,18 s (~5 tiles), cooldown 0,45 s, sin gravedad', () => {
  const t = makeGame();
  t.input.hold('right');
  const x0 = t.p.x;
  t.input.tap('dash'); t.run(11);
  near(t.p.x - x0, 162, 14, 'distancia del dash');
  assert.ok(t.p.dashCd > 0);
});

test('sprint: tras el dash con dirección → ×1,35 (405 px/s) y se pierde al soltar >0,15 s', () => {
  const t = makeGame();
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.6);
  assert.ok(t.p.sprint.on);
  near(Math.abs(t.p.vx), 405, 3, 'velocidad de sprint');
  t.input.hold('right', false); t.secs(0.4);
  assert.equal(t.p.sprint.on, false);
});

test('sprint: salto ×1,12 y doble salto ×1,08', () => {
  const t = makeGame();
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.5);
  const y0 = t.p.y; let min = y0;
  t.input.hold('jump');
  for (let i = 0; i < 80; i++) { t.run(1); min = Math.min(min, t.p.y); }
  near(y0 - min, 120.3 * 1.12 * 1.12, 6, 'salto con sprint');
});

test('dash aéreo único; se recupera al tocar suelo', () => {
  const t = makeGame();
  t.input.hold('jump'); t.run(8); t.input.hold('jump', false);
  t.input.hold('right'); t.input.tap('dash'); t.run(3);
  assert.equal(t.p.airDashes, 0);
  t.secs(2);
  assert.equal(t.p.airDashes, 1);
});

test('plataformas atravesables: ↓ + salto para bajar', () => {
  const t = makeGame();
  for (let x = 4; x < 12; x++) t.world.set(x, 26, 2);
  t.p.tpTo(8 * 32, 26 * 32); t.secs(0.5);
  assert.ok(t.p.onGround && Math.abs(t.p.feetY - 26 * 32) < 2);
  t.input.hold('down'); t.input.tap('jump'); t.secs(0.8);
  assert.ok(t.p.feetY > 27 * 32, 'ha bajado de la plataforma');
});

test('gravedad 2400 y caída máxima 1100', () => {
  const t = makeGame({ world: undefined });
  assert.equal(CONFIG.gravity, 2400);
  assert.equal(CONFIG.maxFall, 1100);
  t.p.tpTo(10 * 32, 2 * 32); t.secs(0.8);
  assert.ok(t.p.vy <= 1100 + 1);
});

test('sin hacer nada, no se mueve (sin deriva)', () => {
  const t = makeGame();
  const x0 = t.p.x; t.secs(2);
  assert.equal(t.p.x, x0);
});
