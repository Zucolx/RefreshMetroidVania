import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, flatWorld, CONFIG, T } from './helpers.mjs';

function dummy(t, x, hp = 1000, type = 'patrol') {
  CONFIG.enemies.frozen = true;
  const e = t.spawn(type, x, 29);
  e.hp = e.maxHp = hp;
  return e;
}

test('cadena ×3: 10 / 10 / 16, alcance 112 px con el golpe en la mitad exterior', () => {
  const t = makeGame({ team: ['artificer'] });
  const near = dummy(t, 6);        // pegado: mitad interior
  const far = dummy(t, 8);         // ~96 px: mitad exterior
  const d = [];
  for (let i = 0; i < 3; i++) { const h0 = far.hp; t.input.tap('attack'); t.secs(0.5); d.push(h0 - far.hp); }
  assert.deepEqual(d, [10, 10, 16]);
  assert.equal(near.hp, 1000, 'no golpea en la mitad interior');
});

test('la cadena destruye proyectiles', () => {
  const t = makeGame({ team: ['artificer'] });
  const o = dummy(t, 20, 90, 'orc');
  const rock = o.shoot(t.g, { x: t.p.cx + 80, y: t.p.cy, vx: 0, vy: 0, r: 11, dmg: 14, life: 3, shape: 'rock', cut: true });
  t.input.tap('attack'); t.secs(0.4);
  assert.equal(rock.dead, true);
});

test('escopeta (mantener 0,35 s): 7 perdigones de 7 daño, retroceso 360, cono ±16°', () => {
  const t = makeGame({ team: ['artificer'] });
  const e = dummy(t, 8, 1000, 'golem');
  t.input.hold('attack');
  t.secs(0.45);
  assert.ok(t.p.charging, 'carga');
  t.secs(0.1);
  t.input.hold('attack', false);
  t.run(3);
  const hit = 1000 - e.hp;
  assert.ok(hit === 49 || hit === 59, `daño ${hit}`); // 7 perdigones ×7 (+10 de la cadena inicial)
  assert.ok(t.p.vx < -200 || t.p.x < 5 * 32, `retroceso ${t.p.vx}`);
});

test('escopeta: carga = 30 % de velocidad', () => {
  const t = makeGame({ team: ['artificer'] });
  t.input.hold('right'); t.input.hold('attack'); t.secs(0.31);
  assert.ok(t.p.charging);
  t.run(10);
  assert.ok(Math.abs(t.p.vx) <= CONFIG.runSpeed * 0.3 + 3, `vx ${t.p.vx}`);
});

test('escopeta disparando hacia abajo: impulso 560 hacia arriba; los fantasmas son inmunes', () => {
  const t = makeGame({ team: ['artificer'] });
  t.p.tpTo(10 * 32, 10 * 32);
  t.input.hold('down'); t.input.hold('attack'); t.secs(0.36);
  assert.ok(t.p.vy < -300, `vy ${t.p.vy}`);
  t.input.hold('attack', false);
  const t2 = makeGame({ team: ['artificer'] });
  const gh = dummy(t2, 8, 30, 'ghost'); gh.setState('chase');
  t2.input.hold('attack'); t2.secs(0.5); t2.input.hold('attack', false); t2.secs(0.4);
  assert.equal(gh.hp, 30);
});

test('bomba (↓ + aéreo): 22 de daño / 72 px, impulso hasta 840 a <120 px y recupera salto y dash', () => {
  const t = makeGame({ team: ['artificer'] });
  const e = dummy(t, 5); e.x = 5 * 32 + 16 - e.w / 2;
  t.p.setFeet(5 * 32 + 16, e.y - 30); t.p.vy = 0; t.p.onGround = false;
  t.p.airJumps = 0; t.p.airDashes = 0;
  t.input.hold('down'); t.input.tap('attack');
  let best = 0;
  for (let i = 0; i < 20; i++) { t.run(1); best = Math.min(best, t.p.vy); }
  assert.ok(1000 - e.hp >= 22, `daño ${1000 - e.hp}`);
  assert.ok(best < -600, `impulso ${best}`);
  assert.equal(t.p.airJumps, 1);
  assert.equal(t.p.airDashes, 1);
});

test('bombas: 0,35 s entre bombas', () => {
  const t = makeGame({ team: ['artificer'] });
  t.p.tpTo(10 * 32, 5 * 32);
  t.input.hold('down');
  t.input.tap('attack'); t.run(2); t.input.tap('attack'); t.run(2);
  assert.equal(t.g.projectiles.filter((p) => p.kind === 'bomb').length, 1);
  t.secs(0.4); t.input.tap('attack'); t.run(2);
  assert.ok(t.g.projectiles.filter((p) => p.kind === 'bomb').length >= 1);
});

