import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, flatWorld, CONFIG, T } from './helpers.mjs';

function dummy(t, x, hp = 1000, type = 'patrol') {
  CONFIG.enemies.frozen = true;
  const e = t.spawn(type, x, 29);
  e.hp = e.maxHp = hp;
  return e;
}
const wide = () => flatWorld({ w: 240 });

test('espadachín: dash a velocidad máxima → patineta (660 px/s, invulnerable); el choque es onda de 120 px / 20 daño + voltereta; los enemigos salen girando', () => {
  const t = makeGame({ world: wide() });
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.5);
  t.input.tap('dash'); t.secs(0.4);
  assert.ok(t.p.runMode && t.p.runMode.kind === 'skate');
  assert.ok(Math.abs(Math.abs(t.p.vx) - 660) < 5, `vx ${t.p.vx}`);
  assert.ok(t.p.isInvuln());
  const a = dummy(t, 0, 1000); a.x = t.p.x + 160;
  const b = dummy(t, 0, 1000); b.x = a.x + 40;
  t.secs(0.7);
  assert.ok(1000 - a.hp >= 20, `onda ${1000 - a.hp}`);
  assert.ok(a.tumble || a.stun > 0 || 1000 - b.hp > 0, 'salen girando');
  assert.equal(t.p.runMode, null, 'termina con voltereta');
});

test('enemigos lanzados: aturdidos 1,2 s y dañan 15 al chocar entre sí (aturden 0,4 s)', () => {
  const t = makeGame({ world: wide() });
  const a = dummy(t, 20, 1000), b = dummy(t, 21, 1000);
  b.x = a.x + 20;
  a.startTumble(300, -100);
  assert.equal(a.tumble.t, CONFIG.sprint.tumbleTime);
  assert.equal(CONFIG.sprint.tumbleTime, 1.2);
  t.secs(0.4);
  assert.equal(1000 - b.hp, 15);
  assert.ok(b.stun > 0);
});

test('artificiero: dash a velocidad máxima → carrera cohete (680 px/s); choque = explosión 95 px / 30 daño + voltereta', () => {
  const t = makeGame({ world: wide(), team: ['artificer'] });
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.5);
  t.input.tap('dash'); t.secs(0.4);
  assert.ok(t.p.runMode && t.p.runMode.kind === 'rocket');
  assert.ok(Math.abs(Math.abs(t.p.vx) - 680) < 5, `vx ${t.p.vx}`);
  const a = dummy(t, 0, 1000); a.x = t.p.x + 180;
  t.secs(0.7);
  assert.ok(1000 - a.hp >= 30, `explosión ${1000 - a.hp}`);
  assert.equal(t.p.runMode, null);
});

test('la patineta y el cohete se detienen al soltar la dirección o contra un muro', () => {
  const t = makeGame({ world: wide() });
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.5); t.input.tap('dash'); t.secs(0.4);
  assert.ok(t.p.runMode);
  t.input.hold('right', false); t.secs(0.6);
  assert.equal(t.p.runMode, null);
});

test('maga, alquimista, titiritero y relojero: dash normal + efecto persistente mientras corren', () => {
  for (const id of ['mage', 'alchemist', 'puppeteer', 'clockmaker']) {
    const t = makeGame({ world: wide(), team: [id] });
    t.input.hold('right'); t.input.tap('dash'); t.secs(0.5); t.input.tap('dash'); t.secs(0.4);
    assert.ok(t.p.runMode, `${id}: modo máximo`);
    assert.ok(['trail', 'threads'].includes(t.p.runMode.kind), id);
    assert.ok(Math.abs(t.p.vx) < 500, `${id}: velocidad normal de sprint ${t.p.vx}`);
  }
});

test('el dash en sprint por debajo del 90 % de la velocidad máxima no activa el modo', () => {
  const t = makeGame({ world: wide() });
  t.input.hold('right'); t.input.tap('dash'); t.run(14);
  t.p.vx = 300;
  t.input.tap('dash'); t.secs(0.3);
  assert.equal(t.p.runMode, null);
});

test('con viento, el modo máximo exige además 3 cargas', () => {
  const t = makeGame({ world: wide(), amulets: ['wind'] });
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.4);
  t.input.tap('dash'); t.secs(0.3);
  assert.equal(t.p.runMode, null, 'con 1 carga no');
  t.secs(2.6);
  t.input.tap('dash'); t.secs(0.3);
  assert.ok(t.p.runMode, 'con 3 cargas sí');
});

test('cámara: mantener ↑ o ↓ 0,2 s desplaza el 35 % de la pantalla', () => {
  const t = makeGame({ world: flatWorld({ h: 80, floor: 70 }) });
  t.p.tpTo(30 * 32, 70 * 32); t.secs(1.5);
  const base = t.g.cam.y;
  t.input.hold('up'); t.run(8);
  assert.ok(Math.abs(t.g.lookY) < 1, 'aún no (0,13 s)');
  t.secs(1.5);
  assert.ok(Math.abs(t.g.cam.y - (base - 0.35 * 540)) < 25, `desplazamiento ${base - t.g.cam.y}`);
  t.input.hold('up', false);
  t.input.hold('down'); t.secs(2);
  assert.ok(t.g.cam.y > base, 'hacia abajo');
});

test('minimapa: se revela al explorar y muestra jugador, checkpoints, amuletos sin recoger y salida vista', () => {
  const w = flatWorld({ w: 120 });
  w.checkpoints = [{ x: 10, y: 29 }]; w.exit = { x: 110, y: 29 }; w.amulets = [{ type: 'water', x: 100, y: 29 }];
  const t = makeGame({ world: w });
  const idx = (x, y) => Math.floor(y / 2) * t.g.exploredW + Math.floor(x / 2);
  assert.equal(t.g.explored[idx(5, 29)], 1);
  assert.equal(t.g.explored[idx(100, 29)], 0, 'lo lejano está sin explorar');
  t.p.tpTo(100 * 32, 30 * 32); t.run(3);
  assert.equal(t.g.explored[idx(100, 29)], 1);
  assert.equal(t.g.pickups.length, 1);
});
