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

test('proyectil mágico: 1 de maná, 15 de daño, 760 px/s', () => {
  const t = makeGame();
  noRegen();
  const e = dummy(t, 12);
  t.input.tap('magic'); t.run(3);
  const pr = t.g.projectiles.find((p) => p.kind === 'bolt');
  assert.ok(pr && Math.abs(Math.hypot(pr.vx, pr.vy) - 760) < 1);
  t.secs(1);
  assert.equal(1000 - e.hp, 15);
  assert.ok(Math.abs(t.p.mana - 14) < 0.01);
});

test('proyectil cargado (mantener 0,6 s): 3 de maná, 45 de daño, 620 px/s, atraviesa', () => {
  const t = makeGame();
  noRegen();
  const a = dummy(t, 10), b = dummy(t, 14);
  t.input.hold('magic'); t.secs(0.7); t.input.hold('magic', false); t.run(2);
  const pr = t.g.projectiles.find((p) => p.kind === 'charged');
  assert.ok(pr && Math.abs(Math.hypot(pr.vx, pr.vy) - 620) < 1);
  t.secs(1);
  assert.equal(1000 - a.hp, 45); assert.equal(1000 - b.hp, 45);
  assert.ok(Math.abs(t.p.mana - 12) < 0.01);
});

test('sin maná suficiente: la barra parpadea y no se lanza', () => {
  const t = makeGame();
  noRegen(); t.p.mana = 0.5;
  t.input.tap('magic'); t.run(3);
  assert.ok(t.p.manaFlash > 0);
  assert.equal(t.g.projectiles.length, 0);
});

test('escudo (↓ + magia): 5 de maná, 4 s, radio 42 px; bloquea todo salvo pinchos y lava', () => {
  const t = makeGame();
  noRegen();
  t.input.hold('down'); t.input.tap('magic'); t.run(2); t.input.hold('down', false);
  assert.ok(Math.abs(t.p.shieldT - 4) < 0.1);
  assert.ok(Math.abs(t.p.mana - 10) < 0.01);
  const hp = t.p.hp;
  assert.equal(t.p.hurt(30, { x: 0, y: 0, kind: 'contact' }), 'blocked');
  assert.equal(t.p.hp, hp);
  t.world.set(6, 29, T.SPIKE);
  t.p.tpTo(6 * 32 + 16, 30 * 32); t.run(2);
  assert.ok(t.p.hp < hp, 'los pinchos sí dañan');
  t.secs(4.2);
  assert.equal(t.p.shieldT, 0);
});

test('escudo: refleja proyectiles ×2 (las bayas del treant vuelven a su dueño) y destruye redes, ondas y llamas', () => {
  const t = makeGame();
  const tr = dummy(t, 14, 120, 'treant'); tr.wake();
  CONFIG.enemies.frozen = true;
  const berry = tr.shoot(t.g, { x: t.p.cx + 80, y: t.p.cy, vx: -300, vy: 0, r: 9, dmg: 14, life: 4, shape: 'berry', reflect: true, cut: true });
  berry.onReflect = function () { this.homeTo = tr; this.grav = 0; };
  const net = tr.shoot(t.g, { x: t.p.cx + 80, y: t.p.cy + 5, vx: -300, vy: 0, r: 14, dmg: 3, life: 4, shape: 'net', shieldKill: true, web: 2 });
  const wave = tr.shoot(t.g, { x: t.p.cx + 90, y: t.p.cy - 5, vx: -300, vy: 0, r: 12, dmg: 10, life: 4, shape: 'wave', sonic: true, shieldKill: true });
  const flame = tr.shoot(t.g, { x: t.p.cx + 100, y: t.p.cy, vx: -300, vy: 0, r: 9, dmg: 7, life: 4, shape: 'flame', shieldKill: true });
  t.input.hold('down'); t.input.tap('magic'); t.run(2); t.input.hold('down', false);
  t.secs(0.5);
  assert.equal(berry.team, 'player', 'la baya cambia de bando');
  assert.equal(berry.dmg, 28, '×2');
  assert.ok(net.dead && wave.dead && flame.dead);
  t.secs(2);
  assert.ok(tr.hp < 120, 'la baya reflejada vuelve a su dueño y explota');
});

