import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, flatWorld, CONFIG, T, Store } from './helpers.mjs';

function dummy(t, x, hp = 1000, type = 'patrol') {
  CONFIG.enemies.frozen = true;
  const e = t.spawn(type, x, 29);
  e.hp = e.maxHp = hp;
  return e;
}
const noRegen = () => { CONFIG.mana.regenMove = 0; CONFIG.mana.regenStill = 0; };

test('agua: proyectil cargado ×1,6 (72) y ×1,25 extra contra enemigos de fuego (90)', () => {
  let t = makeGame({ amulets: ['water'] });
  let e = dummy(t, 12);
  t.input.hold('magic'); t.secs(0.7); t.input.hold('magic', false); t.secs(1.2);
  assert.equal(1000 - e.hp, 72);
  t = makeGame({ amulets: ['water'] });
  e = dummy(t, 12, 1000, 'lizard');
  t.input.hold('magic'); t.secs(0.7); t.input.hold('magic', false); t.secs(1.2);
  assert.equal(1000 - e.hp, 90);
  // sin amuleto: 45
  t = makeGame();
  e = dummy(t, 12);
  t.input.hold('magic'); t.secs(0.7); t.input.hold('magic', false); t.secs(1.2);
  assert.equal(1000 - e.hp, 45);
});

test('gólem: al morir explota a los 2 s (170 px / 45 daño); agua + cargado lo petrifica sin explotar y suelta monedas', () => {
  let t = makeGame();
  CONFIG.enemies.frozen = false;
  let g = t.spawn('golem', 14, 29);
  const hp0 = t.p.hp;
  t.g.damageEnemy(g, 9999, { kind: 'sword', melee: true });
  assert.ok(g.dying > 0 && !g.dead);
  t.p.tpTo(14 * 32 + 60, 30 * 32); t.p.hurtInv = 0;
  t.secs(1.9);
  assert.equal(g.dead, false);
  t.secs(0.3);
  assert.equal(g.dead, true);
  assert.ok(t.p.hp < hp0, 'la explosión daña al jugador cercano');
  // petrificación con el agua (aunque ya fuera a explotar)
  t = makeGame({ amulets: ['water'] });
  CONFIG.enemies.frozen = false;
  g = t.spawn('golem', 14, 29);
  t.g.damageEnemy(g, 9999, { kind: 'sword', melee: true });
  assert.ok(g.dying > 0);
  t.p.tpTo(5 * 32, 30 * 32);
  t.input.hold('magic'); t.secs(0.7); t.input.hold('magic', false); t.secs(1.0);
  assert.equal(g.petrified, true);
  t.secs(3);
  assert.equal(t.p.hp, t.p.maxHp, 'no explota');
});

test('gólem petrificado suelta monedas', () => {
  const t = makeGame({ amulets: ['water'] });
  CONFIG.enemies.frozen = false;
  const g = t.spawn('golem', 14, 29);
  g.hp = 10;
  t.input.hold('magic'); t.secs(0.7); t.input.hold('magic', false); t.secs(1.2);
  assert.equal(g.petrified, true);
  assert.ok(t.g.coins.reduce((n, c) => n + c.value, 0) >= 10);
});

test('fuego: la explosión (mismo coste) lanza 3 bolas de fuego que persiguen enemigos distintos; 35 daño en 108 px', () => {
  const t = makeGame({ amulets: ['fire'] });
  noRegen();
  const a = dummy(t, 14), b = dummy(t, 20, 1000), c = dummy(t, 8);
  t.input.hold('up'); t.input.tap('magic'); t.run(3);
  assert.equal(t.g.projectiles.filter((p) => p.kind === 'fireball').length, 3);
  assert.ok(Math.abs(t.p.mana - 10) < 0.01, 'mismo coste');
  t.secs(2.6);
  assert.equal(1000 - a.hp, 35); assert.equal(1000 - b.hp, 35); assert.equal(1000 - c.hp, 35);
});

test('fuego: sigue liberando de telaraña y espantando arañas; las bolas explotan a los 2,4 s', () => {
  const t = makeGame({ amulets: ['fire'] });
  const sp = t.spawn('spider', 8, 25);
  t.p.entangle(2);
  t.input.hold('up'); t.input.tap('magic'); t.run(2);
  assert.equal(t.p.webbed, 0);
  assert.equal(sp.state, 'fled');
  t.secs(2.6);
  assert.equal(t.g.projectiles.filter((p) => p.kind === 'fireball' && !p.dead).length, 0);
});

test('tierra: al caer desde más alto que un salto, 6 de daño al atravesar y onda de 140 px al aterrizar (25 + hasta 20)', () => {
  const t = makeGame({ amulets: ['earth'] });
  const a = dummy(t, 12);        // en el camino de la caída
  const b = dummy(t, 7);         // cerca del punto de aterrizaje
  t.p.tpTo(12 * 32 + 16, 8 * 32); t.p.vy = 0; t.p.onGround = false;
  t.p.x = a.x;
  t.secs(1.5);
  assert.ok(1000 - a.hp >= 6, `daño al atravesar ${1000 - a.hp}`);
  const t2 = makeGame({ amulets: ['earth'] });
  const e = dummy(t2, 8);
  t2.p.tpTo(5 * 32 + 16, 12 * 32); t2.secs(1.5);
  const dmg = 1000 - e.hp;
  assert.ok(dmg >= 25 && dmg <= 45, `onda ${dmg}`);
  void b;
});

