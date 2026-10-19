import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, CONFIG } from './helpers.mjs';
import { KIT_ORDER } from '../src/characters/index.js';

test('meditación: con HP y maná completos no se entra', () => {
  const t = makeGame();
  t.secs(8);
  assert.equal(t.p.meditating, false);
});

test('meditación: a los 3 s quieto con recursos incompletos; 3 maná/s y 10 HP/s; se detiene al completar', () => {
  const t = makeGame();
  t.p.hp = 50; t.p.mana = 5; t.p.stillT = 0;
  t.secs(2.9);
  assert.equal(t.p.meditating, false);
  t.secs(0.4);
  assert.equal(t.p.meditating, true);
  const hp0 = t.p.hp, m0 = t.p.mana;
  t.secs(1);
  assert.ok(Math.abs((t.p.hp - hp0) - 10) < 1.5, `HP/s ${t.p.hp - hp0}`);
  assert.ok(Math.abs((t.p.mana - m0) - 3) < 0.6, `maná/s ${t.p.mana - m0}`);
  t.secs(6);
  assert.equal(t.p.hp, t.p.maxHp);
  assert.equal(t.p.mana, CONFIG.mana.max);
  assert.equal(t.p.meditating, false, 'no queda en bucle');
  t.secs(5);
  assert.equal(t.p.meditating, false);
});

test('meditación: cualquier acción la interrumpe', () => {
  const t = makeGame();
  t.p.hp = 20; t.secs(3.5);
  assert.equal(t.p.meditating, true);
  t.input.tap('attack'); t.run(2);
  assert.equal(t.p.meditating, false);
});

test('meditación: desactivable (CONFIG.meditationEnabled)', () => {
  const t = makeGame();
  CONFIG.meditationEnabled = false;
  t.p.hp = 20; t.secs(8);
  assert.equal(t.p.meditating, false);
});

test('idle_base en reposo y idle_flavor a los 4 s sin combate; se corta al instante con input', () => {
  const t = makeGame();
  t.secs(1);
  assert.equal(t.p.idleState, 'base');
  t.secs(3.5);
  assert.equal(t.p.idle.on, true, 'ha empezado el idle de sabor');
  t.secs(0.5);
  assert.equal(t.p.idleState, 'flavor');
  t.input.hold('right'); t.run(1);
  assert.equal(t.p.idle.on, false);
  assert.equal(t.p.idle.blend, 0);
  assert.notEqual(t.p.idleState, 'flavor');
});

test('idle_flavor no aparece con enemigos cerca ni con recursos incompletos', () => {
  let t = makeGame();
  CONFIG.enemies.frozen = true;
  t.spawn('patrol', 12, 29);
  t.secs(7);
  assert.equal(t.p.idle.on, false);
  t = makeGame();
  t.p.mana = 10; t.p.hp = 90; CONFIG.meditationEnabled = false;
  t.secs(7);
  assert.equal(t.p.idle.on, false);
});

test('las transiciones idle_base ↔ idle_flavor se mezclan en ~0,2 s', () => {
  const t = makeGame();
  t.p.calmT = 0; t.secs(3.95);
  t.run(3);
  const b0 = t.p.idle.blend;
  t.run(6);
  assert.ok(t.p.idle.blend > b0 && t.p.idle.blend <= 1);
  t.secs(0.3);
  assert.equal(t.p.idle.blend, 1);
});

for (const id of KIT_ORDER) {
  test(`${id}: tiene idle_base e idle_flavor con acción propia`, () => {
    const t = makeGame({ team: [id] });
    t.secs(1);
    assert.equal(t.p.idleState, 'base');
    assert.ok(t.p.kit.flavorKinds.length >= 1);
    t.secs(4.3);
    t.secs(0.4);
    assert.equal(t.p.idleState, 'flavor');
    assert.ok(t.p.idle.kind, 'tipo de sabor elegido');
    assert.ok(t.p.animName === 'idle_flavor');
    // el flavor dura un tiempo y vuelve a idle_base (luego puede repetirse)
    let ended = false;
    for (let i = 0; i < Math.round((t.p.kit.flavorDur + 1) * 60); i++) { t.run(1); if (!t.p.idle.on) { ended = true; break; } }
    assert.ok(ended, 'el idle de sabor termina');
    t.secs(0.4);
    assert.equal(t.p.idleState, 'base');
  });
}

test('espadachín: sabor = afilar o tocar la ocarina', () => {
  const t = makeGame();
  const kinds = new Set();
  for (let i = 0; i < 40; i++) kinds.add(t.p.kit.pickFlavor());
  assert.deepEqual([...kinds].sort(), ['ocarina', 'sharpen']);
});

test('maná: 0,25/s en movimiento y 1,5/s quieto tras 0,4 s (maga +30 %)', () => {
  let t = makeGame();
  t.p.mana = 5; CONFIG.meditationEnabled = false;
  t.input.hold('right'); t.secs(2); t.input.hold('right', false);
  const m1 = t.p.mana; assert.ok(m1 > 5.3 && m1 < 5.9, `en movimiento ${m1}`);
  t.secs(0.5);
  const m2 = t.p.mana; t.secs(2);
  assert.ok(Math.abs((t.p.mana - m2) - 3) < 0.25, `quieto ${t.p.mana - m2}`);
  t = makeGame({ team: ['mage'] });
  t.p.mana = 5; CONFIG.meditationEnabled = false; t.secs(0.6);
  const m3 = t.p.mana; t.secs(2);
  assert.ok(Math.abs((t.p.mana - m3) - 3 * 1.3) < 0.3, `maga ${t.p.mana - m3}`);
});
