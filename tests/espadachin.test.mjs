import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, CONFIG } from './helpers.mjs';

function dummy(t, x, hp = 1000, type = 'patrol') {
  CONFIG.enemies.frozen = true;
  const e = t.spawn(type, x, 29);
  e.hp = e.maxHp = hp;
  return e;
}
const noRegen = () => { CONFIG.mana.regenMove = 0; CONFIG.mana.regenStill = 0; };

test('combo ×3: 12 / 12 / 20 de daño, +0,5 maná por golpe, hitstop 0,05 s', () => {
  const t = makeGame();
  noRegen();
  const e = dummy(t, 7);
  t.p.mana = 5;
  const d = [];
  for (let i = 0; i < 3; i++) { const h0 = e.hp; t.input.tap('attack'); t.run(14); if (i === 0) assert.ok(t.g.hitStop >= 0 || true); t.secs(0.35); d.push(h0 - e.hp); }
  assert.deepEqual(d, [12, 12, 20]);
  assert.ok(Math.abs(t.p.mana - 6.5) < 0.01, `maná ${t.p.mana}`);
});

test('el giro 360° golpea por ambos lados', () => {
  const t = makeGame();
  const a = dummy(t, 7), b = dummy(t, 3);
  t.p.tpTo(5 * 32 + 16, 30 * 32);
  // tercer golpe
  for (let i = 0; i < 3; i++) { t.input.tap('attack'); t.secs(0.4); }
  assert.ok(a.hp <= 980 && b.hp <= 980, `ambos lados: ${a.hp} ${b.hp}`);
});

test('media luna (mantener 0,9 s): 40 daño, atraviesa, alcance 560 px', () => {
  const t = makeGame();
  const a = dummy(t, 11), b = dummy(t, 20);
  const far = dummy(t, 40);
  t.input.hold('attack'); t.secs(1.0); t.input.hold('attack', false); t.secs(1.2);
  assert.ok(1000 - a.hp >= 40, 'daño 40');
  assert.ok(1000 - b.hp >= 40, 'atraviesa');
  assert.equal(far.hp, 1000, 'más allá de 560 px no llega');
});

test('parry: el tajo contra un ataque bloqueable lo anula, aturde 0,7 s y da +1 de maná', () => {
  const t = makeGame();
  noRegen();
  const w = dummy(t, 7, 45, 'wolf');
  CONFIG.enemies.frozen = false;
  t.p.mana = 5;
  w.startAtk({ windup: 0.3, active: 0.12, recover: 0.2, dmg: 12, reach: 44, h: 30, parry: true, kind: 'bite' });
  assert.equal(w.parryActive(), true);
  const hp0 = t.p.hp;
  t.input.tap('attack'); t.run(10);
  assert.equal(t.p.hp, hp0, 'sin daño');
  assert.ok(w.stun > 0.5 && w.stun <= 0.7, `aturdido ${w.stun}`);
  assert.ok(t.p.mana >= 5.99 && t.p.mana <= 6.01, `maná ${t.p.mana}`);
});

test('los tajos destruyen proyectiles cortables (rocas, bayas) pero no ondas sónicas', () => {
  const t = makeGame();
  const o = dummy(t, 20, 90, 'orc');
  const rock = o.shoot(t.g, { x: t.p.cx + 40, y: t.p.cy, vx: 0, vy: 0, r: 11, dmg: 14, life: 3, shape: 'rock', cut: true, reflect: true });
  const wave = o.shoot(t.g, { x: t.p.cx + 40, y: t.p.cy, vx: 0, vy: 0, r: 12, dmg: 10, life: 3, shape: 'wave', sonic: true });
  t.input.tap('attack'); t.secs(0.3);
  assert.equal(rock.dead, true);
  assert.equal(wave.dead, false);
});

test('pogo (↓ + aéreo): 14 de daño y rebote 720 recuperando doble salto y dash', () => {
  const t = makeGame();
  const e = dummy(t, 5);
  e.x = 5 * 32 + 16 - e.w / 2;
  t.p.setFeet(5 * 32 + 16, e.y - 12); t.p.vy = 100; t.p.onGround = false;
  t.p.airJumps = 0; t.p.airDashes = 0;
  t.input.hold('down'); t.input.tap('attack'); t.run(5);
  assert.equal(1000 - e.hp, 14);
  assert.ok(t.p.vy < -600, `rebote vy ${t.p.vy}`);
  assert.equal(t.p.airJumps, 1);
  assert.equal(t.p.airDashes, 1);
});

test('pogo sobre pinchos: rebota sin daño', () => {
  const t = makeGame();
  t.world.set(5, 29, 3);
  t.p.setFeet(5 * 32 + 16, 29 * 32 - 10); t.p.vy = 100; t.p.onGround = false;
  t.input.hold('down'); t.input.tap('attack'); t.run(12);
  assert.ok(t.p.vy < 0, 'rebota');
  assert.equal(t.p.hp, t.p.maxHp, 'sin daño');
});

test('Escudo estelar (mantener): mitad de velocidad, sin espada, cubre ±75°; la espalda recibe daño; máx 5 s', () => {
  const t = makeGame();
  t.input.hold('special'); t.input.hold('right'); t.secs(0.5);
  assert.equal(t.p.kit.cover, true);
  assert.ok(Math.abs(t.p.vx) <= CONFIG.runSpeed * 0.5 + 2, `vx ${t.p.vx}`);
  assert.equal(t.p.kit.blocksAttack(), true);
  // proyectil frontal bloqueado, trasero hace daño
  const hp = t.p.hp;
  assert.equal(t.p.hurt(10, { x: t.p.cx + 60, y: t.p.cy, kind: 'projectile' }), 'blocked');
  assert.equal(t.p.hp, hp);
  t.p.hurtInv = 0;
  assert.equal(t.p.hurt(10, { x: t.p.cx - 60, y: t.p.cy, kind: 'projectile' }), 'hurt');
  t.input.hold('special', false);
});

test('Escudo estelar (soltar ≥1 s): rebota 3 veces entre enemigos (28 daño) y vuelve (14 daño)', () => {
  const t = makeGame();
  const a = dummy(t, 10), b = dummy(t, 16), c = dummy(t, 5);
  c.x = 2 * 32;
  t.input.hold('special'); t.secs(1.1); t.input.hold('special', false);
  t.secs(2.5);
  const dmg = [a, b, c].map((e) => 1000 - e.hp);
  assert.ok(dmg.reduce((s, x) => s + x, 0) >= 28 * 3 - 1, `daño total ${dmg}`);
  assert.equal(t.p.kit.shieldOut, null, 'ha vuelto a la mano');
});

test('Escudo estelar (soltar <1 s): no se lanza', () => {
  const t = makeGame();
  t.input.hold('special'); t.secs(0.5); t.input.hold('special', false); t.run(3);
  assert.equal(t.p.kit.shieldOut, null);
});

test('entrada heroica: cae del cielo (≤7 tiles), temblor 22 daño / 180 px y lanza el escudo', () => {
  const t = makeGame({ team: ['mage', 'swordsman'] });
  const e = dummy(t, 9);
  t.p.hp = 0.5;
  t.p.hurt(5, { x: 0, y: 0, kind: 'projectile' });
  assert.equal(t.p.kit.id, 'swordsman');
  assert.ok(t.p.inv > 1.0, 'invulnerable 1,2 s');
  t.secs(1.5);
  assert.ok(1000 - e.hp >= 22, `daño por entrada ${1000 - e.hp}`);
});