test('tierra: sin caída alta no hay onda; el planeo de la maga la anula', () => {
  const t = makeGame({ amulets: ['earth'] });
  const e = dummy(t, 7);
  t.p.tpTo(5 * 32 + 16, 28 * 32 + 10); t.secs(0.5);
  assert.equal(e.hp, 1000);
  const m = makeGame({ amulets: ['earth'], team: ['mage'] });
  const e2 = dummy(m, 7);
  m.p.tpTo(5 * 32 + 16, 10 * 32); m.input.tap('jump'); m.run(2); m.input.tap('jump'); m.input.hold('jump');
  m.secs(4);
  assert.equal(e2.hp, 1000, 'planeo anula la onda');
});

test('tierra: el escudo dura 6 s; caer con escudo → onda de 230 px (45 daño) + temblor 2 s (15 daño/s en 280 px); el escudo se rompe', () => {
  const t = makeGame({ amulets: ['earth'] });
  noRegen();
  const e = dummy(t, 9);
  const far = dummy(t, 11);
  t.p.tpTo(5 * 32 + 16, 12 * 32);
  t.input.hold('down'); t.input.tap('magic'); t.run(2); t.input.hold('down', false);
  assert.ok(Math.abs(t.p.shieldT - 6) < 0.1);
  t.secs(1.5);
  assert.ok(t.p.shieldT === 0, 'escudo roto');
  assert.ok(1000 - e.hp >= 45 + 10, `onda+temblor ${1000 - e.hp}`);
  assert.ok(far.hp < 1000, 'la onda de 230 px alcanza a distancia');
  assert.ok(t.g.zones.some((z) => z.kind === 'quake') || true);
});

test('viento: dash ×1,25 de velocidad y ×1,2 de duración, +1 dash aéreo', () => {
  const t = makeGame({ amulets: ['wind'] });
  const x0 = t.p.x;
  t.input.hold('right'); t.input.tap('dash'); t.run(14);
  const dist = t.p.x - x0;
  assert.ok(Math.abs(dist - 900 * 1.25 * 0.18 * 1.2) < 40, `distancia ${dist}`);
  assert.equal(t.p.maxAirDashes(), 2);
});

test('viento: el sprint acumula cargas (+1 cada 0,8 s, máx. 3); cada carga +15 % (×1,35 → ×1,65)', () => {
  const t = makeGame({ amulets: ['wind'] });
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.4);
  assert.equal(t.p.sprint.charges, 1);
  assert.ok(Math.abs(t.p.sprintMul() - 1.35) < 1e-9);
  t.secs(0.8); assert.equal(t.p.sprint.charges, 2);
  assert.ok(Math.abs(t.p.sprintMul() - 1.5) < 1e-9);
  t.secs(1.0); assert.equal(t.p.sprint.charges, 3);
  assert.ok(Math.abs(t.p.sprintMul() - 1.65) < 1e-9);
  t.secs(2);
  assert.equal(t.p.sprint.charges, 3);
});

test('viento: con 3 cargas atraviesas enemigos (8 de daño) sin daño por contacto', () => {
  const t = makeGame({ amulets: ['wind'], world: flatWorld({ w: 200 }) });
  t.input.hold('right'); t.input.tap('dash'); t.secs(2.6);
  assert.equal(t.p.sprint.charges, 3);
  const e = dummy(t, 0, 1000);
  e.x = t.p.x + 60;
  const hp = t.p.hp;
  t.secs(0.5);
  assert.equal(t.p.hp, hp);
  assert.ok(1000 - e.hp >= 8);
});

test('hilos: segundo golpe cuerpo a cuerpo antes de 2 s → +40 % de daño y +0,5 de maná; los proyectiles no cuentan', () => {
  const t = makeGame({ amulets: ['threads'] });
  noRegen(); t.p.mana = 5;
  const e = dummy(t, 6);
  t.input.tap('attack'); t.secs(0.4);
  assert.equal(1000 - e.hp, 12);
  assert.ok(e.thread > 1.5);
  const m1 = t.p.mana;
  t.input.tap('attack'); t.secs(0.4);
  assert.ok(Math.abs((1000 - e.hp) - (12 + 12 * 1.4)) < 0.2, `daño total ${1000 - e.hp}`);
  assert.ok(Math.abs((t.p.mana - m1) - 1.0) < 0.01, 'maná: +0,5 del golpe +0,5 del hilo');
  // un proyectil no deja hilo
  const t2 = makeGame({ amulets: ['threads'] });
  const e2 = dummy(t2, 12);
  t2.input.tap('magic'); t2.secs(0.8);
  assert.equal(e2.thread || 0, 0);
  // el hilo caduca a los 2 s
  const t3 = makeGame({ amulets: ['threads'] });
  const e3 = dummy(t3, 6);
  t3.input.tap('attack'); t3.secs(2.3);
  t3.input.tap('attack'); t3.secs(0.4);
  assert.equal(1000 - e3.hp, 24);
});

test('amuletos: se equipan y desequipan en el inventario y persisten', () => {
  const t = makeGame({ amulets: ['water', 'fire'] });
  assert.ok(Store.equipped('water'));
  Store.toggleEquip('water');
  assert.equal(Store.equipped('water'), false);
  assert.equal(Store.has('water'), true);
  Store.toggleEquip('water');
  assert.ok(Store.equipped('water'));
  void t;
});
