import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, CONFIG } from './helpers.mjs';

function dummy(t, x, hp = 1000, type = 'patrol') {
  CONFIG.enemies.frozen = true;
  const e = t.spawn(type, x, 29);
  e.hp = e.maxHp = hp;
  return e;
}

test('combo de chispas: 9 / 9 / 15 de daño, 0,2 s entre chispas, alcance 270 px', () => {
  const t = makeGame({ team: ['mage'] });
  const e = dummy(t, 9);      // a ~128 px
  const far = dummy(t, 30);   // más allá de 270 px
  const d = [];
  for (let i = 0; i < 3; i++) { const h0 = e.hp; t.input.tap('attack'); t.secs(0.5); d.push(h0 - e.hp); }
  assert.deepEqual(d, [9, 9, 15]);
  assert.equal(far.hp, 1000);
});

test('la chispa blanca atraviesa; apunta en 8 direcciones', () => {
  const t = makeGame({ team: ['mage'] });
  const a = dummy(t, 8), b = dummy(t, 12);
  t.input.tap('attack'); t.secs(0.3); t.input.tap('attack'); t.secs(0.3);
  const before = [a.hp, b.hp];
  t.input.tap('attack'); t.secs(0.5);
  assert.ok(a.hp < before[0] && b.hp < before[1], 'atraviesa a ambos');
  t.input.hold('up'); t.input.tap('attack'); t.run(3);
  const pr = t.g.projectiles.find((p) => p.kind === 'spark');
  assert.ok(pr && pr.vy < -300 && Math.abs(pr.vx) < 5, 'arriba');
});

test('5 % de convertir en rana/ratón: 1 HP, sin daño, huye; desaparece a los 3,2 s sin monedas', () => {
  const t = makeGame({ team: ['mage'] });
  CONFIG.mage.morphChance = 1;
  CONFIG.enemies.frozen = false;
  const e = dummy(t, 9); CONFIG.enemies.frozen = false;
  e.hp = e.maxHp = 200;
  t.input.tap('attack'); t.secs(0.5);
  assert.ok(e.morph, 'transformado');
  assert.equal(e.hp, 1);
  const hp0 = t.p.hp;
  t.secs(1);
  assert.equal(t.p.hp, hp0, 'sin daño por contacto');
  t.secs(2.5);
  assert.equal(e.dead, true);
  assert.equal(t.g.coins.length, 0, 'sin monedas');
});

test('transformado y rematado, sí suelta monedas', () => {
  const t = makeGame({ team: ['mage'] });
  CONFIG.mage.morphChance = 1;
  const e = dummy(t, 9); CONFIG.enemies.frozen = false;
  e.hp = e.maxHp = 200;
  t.input.tap('attack'); t.secs(0.5);
  assert.ok(e.morph);
  t.g.damageEnemy(e, 5, { kind: 'bolt', magic: true });
  assert.equal(e.dead, true);
  assert.ok(t.g.coins.length > 0);
});

test('no transforma al gólem apagado, a la araña escondida ni al payaso en su caja', () => {
  const t = makeGame({ team: ['mage'] });
  CONFIG.mage.morphChance = 1;
  const clown = dummy(t, 9, 100, 'clown');
  t.g.damageEnemy(clown, 1, { kind: 'spark', magic: true });
  assert.equal(clown.morph, null);
  const sp = t.spawn('spider', 12, 3);
  sp.onScare(t.g);
  t.g.damageEnemy(sp, 1, { kind: 'spark', magic: true });
  assert.equal(sp.morph, null);
});

test('mariposas (mantener 0,9 s): 7 mariposas de 10 de daño en abanico', () => {
  const t = makeGame({ team: ['mage'] });
  const e = dummy(t, 8);
  t.input.hold('attack'); t.secs(1.0); t.input.hold('attack', false); t.run(2);
  const n = t.g.projectiles.filter((p) => p.kind === 'butterfly').length;
  assert.equal(n, 7);
  t.secs(1.5);
  assert.ok(1000 - e.hp >= 30, `daño ${1000 - e.hp}`);
});

