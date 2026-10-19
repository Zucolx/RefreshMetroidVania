import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, CONFIG, T } from './helpers.mjs';

function dummy(t, x, hp = 1000, type = 'patrol') {
  CONFIG.enemies.frozen = true;
  const e = t.spawn(type, x, 29);
  e.hp = e.maxHp = hp;
  return e;
}

test('llave de cuerda ×3: 10 / 10 / 16; cada acierto deja una marca y a los 0,3 s se repite a mitad de daño', () => {
  const t = makeGame({ team: ['clockmaker'] });
  CONFIG.mana.regenMove = 0; CONFIG.mana.regenStill = 0; t.p.mana = 5;
  const e = dummy(t, 6);   // pegado
  t.input.tap('attack'); t.run(14);
  assert.equal(1000 - e.hp, 10, 'golpe');
  assert.equal(t.p.kit.marks.length, 1, 'marca temporal');
  t.secs(0.45);
  assert.equal(1000 - e.hp, 15, 'eco a mitad de daño');
  assert.ok(Math.abs(t.p.mana - 5.5) < 0.01, `maná ${t.p.mana}`);
});

test('el eco no ocurre si el enemigo se aleja a más de 80 px', () => {
  const t = makeGame({ team: ['clockmaker'] });
  const e = dummy(t, 6);
  t.input.tap('attack'); t.run(14);
  e.x += 120;
  t.secs(0.5);
  assert.equal(1000 - e.hp, 10);
});

test('el eco también golpea a lo que esté encima del marcado', () => {
  const t = makeGame({ team: ['clockmaker'] });
  const e = dummy(t, 6);
  const up = t.spawn('patrol', 6, 26); up.hp = up.maxHp = 1000; up.x = e.x; up.y = e.y - 50; up.vy = 0;
  t.input.tap('attack'); t.run(14); up.y = e.y - 50;
  t.secs(0.45);
  assert.ok(1000 - up.hp >= 5, `encima ${1000 - up.hp}`);
});

test('burbuja de tiempo (mantener 0,8 s): golpe de 14 + burbuja de 90 px / 1,2 s con enemigos y proyectiles al 50 %', () => {
  const t = makeGame({ team: ['clockmaker'] });
  const e = dummy(t, 8);
  t.input.hold('attack'); t.secs(0.9); t.input.hold('attack', false); t.run(10);
  assert.ok(1000 - e.hp >= 14, `daño ${1000 - e.hp}`);
  const z = t.g.zones.find((q) => q.kind === 'bubble');
  assert.ok(z && z.r === 90);
  const o = dummy(t, 20, 90, 'orc');
  CONFIG.enemies.frozen = false;
  const pr = o.shoot(t.g, { x: z.x, y: z.y, vx: 200, vy: 0, r: 8, dmg: 14, life: 3, shape: 'orb' });
  const x0 = pr.x; t.run(6);
  assert.ok(pr.x - x0 < 200 * 0.1 * 0.75, `proyectil ralentizado ${pr.x - x0}`);
  t.secs(1.5);
  assert.equal(t.g.zones.filter((q) => q.kind === 'bubble').length, 0, 'dura 1,2 s');
});

test('aguja (↓ + aéreo): rebota 740 en suelo, pinchos, lava, enemigo (12) o proyectil (destruye)', () => {
  const t = makeGame({ team: ['clockmaker'] });
  t.p.setFeet(10 * 32 + 16, 30 * 32 - 40); t.p.vy = 100; t.p.onGround = false; t.p.airJumps = 0;
  t.input.hold('down'); t.input.tap('attack'); t.run(2);
  assert.ok(t.p.vy < -600, `suelo ${t.p.vy}`);
  assert.equal(t.p.airJumps, 1);
  const t2 = makeGame({ team: ['clockmaker'] });
  const e = dummy(t2, 5); e.x = 5 * 32 + 16 - e.w / 2;
  t2.p.setFeet(5 * 32 + 16, e.y - 40); t2.p.vy = 100; t2.p.onGround = false;
  t2.input.hold('down'); t2.input.tap('attack'); t2.run(2);
  assert.equal(1000 - e.hp, 12);
  assert.ok(t2.p.vy < -600);
  // el alcance es de 70 px
  const t3 = makeGame({ team: ['clockmaker'] });
  t3.p.tpTo(10 * 32, 10 * 32); t3.p.vy = 100;
  t3.input.hold('down'); t3.input.tap('attack'); t3.run(2);
  assert.ok(t3.p.vy > 0);
});

