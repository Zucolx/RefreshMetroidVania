import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, flatWorld, CONFIG, T, Store } from './helpers.mjs';
import { splitCoins, dropCoins, Coin } from '../src/coins.js';

const total = (g) => g.coins.reduce((n, c) => n + c.value, 0);

test('reparto en monedas de 5 y de 1', () => {
  assert.deepEqual(splitCoins(13), [5, 5, 1, 1, 1]);
  assert.deepEqual(splitCoins(5), [5]);
  assert.deepEqual(splitCoins(0), []);
  assert.deepEqual(splitCoins(4), [1, 1, 1, 1]);
});

test('valor aleatorio en [mín, máx] por enemigo', () => {
  const t = makeGame();
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    t.g.coins.length = 0;
    const e = t.spawn('golem', 12, 29);
    dropCoins(t.g, e);
    const v = total(t.g);
    assert.ok(v >= 10 && v <= 16, `golem ${v}`);
    seen.add(v);
  }
  assert.ok(seen.size > 3, 'varía');
});

test('imán: a <110 px vuelan al jugador tras 0,35 s; se guardan en el progreso', () => {
  const t = makeGame();
  const c = new Coin(t.p.cx + 90, t.p.cy, 5); c.vx = 0; c.vy = 0;
  t.g.coins.push(c);
  const before = Store.data.coins;
  t.run(10);
  assert.equal(c.attract, false, 'espera 0,35 s');
  t.secs(0.5);
  assert.equal(c.dead, true);
  assert.equal(Store.data.coins - before, 5);
});

test('fuera del imán no se recogen; duran 20 s', () => {
  const t = makeGame();
  const c = new Coin(t.p.cx + 300, t.p.cy, 1); c.vx = 0; c.vy = 0;
  t.g.coins.push(c);
  t.secs(10); assert.equal(c.dead, false);
  t.secs(10.2); assert.equal(c.dead, true);
  assert.equal(CONFIG.coins.life, 20);
});

test('flotan sobre lava y pinchos', () => {
  const t = makeGame();
  t.world.fill(20, 29, 3, 1, T.LAVA);
  t.world.fill(20, 30, 3, 5, T.AIR); t.world.fill(20, 30, 3, 1, T.LAVA);
  const c = new Coin(21 * 32 + 16, 28 * 32, 1); c.vx = 0; c.vy = 0;
  t.g.coins.push(c);
  t.secs(3);
  assert.ok(c.y < 30 * 32, `la moneda flota (${c.y / 32})`);
});

test('laboratorio: multiplicador, on/off; las muertes del laboratorio no sueltan monedas', () => {
  const t = makeGame();
  CONFIG.coins.mul = 2;
  const e = t.spawn('chaser', 12, 29);
  dropCoins(t.g, e);
  const v = total(t.g);
  assert.ok(v >= 6 && v <= 12, `×2: ${v}`);
  t.g.coins.length = 0;
  CONFIG.coins.enabled = false;
  dropCoins(t.g, e);
  assert.equal(t.g.coins.length, 0);
  CONFIG.coins.enabled = true;
  e.noCoins = true;
  dropCoins(t.g, e);
  assert.equal(t.g.coins.length, 0);
});

test('matar un enemigo suelta sus monedas y el total persiste', () => {
  const t = makeGame();
  const e = t.spawn('chaser', 12, 29);
  t.g.damageEnemy(e, 999, { kind: 'sword', melee: true });
  assert.ok(total(t.g) >= 3 && total(t.g) <= 6);
  t.p.tpTo(e.cx, 30 * 32);
  t.secs(2);
  assert.ok(Store.data.coins >= 3);
});