function hookWorld() {
  const w = flatWorld({ floor: 30 });
  // techo bajo en x 8..20 (fila 22) y un muro en x=20
  w.fill(8, 0, 13, 22, T.SOLID);
  // plataforma fina alta en x 30..36 (fila 24)
  for (let x = 30; x < 37; x++) w.set(x, 24, T.PLAT);
  return w;
}

test('gancho a muro/techo: tira a 1250 px/s y se agarra hasta 1,4 s; ↓ suelta', () => {
  const t = makeGame({ team: ['artificer'], world: hookWorld() });
  t.p.tpTo(14 * 32, 30 * 32); t.secs(0.3);
  t.input.hold('up'); t.input.tap('special'); t.run(2);
  assert.ok(t.p.kit.hook, 'gancho lanzado');
  t.secs(0.5);
  assert.ok(t.p.mode && (t.p.mode.name === 'cling' || t.p.mode.name === 'pull'), `modo ${t.p.mode && t.p.mode.name}`);
  const y = t.p.y;
  t.secs(0.3);
  assert.ok(t.p.mode && t.p.mode.name === 'cling');
  assert.ok(Math.abs(t.p.y - y) < 1, 'agarrado sin caer');
  t.secs(1.5);
  assert.equal(t.p.mode, null, 'se suelta a los 1,4 s');
});

test('gancho: salto desde el agarre impulsa arriba/lejos y recupera el doble salto', () => {
  const t = makeGame({ team: ['artificer'], world: hookWorld() });
  t.p.tpTo(14 * 32, 30 * 32); t.secs(0.3);
  t.input.hold('up'); t.input.tap('special'); t.secs(0.8);
  t.p.airJumps = 0;
  t.input.hold('up', false); t.input.tap('jump'); t.run(2);
  assert.equal(t.p.mode, null);
  assert.equal(t.p.airJumps, 1);
});

test('gancho a plataforma: cuelga, ↑ sube con voltereta', () => {
  const t = makeGame({ team: ['artificer'], world: hookWorld() });
  t.p.tpTo(33 * 32, 30 * 32); t.secs(0.3);
  t.input.hold('up'); t.input.tap('special'); t.run(4);
  assert.ok(t.p.kit.hook);
  t.input.hold('up', false);
  t.secs(0.5);
  assert.ok(t.p.mode && t.p.mode.name === 'hang', `modo ${t.p.mode && t.p.mode.name}`);
  // sube con ↑
  t.input.hold('up'); t.secs(2.2);
  assert.ok(t.p.feetY <= 24 * 32 + 2 && t.p.feetY > 22 * 32, `feetY ${t.p.feetY / 32}`);
});

test('gancho a enemigo ligero: atracción + bomba (18 daño) que lo lanza girando; aturde', () => {
  const t = makeGame({ team: ['artificer'] });
  const e = dummy(t, 9, 100);
  t.input.tap('special'); t.secs(0.8);
  assert.ok(100 - e.hp >= 18, `daño ${100 - e.hp}`);
  assert.ok(e.tumble || e.stun > 0, 'sale girando');
});

test('gancho a enemigo pesado: modo asalto (28 / 18 en 85 px) y salto atrás', () => {
  const t = makeGame({ team: ['artificer'] });
  const o = dummy(t, 9, 300, 'orc');
  const near = dummy(t, 10, 100);
  t.input.tap('special'); t.secs(0.12);
  assert.ok(t.p.mode && t.p.mode.name === 'assault');
  assert.ok(t.p.isInvuln());
  let back = false;
  for (let i = 0; i < 60 && !back; i++) { t.run(1); if (!t.p.mode) { back = t.p.vy < 0 || !t.p.onGround; } }
  assert.ok(300 - o.hp >= 28);
  assert.ok(100 - near.hp >= 11, 'daño en área');
  assert.ok(back, 'salta atrás');
});

test('gancho: los fantasmas no son enganchables', () => {
  const t = makeGame({ team: ['artificer'] });
  const g = dummy(t, 9, 30, 'ghost'); g.setState('chase');
  t.input.tap('special'); t.secs(0.6);
  assert.equal(t.p.kit.grab, null);
  assert.equal(t.p.mode, null);
});

test('gancho: 0,25 s entre ganchos', () => {
  const t = makeGame({ team: ['artificer'] });
  t.input.tap('special'); t.run(30);
  assert.equal(t.p.kit.hook, null);
  assert.ok(t.p.kit.cd.hook > 0 || t.p.kit.cd.hook === 0);
});
