import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, CONFIG, T } from './helpers.mjs';

function dummy(t, x, hp = 1000, type = 'patrol') {
  CONFIG.enemies.frozen = true;
  const e = t.spawn(type, x, 29);
  e.hp = e.maxHp = hp;
  return e;
}

test('combo de frascos: 8 / 8 / 14, el tercero más grande; dan maná; 0,24 s de combo', () => {
  const t = makeGame({ team: ['alchemist'] });
  CONFIG.mana.regenMove = 0; CONFIG.mana.regenStill = 0;
  t.p.mana = 5;
  const e = dummy(t, 13);   // el frasco describe un arco: cae a ~240 px
  for (let i = 0; i < 3; i++) { t.input.tap('attack'); t.secs(0.3); }
  t.secs(1.2);
  assert.equal(1000 - e.hp, 8 + 8 + 14);
  assert.ok(t.p.mana > 5.9, `maná ${t.p.mana}`);
});

test('frasco con ↑: arco más alto y corto', () => {
  const t = makeGame({ team: ['alchemist'] });
  t.input.tap('attack'); t.run(3);
  const f1 = t.g.projectiles.find((p) => p.kind === 'flask');
  const vy1 = f1.vy, vx1 = f1.vx;
  const t2 = makeGame({ team: ['alchemist'] });
  t2.input.hold('up'); t2.input.tap('attack'); t2.run(3);
  const f2 = t2.g.projectiles.find((p) => p.kind === 'flask');
  assert.ok(f2.vy < vy1 && Math.abs(f2.vx) < Math.abs(vx1));
});

test('los frascos destruyen proyectiles; fantasmas inmunes; las armaduras no contraatacan', () => {
  const t = makeGame({ team: ['alchemist'] });
  const gh = dummy(t, 9, 30, 'ghost'); gh.setState('chase');
  const ar = dummy(t, 12, 140, 'armor'); ar.setState('awake');
  t.input.tap('attack'); t.secs(1);
  assert.equal(gh.hp, 30);
  for (let i = 0; i < 4; i++) { t.g.damageEnemy(ar, 1, { kind: 'flask' }); }
  assert.equal(ar.cover, 0, 'sin contraataque');
});

test('frasco ácido (mantener 0,9 s): 10 de daño + charco de 96 px durante 4 s (3 daño/s); no daña al alquimista', () => {
  const t = makeGame({ team: ['alchemist'] });
  const e = dummy(t, 15, 1000);
  t.input.hold('attack'); t.secs(1.0); t.input.hold('attack', false);
  t.secs(1.2);
  const z = t.g.zones.find((q) => q.kind === 'acid');
  assert.ok(z, 'charco');
  assert.equal(z.r <= 96 && z.r > 60, true);
  assert.ok(Math.abs(z.life - (4 - 0)) < 3.5);
  // el enemigo en el charco recibe 3 daño/s
  e.x = z.x - e.w / 2; e.y = z.y - e.h;
  const h0 = e.hp; t.secs(2);
  assert.ok(h0 - e.hp >= 5 && h0 - e.hp <= 7.1, `ácido ${h0 - e.hp}`);
  assert.equal(t.p.hp, t.p.maxHp);
  t.secs(3);
  assert.equal(t.g.zones.filter((q) => q.kind === 'acid').length, 0);
});

test('frasco ácido en el aire: cae al suelo y se ajusta al borde de la plataforma', () => {
  const t = makeGame({ team: ['alchemist'] });
  // plataforma estrecha (4 tiles) en la fila 20
  for (let x = 20; x < 24; x++) t.world.set(x, 20, T.SOLID);
  const e = dummy(t, 5);
  void e;
  t.p.kit.puddle(t.g, 20 * 32 + 8, 19 * 32);
  const z = t.g.zones.find((q) => q.kind === 'acid');
  assert.ok(z.x - z.r >= 20 * 32 - 8 && z.x + z.r <= 24 * 32 + 8, `puddle ${z.x - z.r}..${z.x + z.r}`);
});

test('inestable (↓ + aéreo): 12 daño, impulso hasta 800 y recupera doble salto; sobre pinchos ×1,5 y vapores 3 s', () => {
  let t = makeGame({ team: ['alchemist'] });
  const e = dummy(t, 5); e.x = 5 * 32 + 16 - e.w / 2;
  t.p.setFeet(5 * 32 + 16, e.y - 30); t.p.vy = 0; t.p.onGround = false; t.p.airJumps = 0;
  t.input.hold('down'); t.input.tap('attack');
  let best = 0;
  for (let i = 0; i < 20; i++) { t.run(1); best = Math.min(best, t.p.vy); }
  assert.ok(1000 - e.hp >= 12);
  assert.ok(best < -600 && best >= -800 - 1, `impulso ${best}`);
  assert.equal(t.p.airJumps, 1);
  // pinchos
  t = makeGame({ team: ['alchemist'] });
  t.world.set(5, 29, T.SPIKE);
  t.p.setFeet(5 * 32 + 16, 29 * 32 - 30); t.p.vy = 0; t.p.onGround = false;
  t.input.hold('down'); t.input.tap('attack');
  best = 0;
  for (let i = 0; i < 20; i++) { t.run(1); best = Math.min(best, t.p.vy); }
  assert.ok(best < -850, `impulso sobre pinchos ${best}`);
  assert.ok(t.g.zones.some((z) => z.kind === 'vapor' && Math.abs(z.r - 44) < 1), 'vapores de 44 px');
});