test('escudo: aparta a los enemigos', () => {
  const t = makeGame();
  CONFIG.enemies.frozen = false;
  const e = t.spawn('patrol', 5, 29); e.x = t.p.cx + 30;
  t.input.hold('down'); t.input.tap('magic'); t.run(2); t.input.hold('down', false);
  const x0 = e.x; t.run(10);
  assert.ok(e.x > x0 + 4, `desplazado ${e.x - x0}`);
});

test('explosión (↑ + magia): 5 de maná, 70 de daño en 180 px; destruye proyectiles', () => {
  const t = makeGame();
  noRegen();
  const e = dummy(t, 9);
  const far = dummy(t, 30);
  const o = dummy(t, 20, 90, 'orc');
  const pr = o.shoot(t.g, { x: t.p.cx + 60, y: t.p.cy, vx: 0, vy: 0, r: 11, dmg: 14, life: 3, shape: 'rock' });
  t.input.hold('up'); t.input.tap('magic'); t.run(2);
  assert.equal(1000 - e.hp, 70);
  assert.equal(far.hp, 1000);
  assert.ok(pr.dead);
  assert.ok(Math.abs(t.p.mana - 10) < 0.01);
});

test('explosión: rompe la telaraña, espanta arañas al techo y mata arañitas cercanas', () => {
  const t = makeGame();
  const sp = t.spawn('spider', 8, 25);
  const baby = t.spawn('spiderling', 7, 29);
  t.p.entangle(2);
  assert.ok(t.p.webbed > 0);
  t.input.hold('up'); t.input.tap('magic'); t.run(3);
  assert.equal(t.p.webbed, 0);
  assert.equal(sp.state, 'fled');
  assert.equal(baby.dead, true);
});

test('telaraña: 2 s enredado (movimiento ×0,45); cada tajo quita 0,4 s', () => {
  const t = makeGame();
  t.p.entangle(2);
  t.input.hold('right'); t.secs(0.6);
  assert.ok(Math.abs(t.p.vx - CONFIG.runSpeed * 0.45) < 3, `vx ${t.p.vx}`);
  t.input.hold('right', false);
  const w0 = t.p.webbed;
  t.input.tap('attack'); t.run(3);
  assert.ok(w0 - t.p.webbed >= 0.4 - 0.1);
  t.secs(2);
  assert.equal(t.p.webbed, 0);
});

test('daño: 1 s de invulnerabilidad + retroceso; pinchos 15 y lava 25 devuelven a la última posición segura', () => {
  const t = makeGame();
  t.input.hold('right'); t.secs(0.5); t.input.hold('right', false); t.secs(0.4);
  const safe = { x: t.p.x, y: t.p.y };
  t.world.fill(14, 29, 2, 1, T.SPIKE);
  t.world.fill(18, 29, 2, 1, T.LAVA);
  t.p.tpTo(14 * 32 + 20, 30 * 32);
  t.run(2);
  assert.equal(t.p.maxHp - t.p.hp, 15);
  assert.ok(Math.abs(t.p.x - safe.x) < 40, 'vuelve a suelo seguro');
  assert.ok(t.p.hurtInv > 0.9);
  t.p.hurtInv = 0;
  t.p.tpTo(18 * 32 + 20, 30 * 32); t.run(2);
  assert.equal(t.p.maxHp - t.p.hp, 15 + 25);
  const hp = t.p.hp;
  t.p.hurt(10, { x: t.p.cx + 10, y: t.p.cy, kind: 'projectile' });
  assert.equal(t.p.hp, hp, 'invulnerable tras el daño');
});

test('retroceso 320 al recibir daño', () => {
  const t = makeGame();
  t.p.tpTo(30 * 32, 30 * 32); t.run(5);
  t.p.hurt(10, { x: t.p.cx - 20, y: t.p.cy, kind: 'contact' });
  assert.ok(Math.abs(t.p.vx - 320) < 2);
});

