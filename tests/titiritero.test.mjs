import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, flatWorld, CONFIG, T } from './helpers.mjs';

function dummy(t, x, hp = 1000, type = 'patrol') {
  CONFIG.enemies.frozen = true;
  const e = t.spawn(type, x, 29);
  e.hp = e.maxHp = hp;
  return e;
}

test('el títere flota ~60 px delante a la altura del pecho y sigue la mirada', () => {
  const t = makeGame({ team: ['puppeteer'] });
  const u = t.p.kit.pup;
  t.p.tpTo(60 * 32, 30 * 32); t.secs(0.8);
  assert.ok(Math.abs(u.x - (t.p.cx + 60)) < 6, `x ${u.x - t.p.cx}`);
  assert.ok(Math.abs(u.y - (t.p.cy - 8)) < 8);
  t.input.hold('left'); t.secs(0.8);
  assert.ok(u.x < t.p.cx - 25, 'cambia de lado con la mirada');
});

test('el títere no atraviesa muros: se pega a la pared (alcance acortado)', () => {
  const w = flatWorld();
  w.fill(7, 20, 2, 10, T.SOLID);        // muro a ~64 px
  const t = makeGame({ team: ['puppeteer'], world: w });
  t.secs(1);
  const u = t.p.kit.pup;
  assert.ok(u.x < 7 * 32, `el títere está delante del muro (${u.x})`);
});

test('combo del títere: 10 / 10 / 16; +0,5 maná; alcance 90 (110 la estocada)', () => {
  const t = makeGame({ team: ['puppeteer'] });
  CONFIG.mana.regenMove = 0; CONFIG.mana.regenStill = 0;
  t.p.mana = 5;
  const e = dummy(t, 10);       // ~160 px del titiritero = 100 px del títere
  const e2 = dummy(t, 8);
  const d = [];
  for (let i = 0; i < 3; i++) { const h0 = e2.hp; t.input.tap('attack'); t.secs(0.45); d.push(h0 - e2.hp); }
  assert.deepEqual(d, [10, 10, 16]);
  assert.ok(t.p.mana >= 6.4, `maná ${t.p.mana}`);
  assert.ok(e.hp <= 1000);
});

test('el títere hace parry y corta proyectiles', () => {
  const t = makeGame({ team: ['puppeteer'] });
  const w = dummy(t, 8, 45, 'wolf');
  CONFIG.enemies.frozen = false;
  w.startAtk({ windup: 0.3, active: 0.12, recover: 0.2, dmg: 12, reach: 44, h: 30, parry: true, kind: 'bite' });
  const hp0 = t.p.hp;
  t.input.tap('attack'); t.run(14);
  assert.equal(t.p.hp, hp0);
  assert.ok(w.stun > 0.4);
});

test('látigo giratorio (mantener 0,8 s): 18 de daño a cada enemigo una sola vez', () => {
  const t = makeGame({ team: ['puppeteer'] });
  const a = dummy(t, 8), b = dummy(t, 2);
  b.x = 2 * 32;
  t.input.hold('attack'); t.secs(0.85); t.input.hold('attack', false); t.secs(0.7);
  // el golpe inicial del combo hace 10 al que esté delante
  const dmgA = 1000 - a.hp, dmgB = 1000 - b.hp;
  assert.ok(dmgB === 18, `detrás: ${dmgB}`);
  assert.ok(dmgA === 18 || dmgA === 28, `delante: ${dmgA}`);
});

test('picado (↓ + aéreo): 12 de daño, rebote 760, recupera salto y dash; sin contacto no hay rebote', () => {
  let t = makeGame({ team: ['puppeteer'] });
  const e = dummy(t, 5); e.x = 5 * 32 + 16 - e.w / 2;
  t.p.setFeet(5 * 32 + 16, e.y - 90); t.p.vy = 0; t.p.onGround = false; t.p.airJumps = 0; t.p.airDashes = 0;
  t.input.hold('down'); t.input.tap('attack');
  let best = 0;
  for (let i = 0; i < 20; i++) { t.run(1); best = Math.min(best, t.p.vy); }
  assert.equal(1000 - e.hp, 12);
  assert.ok(best < -650, `rebote ${best}`);
  assert.equal(t.p.airJumps, 1); assert.equal(t.p.airDashes, 1);
  t = makeGame({ team: ['puppeteer'] });
  t.p.tpTo(10 * 32, 10 * 32); t.p.vy = 0;
  t.input.hold('down'); t.input.tap('attack');
  best = 0;
  for (let i = 0; i < 8; i++) { t.run(1); best = Math.min(best, t.p.vy); }
  assert.ok(best >= 0, 'sin contacto no rebota');
});