test('Transmutación: pulsar = piel de piedra (mitad de daño, 80 % de velocidad, apenas retrocede)', () => {
  const t = makeGame({ team: ['alchemist'] });
  t.input.tap('special'); t.run(3);
  assert.equal(t.p.kit.skin, 'stone');
  const hp = t.p.hp;
  t.p.hurt(20, { x: t.p.cx + 30, y: t.p.cy, kind: 'projectile' });
  assert.equal(hp - t.p.hp, 10);
  assert.ok(Math.abs(t.p.vx) < 100, `retroceso ${t.p.vx}`);
  t.p.hurtInv = 0; t.p.kbT = 0; t.secs(0.4);
  t.input.hold('right'); t.secs(0.8);
  assert.ok(Math.abs(t.p.vx - CONFIG.runSpeed * 0.8) < 3, `vel ${t.p.vx}`);
});

test('Transmutación: mantener ≥0,4 s = piel etérea (atraviesa enemigos sin daño por contacto; daño ×1,5)', () => {
  const t = makeGame({ team: ['alchemist'] });
  t.input.hold('special'); t.secs(0.5);
  assert.equal(t.p.kit.skin, 'ether');
  t.input.hold('special', false);
  CONFIG.enemies.frozen = false;
  const e = t.spawn('patrol', 5, 29);
  e.x = t.p.x; e.hp = e.maxHp = 1000;
  const hp = t.p.hp;
  t.run(10);
  assert.equal(t.p.hp, hp, 'sin daño por contacto');
  // ataques y peligros sí dañan
  assert.equal(t.p.hurt(5, { x: 0, y: 0, kind: 'projectile' }), 'hurt');
  // daño ×1,5 en frascos
  const h0 = e.hp;
  t.g.damageEnemy(e, 8, { kind: 'flask' });
  assert.equal(h0 - e.hp, 12);
});

test('Transmutación: dura 4 s y recarga 5 s desde que acaba; cambiar de personaje la termina', () => {
  const t = makeGame({ team: ['alchemist', 'swordsman'] });
  t.input.tap('special'); t.run(3);
  t.secs(3.9);
  assert.equal(t.p.kit.skin, 'stone');
  t.secs(0.3);
  assert.equal(t.p.kit.skin, null);
  assert.ok(t.p.kit.cd.trans > 4.5 && t.p.kit.cd.trans <= 5);
  t.input.tap('special'); t.run(3);
  assert.equal(t.p.kit.skin, null, 'en recarga');
  t.secs(5);
  t.input.tap('special'); t.run(3);
  assert.equal(t.p.kit.skin, 'stone');
  t.p.switchCd = 0; t.input.tap('next'); t.run(2);
  assert.equal(t.p.kit.id, 'swordsman');
  const alch = t.p.team[0].kit;
  assert.equal(alch.skin, null);
  assert.ok(alch.cd.trans > 0);
});

test('vapores corrosivos (dash a velocidad máxima): nube cada 0,06 s; 4 daño/0,5 s y ralentiza 50 %', () => {
  const t = makeGame({ team: ['alchemist'] });
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.5);
  t.input.tap('dash'); t.secs(0.3);
  const n = t.g.zones.filter((z) => z.kind === 'vapor').length;
  assert.ok(n >= 3, `nubes ${n}`);
  const e = dummy(t, 40, 1000);
  const z = t.g.zones.find((q) => q.kind === 'vapor');
  e.x = z.x - e.w / 2; e.y = z.y - e.h / 2;
  e.vx = 0; e.slowF = 1;
  const h0 = e.hp; t.secs(0.6);
  assert.ok(h0 - e.hp >= 4, `vapor ${h0 - e.hp}`);
  assert.ok(e.slowF <= 0.5 + 1e-6);
});

test('entrada heroica: 3 frascos (18 daño / 85 px) y aparece entre humo', () => {
  const t = makeGame({ team: ['mage', 'alchemist'] });
  const e = dummy(t, 5, 1000); e.x = t.p.x + 40;
  t.p.hurt(500, { x: 0, y: 0, kind: 'projectile' });
  assert.equal(t.p.kit.id, 'alchemist');
  assert.equal(t.p.hidden, true);
  t.secs(1.2);
  assert.equal(t.p.hidden, false);
  assert.ok(1000 - e.hp >= 18, `daño ${1000 - e.hp}`);
});