test('drenaje de hadas: blanca 1,5 maná/s, negra 4 HP/s (ignora invulnerabilidad, no el escudo); impiden meditar', () => {
  const t = makeGame();
  noRegen(); CONFIG.meditationEnabled = true;
  t.p.hp = 80;
  const hp0 = t.p.hp; t.p.hurtInv = 5;
  for (let i = 0; i < 60; i++) { t.p.drain(4, 0, 1 / 60); t.p.fairyT = 0.3; t.run(0); }
  assert.ok(Math.abs((hp0 - t.p.hp) - 4) < 0.1, `HP ${hp0 - t.p.hp}`);
  const m0 = t.p.mana;
  for (let i = 0; i < 60; i++) t.p.drain(0, 1.5, 1 / 60);
  assert.ok(Math.abs((m0 - t.p.mana) - 1.5) < 0.1);
  t.p.shieldT = 4;
  const hp1 = t.p.hp; for (let i = 0; i < 60; i++) t.p.drain(4, 0, 1 / 60);
  assert.equal(t.p.hp, hp1, 'el escudo protege del hada negra');
  // no se medita mientras drenan
  t.p.shieldT = 0;
  const t2 = makeGame();
  t2.p.hp = 50; CONFIG.meditationEnabled = true;
  const f = t2.spawn('blackfairy', 8, 20); f.x = t2.p.x + 20; f.y = t2.p.y - 30; CONFIG.enemies.frozen = false;
  t2.p.invuln = 99;
  t2.secs(4);
  assert.equal(t2.p.meditating, false);
});

// ---------------- equipo ----------------
test('equipo: cambio con prev/next, cooldown de 3 s, maná común', () => {
  const t = makeGame({ team: ['swordsman', 'mage', 'artificer'] });
  t.p.mana = 7;
  t.input.tap('next'); t.run(2);
  assert.equal(t.p.kit.id, 'mage');
  assert.equal(t.p.mana > 6.9, true, 'maná común');
  t.input.tap('next'); t.run(2);
  assert.equal(t.p.kit.id, 'mage', 'cooldown');
  t.secs(3.1);
  t.input.tap('prev'); t.run(2);
  assert.equal(t.p.kit.id, 'swordsman');
});

test('equipo: la reserva regenera +2 HP/s y conserva su vida; cada personaje su HP (100/85/110/90/95/85)', () => {
  const t = makeGame({ team: ['swordsman', 'mage', 'artificer', 'alchemist'].slice(0, 3) });
  assert.deepEqual(t.p.team.map((m) => m.maxHp), [100, 85, 110]);
  t.p.team[1].hp = 40;
  t.secs(5);
  assert.ok(Math.abs(t.p.team[1].hp - 50) < 1.2, `hp ${t.p.team[1].hp}`);
  const hps = ['swordsman', 'mage', 'artificer', 'alchemist', 'puppeteer', 'clockmaker'].map((id) => CONFIG.characters[id].hp);
  assert.deepEqual(hps, [100, 85, 110, 90, 95, 85]);
});

test('relevo: el caído queda KO, entra el siguiente con 1,2 s de invulnerabilidad; los KO no se eligen', () => {
  const t = makeGame({ team: ['swordsman', 'mage', 'artificer'] });
  t.p.hurt(999, { x: 0, y: 0, kind: 'projectile' });
  assert.equal(t.p.team[0].ko, true);
  assert.equal(t.p.kit.id, 'mage');
  assert.ok(t.p.inv >= 1.1);
  assert.equal(t.p.facing, 1, 'entra hacia la derecha');
  t.secs(3.1);
  t.input.tap('prev'); t.run(2);
  assert.notEqual(t.p.kit.id, 'swordsman', 'el KO no se elige');
});

test('checkpoint: los KO reviven con media vida; si caen los tres, se reaparece en el último checkpoint con todos llenos', () => {
  const w = flatWorld();
  w.checkpoints = [{ x: 20, y: 29 }];
  const t = makeGame({ team: ['swordsman', 'mage'], world: w });
  t.p.hurt(999, { x: 0, y: 0, kind: 'projectile' });
  assert.equal(t.p.team[0].ko, true);
  t.p.tpTo(20 * 32 + 16, 30 * 32); t.run(3);
  assert.equal(t.p.team[0].ko, false);
  assert.ok(Math.abs(t.p.team[0].hp - 50) < 2, `hp ${t.p.team[0].hp}`);
  t.p.tpTo(40 * 32, 30 * 32); t.run(3);
  t.p.inv = 0; t.p.hurtInv = 0;
  t.p.hurt(999, { x: 0, y: 0, kind: 'projectile' });
  t.secs(1.5); t.p.inv = 0; t.p.hurtInv = 0;
  t.p.hurt(999, { x: 0, y: 0, kind: 'projectile' });
  t.run(3);
  assert.ok(Math.abs(t.p.cx - (20 * 32 + 16)) < 40, 'reaparece en el checkpoint');
  assert.ok(t.p.team.every((m) => !m.ko && m.hp === m.maxHp));
});