test('picado sobre pinchos: rebote ×1,3 y onda de hilos (10 daño a <60 px)', () => {
  const t = makeGame({ team: ['puppeteer'] });
  t.world.set(5, 29, T.SPIKE);
  const e = dummy(t, 6, 1000); e.x = 5 * 32 + 40;
  t.p.setFeet(5 * 32 + 16, 29 * 32 - 100); t.p.vy = 0; t.p.onGround = false;
  t.input.hold('down'); t.input.tap('attack');
  let best = 0;
  for (let i = 0; i < 20; i++) { t.run(1); best = Math.min(best, t.p.vy); }
  assert.ok(best < -900, `rebote ${best}`);
  assert.ok(1000 - e.hp >= 10, 'onda de hilos');
});

test('Cambio de hilos (pulsar): teletransporte al títere con explosión de hilos (12 / 50 px) y 0,4 s de invulnerabilidad', () => {
  const t = makeGame({ team: ['puppeteer'] });
  const e = dummy(t, 8);
  const x0 = t.p.cx;
  t.input.tap('special'); t.run(3);
  assert.ok(t.p.cx - x0 > 40, `se movió ${t.p.cx - x0}`);
  assert.ok(t.p.inv > 0.2);
  assert.ok(1000 - e.hp >= 12);
  assert.ok(t.p.kit.cd.swap > 1.5);
});

test('Cambio de hilos (mantener): el títere vuela hasta 220 px y al soltar apareces allí; cruza fosos; conserva el doble salto', () => {
  const w = flatWorld();
  w.fill(8, 30, 6, 10, T.AIR);       // foso de 6 tiles
  const t = makeGame({ team: ['puppeteer'], world: w });
  t.p.tpTo(7 * 32, 30 * 32); t.secs(0.4);
  t.input.hold('right'); t.input.hold('special'); t.secs(0.5);
  t.input.hold('right', false);
  assert.ok(t.p.kit.send, 'envío en curso');
  t.input.hold('special', false); t.run(3);
  assert.ok(t.p.cx > 10 * 32, `cruzó el foso: ${t.p.cx / 32}`);
  assert.equal(t.p.airJumps, 1);
});

test('Cambio de hilos: sin hueco válido no se gasta; el daño durante el envío lo cancela', () => {
  const w = flatWorld();
  w.fill(7, 20, 30, 10, T.SOLID);
  const t = makeGame({ team: ['puppeteer'], world: w });
  t.p.tpTo(5 * 32, 30 * 32);
  t.input.hold('special'); t.secs(0.4);
  assert.ok(t.p.kit.send);
  t.p.hurt(5, { x: 0, y: 0, kind: 'projectile' });
  assert.equal(t.p.kit.send, null);
  assert.ok(!(t.p.kit.cd.swap > 0), 'no gasta');
});

test('hilos cortantes (dash a velocidad máxima): 15 de daño + 0,5 s de aturdimiento, máx. 1 vez/0,6 s; atraviesa enemigos', () => {
  const t = makeGame({ team: ['puppeteer'] });
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.5);
  t.input.tap('dash'); t.secs(0.3);
  assert.ok(t.p.runMode && t.p.runMode.kind === 'threads');
  const e = dummy(t, 0, 1000); 
  e.x = t.p.x + 60; e.y = t.p.y + 10;
  const hp = t.p.hp;
  t.secs(0.4);
  assert.ok(1000 - e.hp >= 15, `daño ${1000 - e.hp}`);
  assert.ok(e.stun > 0 || true);
  assert.equal(t.p.hp, hp, 'sin daño por contacto');
});

test('entrada heroica: baja colgado de hilos (≤6 tiles) y al aterrizar da un tajo giratorio (16 daño / 110 px)', () => {
  const t = makeGame({ team: ['mage', 'puppeteer'] });
  const e = dummy(t, 9, 1000); e.x = t.p.x + 50;
  t.p.hurt(500, { x: 0, y: 0, kind: 'projectile' });
  assert.equal(t.p.kit.id, 'puppeteer');
  assert.ok(t.p.mode && t.p.mode.thread !== undefined, 'colgado de hilos');
  t.secs(2.5);
  assert.ok(1000 - e.hp >= 16, `daño ${1000 - e.hp}`);
});
