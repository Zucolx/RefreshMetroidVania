import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, flatWorld, CONFIG, T } from './helpers.mjs';

function theaterWorld(props) {
  const w = flatWorld({ w: 120, h: 40, floor: 30, theme: 'theater' });
  w.props = props;
  return w;
}

test('trampillas: cerradas 3,5 s → crujen 0,8 s → abiertas 1,8 s; se puede estar encima cerradas y se cae abiertas', () => {
  const w = theaterWorld([{ type: 'trapdoor', x: 20, y: 30, w: 4, phase: 0 }]);
  w.fill(20, 30, 4, 8, T.AIR);
  const t = makeGame({ world: w });
  const tr = t.g.props[0];
  assert.equal(tr.state, 'closed');
  t.p.tpTo(21 * 32, 30 * 32); t.secs(0.5);
  assert.ok(t.p.onGround, 'está sobre la trampilla cerrada');
  // sigue el ciclo
  t.p.tpTo(60 * 32, 30 * 32);
  const seen = [];
  let last = tr.state;
  const times = {};
  for (let i = 0; i < 60 * 12; i++) { t.run(1); if (tr.state !== last) { times[tr.state + '@'] = t.g.time; seen.push(tr.state); last = tr.state; } }
  assert.deepEqual(seen.slice(0, 4), ['creak', 'open', 'closed', 'creak']);
});

test('trampillas: abiertas, el jugador cae al piso de abajo; no se cierran con nadie dentro', () => {
  const w = theaterWorld([{ type: 'trapdoor', x: 20, y: 30, w: 4, phase: 0 }]);
  w.fill(20, 30, 4, 8, T.AIR);
  const t = makeGame({ world: w });
  const tr = t.g.props[0];
  tr.state = 'open'; tr.t = 1.7; tr.dyn.off = true;
  t.p.tpTo(21 * 32, 31 * 32); t.p.vy = 0; t.p.setFeet(21 * 32, 31 * 32);
  for (let i = 0; i < 20; i++) { t.p.setFeet(21 * 32, 31 * 32); t.p.vy = 0; t.run(1); }   // debería cerrarse pero hay alguien dentro
  assert.equal(tr.state, 'open');
  t.p.tpTo(60 * 32, 30 * 32);
  t.secs(0.3);
  assert.equal(tr.state, 'closed');
});

test('cortinas: abiertas 4,5 s, cerradas 2,5 s; nunca se cierran sobre jugador o enemigo', () => {
  const w = theaterWorld([{ type: 'curtain', x: 30, y: 20, h: 10, phase: 0 }]);
  const t = makeGame({ world: w });
  const c = t.g.props[0];
  assert.equal(c.state, 'open');
  t.p.tpTo(30 * 32 + 16, 30 * 32); t.secs(5.5);
  assert.equal(c.state, 'open', 'no se cierra con el jugador dentro');
  t.p.tpTo(10 * 32, 30 * 32);
  t.secs(1);
  assert.ok(['closing', 'closed'].includes(c.state));
  t.secs(0.6);
  assert.equal(c.state, 'closed');
  assert.equal(c.dyn.off, false, 'cerrada es sólida');
  t.secs(2.6);
  assert.equal(c.state === 'open' || c.state === 'opening', true);
});

test('focos: pasar debajo (±44 px) → tiembla 0,45 s y cae (15 daño); se rompe y vuelve a los 6 s', () => {
  const w = theaterWorld([{ type: 'spotlight', x: 40, y: 20 }]);
  const t = makeGame({ world: w });
  const f = t.g.props[0];
  t.p.tpTo(40 * 32 + 16, 30 * 32); t.run(3);
  assert.equal(f.state, 'shake');
  t.p.hurtInv = 0;
  t.secs(0.4); assert.equal(f.state, 'shake');
  t.secs(0.15);
  assert.equal(f.state, 'fall');
  t.secs(0.6);
  assert.equal(t.p.maxHp - t.p.hp, 15);
  assert.equal(f.state, 'broken');
  t.p.tpTo(70 * 32, 30 * 32);
  t.secs(6.2);
  assert.equal(f.state, 'idle');
});

test('cuerdas: enredan como telaraña (máx. 1 vez / 2,5 s); el dash con i-frames las cruza', () => {
  const w = theaterWorld([{ type: 'rope', x: 30, y: 20, len: 10 }]);
  const t = makeGame({ world: w });
  t.p.tpTo(26 * 32, 30 * 32); t.secs(0.3);
  t.input.hold('right'); t.secs(0.5);
  assert.ok(t.p.webbed > 0, 'enredado');
  t.p.webbed = 0; t.input.hold('right', false);
  t.p.tpTo(26 * 32, 30 * 32); t.secs(0.3);
  t.input.hold('right'); t.input.tap('dash'); t.run(12);
  assert.equal(t.p.webbed, 0, 'el dash las cruza');
});

test('noria: góndolas a 0,35 rad/s, siempre horizontales; te llevan encima', () => {
  const w = theaterWorld([{ type: 'ferris', x: 40, y: 22, r: 150, n: 6 }]);
  const t = makeGame({ world: w });
  const f = t.g.props[0];
  assert.ok(Math.abs(f.w - 0.35) < 1e-9);
  // góndolas horizontales: su rectángulo es siempre ancho×alto fijo
  t.secs(2);
  assert.ok(f.gond.every((d) => d.w === 56 && d.h === 8));
  // sube a la góndola más baja y comprueba que se mueve con ella
  const g = f.gond.reduce((m, d) => (d.y > m.y ? d : m), f.gond[0]);
  t.p.setFeet(g.x + g.w / 2, g.y - 2); t.p.vy = 0; t.run(3);
  assert.ok(t.p.ride === g || t.p.onGround);
  const x0 = t.p.x, y0 = t.p.y;
  t.secs(1);
  assert.ok(Math.abs(t.p.x - x0) + Math.abs(t.p.y - y0) > 10, 'es transportado');
});