test('corriente de aire (↓ + suelo): empuja <100 px (8 daño) y deshace proyectiles cercanos', () => {
  const t = makeGame({ team: ['mage'] });
  const e = dummy(t, 8);
  const o = dummy(t, 20, 90, 'orc');
  const rock = o.shoot(t.g, { x: t.p.cx + 40, y: t.p.cy, vx: 0, vy: 0, r: 11, dmg: 14, life: 3, shape: 'rock' });
  t.input.hold('down'); t.input.tap('attack'); t.run(4);
  assert.equal(1000 - e.hp, 8);
  assert.equal(rock.dead, true);
});

test('planeo: mantener salto tras el doble salto → caída 80 px/s', () => {
  const t = makeGame({ team: ['mage'] });
  t.p.tpTo(10 * 32, 5 * 32); 
  t.input.tap('jump'); t.run(2); t.input.tap('jump'); t.input.hold('jump'); t.secs(0.8);
  assert.ok(t.p.usedDouble);
  assert.ok(Math.abs(t.p.vy - 80) < 2, `vy ${t.p.vy}`);
});

test('ráfaga de viento (↓ + aéreo): impulso 900 con enemigo debajo, 8 daño; sin nada, solo soplo', () => {
  let t = makeGame({ team: ['mage'] });
  let e = dummy(t, 5);
  e.x = 5 * 32 + 16 - e.w / 2;
  t.p.setFeet(5 * 32 + 16, e.y - 100); t.p.vy = 50; t.p.onGround = false;
  t.input.hold('down'); t.input.tap('attack'); t.run(2);
  assert.equal(1000 - e.hp, 8);
  assert.ok(t.p.vy <= -800, `impulso ${t.p.vy} (mayor que el pogo: 720)`);
  t = makeGame({ team: ['mage'] });
  t.p.tpTo(5 * 32 + 16, 12 * 32); t.p.vy = 50; t.p.onGround = false;
  t.input.hold('down'); t.input.tap('attack'); t.run(2);
  assert.ok(t.p.vy > 0, 'sin objetivo no hay impulso');
});

test('Hada benigna: orbita 15 s, provoca cada 2,5 s, dispara estrellas de 8 daño, 30 HP', () => {
  const t = makeGame({ team: ['mage'] });
  const e = dummy(t, 12); CONFIG.enemies.frozen = false;
  e.hp = e.maxHp = 1000; e.def = e.def;
  t.input.tap('special'); t.run(2);
  const f = t.p.kit.fairy;
  assert.ok(f && f.alive);
  assert.equal(f.hp, 30);
  assert.equal(f.t > 14, true);
  t.secs(1.2);
  assert.ok(e.provoke, 'el enemigo está provocado («!»)');
  assert.ok(1000 - e.hp >= 8, 'la estrella lo daña');
  // dura 15 s y luego recarga 5 s
  t.secs(15);
  assert.equal(t.p.kit.fairy, null);
  assert.ok(t.p.kit.cd.fairy > 0 && t.p.kit.cd.fairy <= 5);
});

test('Hada benigna: si la derriban, recarga 7 s', () => {
  const t = makeGame({ team: ['mage'] });
  t.input.tap('special'); t.run(2);
  t.p.kit.fairy.hit(t.g, 40);
  t.run(2);
  assert.equal(t.p.kit.fairy, null);
  assert.ok(t.p.kit.cd.fairy > 6.5, `recarga ${t.p.kit.cd.fairy}`);
});

test('Hada benigna: sus estrellas cuentan como magia y dañan fantasmas', () => {
  const t = makeGame({ team: ['mage'] });
  const g = dummy(t, 12, 30, 'ghost'); g.setState('chase');
  t.input.tap('special'); t.secs(2);
  assert.ok(g.hp < 30, `fantasma ${g.hp}`);
});

test('rastro de mariposas (dash a velocidad máxima): una cada 0,08 s, máx. 8, y atacan al dejar de correr', () => {
  const t = makeGame({ team: ['mage'] });
  dummy(t, 60);
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.5);
  assert.ok(t.p.sprint.on);
  t.input.tap('dash'); t.secs(1.2);
  assert.ok(t.p.runMode, 'modo rastro activo');
  assert.equal(t.p.kit.trail.length, 8);
  t.input.hold('right', false); t.secs(0.4);
  assert.equal(t.p.kit.trail.length, 0);
});