test('aguja sobre pinchos: marca temporal; a los 0,5 s el rebote se repite y se encadenan', () => {
  const t = makeGame({ team: ['clockmaker'] });
  for (let x = 4; x < 14; x++) t.world.set(x, 29, T.SPIKE);
  t.p.setFeet(10 * 32 + 16, 29 * 32 - 40); t.p.vy = 100; t.p.onGround = false;
  t.input.hold('down'); t.input.tap('attack'); t.run(2);
  assert.ok(t.p.vy < -600);
  t.input.hold('down', false);
  // el segundo rebote llega a los 0,5 s si seguimos sobre pinchos
  let bounces = 0, last = 0;
  t.p.vy = -50; // apenas se mueve
  for (let i = 0; i < 80; i++) { t.run(1); if (t.p.vy < last - 400) bounces++; last = t.p.vy; }
  assert.ok(bounces >= 1, 'rebote repetido');
});

test('Marca y retroceso: pulsar deja marca (también en el aire); pulsar de nuevo vuelve al instante, quieto, 0,5 s invulnerable', () => {
  const t = makeGame({ team: ['clockmaker'] });
  t.p.tpTo(10 * 32, 28 * 32); t.run(3);
  const x0 = t.p.cx, y0 = t.p.cy;
  t.input.tap('special'); t.run(2);
  assert.ok(t.p.kit.mark);
  t.input.hold('right'); t.secs(0.5); t.input.hold('right', false);
  t.p.hp = 50;
  t.input.tap('special'); t.run(1);
  assert.ok(Math.abs(t.p.cx - x0) < 2 && Math.abs(t.p.cy - y0) < 3, 'ha vuelto');
  assert.equal(t.p.vx, 0);
  assert.ok(t.p.inv > 0.4);
  assert.ok(t.p.hp <= 50 + 0.01, 'no restaura vida');
  assert.ok(t.p.kit.cd.mark > 5.5, 'recarga 6 s');
});

test('Marca y retroceso: caduca a los 4 s y se pierde si el escenario la tapa', () => {
  const t = makeGame({ team: ['clockmaker'] });
  t.input.tap('special'); t.run(2);
  t.secs(4.2);
  assert.equal(t.p.kit.mark, null);
  assert.ok(t.p.kit.cd.mark > 5);
  const t2 = makeGame({ team: ['clockmaker'] });
  t2.input.tap('special'); t2.run(2);
  t2.world.fill(Math.floor(t2.p.kit.mark.x / 32) - 1, 26, 3, 4, T.SOLID);
  t2.run(2);
  assert.equal(t2.p.kit.mark, null);
});

test('estela de estasis (dash a velocidad máxima): enemigos que la cruzan al 50 % durante 1,5 s', () => {
  const t = makeGame({ team: ['clockmaker'] });
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.5);
  t.input.tap('dash'); t.secs(0.5);
  const z = t.g.zones.find((q) => q.kind === 'stasis');
  assert.ok(z, 'estela');
  const e = dummy(t, 40);
  e.x = z.x - e.w / 2; e.y = z.y - e.h / 2;
  t.run(3);
  assert.ok(e.slowF <= 0.5 + 1e-6);
  assert.ok(e.slowT > 1);
});

test('entrada heroica: esfera de reloj y pulso a 0,45 s que ralentiza al 35 % durante 2 s a enemigos <200 px', () => {
  const t = makeGame({ team: ['mage', 'clockmaker'] });
  const e = dummy(t, 12); e.x = t.p.x + 120;
  const far = dummy(t, 90);
  t.p.hurt(500, { x: 0, y: 0, kind: 'projectile' });
  assert.equal(t.p.kit.id, 'clockmaker');
  t.secs(0.7);
  assert.ok(e.slowF <= 0.35 + 1e-6 && e.slowT > 1.5, `slow ${e.slowF} ${e.slowT}`);
  assert.equal(far.slowF, 1);
});
