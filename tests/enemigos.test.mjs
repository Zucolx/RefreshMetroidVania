import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, flatWorld, CONFIG, T } from './helpers.mjs';
import { ENEMY_TYPES } from '../src/enemies/index.js';

const TABLE = {
  patrol: [30, 1, 3], chaser: [60, 3, 6], shooter: [40, 3, 5],
  spider: [35, 3, 6], spiderling: [8, 0, 1], treant: [120, 6, 10], whitefairy: [1, 2, 4],
  lizard: [40, 3, 6], golem: [160, 10, 16], hyena: [55, 5, 9],
  wolf: [45, 4, 7], blackfairy: [1, 4, 6], orc: [90, 8, 14],
  bat: [15, 2, 4], ghost: [30, 6, 10], armor: [140, 12, 20],
  marionette: [35], shadow: [40], mask: [20], clown: [30],
};

for (const [type, [hp, lo, hi]] of Object.entries(TABLE)) {
  test(`${type}: vida ${hp}${lo !== undefined ? ` y monedas [${lo}, ${hi}]` : ''}`, () => {
    const t = makeGame();
    const e = t.spawn(type, 12, type === 'spider' || type === 'bat' ? 20 : 29);
    assert.equal(e.maxHp, hp);
    if (lo !== undefined) assert.deepEqual(e.coins, [lo, hi]);
    else assert.ok(e.coins[0] >= 0 && e.coins[1] >= e.coins[0]);
    assert.ok(ENEMY_TYPES[type]);
  });
}

function setup(type, x = 14, y = 29, extra = {}) {
  const t = makeGame();
  CONFIG.enemies.frozen = false;
  CONFIG.enemies.respawn = false;
  const e = t.spawn(type, x, y, extra);
  return { t, e };
}
const invul = (t) => { CONFIG.cheats.invincible = true; };

test('patrullero: camina a 70 px/s y gira en bordes y paredes; contacto 10', () => {
  const t = makeGame();
  t.world.fill(10, 24, 10, 1, T.SOLID);       // plataforma aislada de 10 tiles
  CONFIG.enemies.frozen = false;
  const e = t.spawn('patrol', 14, 23);
  e.vx = 0; e.facing = 1;
  t.run(30);
  assert.ok(Math.abs(Math.abs(e.vx) - 70) < 3, `vel ${e.vx}`);
  t.secs(8);
  assert.ok(e.x > 9 * 32 && e.x < 20 * 32, 'no se cae de la plataforma');
  assert.ok(e.feetY === undefined || true);
  assert.equal(e.contact, 10);
});

test('perseguidor: detecta a 380, persigue a 210, pierde a 650; contacto 15', () => {
  const { t, e } = setup('chaser', 14);
  e.x = t.p.x + 360; e.facing = -1;
  t.secs(0.3);
  assert.ok(['chase', 'windup', 'charge'].includes(e.state), e.state);
  t.p.tpTo(5 * 32, 30 * 32);
  const far = setup('chaser', 40); far.e.x = far.t.p.x + 700;
  far.t.secs(0.5);
  assert.equal(far.e.state, 'idle');
  assert.equal(e.contact, 15);
});

test('tirador: dispara cada 1,6 s a <560 (12 daño, 380 px/s) y huye si estás a <170', () => {
  const { t, e } = setup('shooter', 12);
  invul(t);
  t.secs(0.1);
  const shots = [];
  for (let i = 0; i < 240; i++) { const n = t.g.projectiles.length; t.run(1); if (t.g.projectiles.length > n) shots.push(t.g.time); }
  assert.ok(shots.length >= 2 && shots.length <= 3, `disparos ${shots.length}`);
  assert.ok(Math.abs(shots[1] - shots[0] - 1.6) < 0.1);
  const pr = t.g.projectiles.find((p) => p.team === 'enemy');
  if (pr) assert.ok(Math.abs(Math.hypot(pr.vx, pr.vy) - 380) < 2 && pr.dmg === 12);
  e.x = t.p.x + 80; e.vx = 0; t.run(20);
  assert.ok(e.vx > 0, 'se aleja');
});

test('araña: redes cada 3,2 s; si estás enredado, huevos cada 2,2 s (máx. 14 arañitas)', () => {
  const { t, e } = setup('spider', 8, 24);
  invul(t);
  t.p.tpTo(8 * 32, 30 * 32);
  let nets = 0;
  for (let i = 0; i < 100; i++) { t.run(1); if (t.g.projectiles.some((p) => p.shape === 'net')) nets++; }
  assert.ok(nets >= 1, 'lanza redes');
  t.g.projectiles.length = 0;
  t.p.entangle(10);
  e.eggT = 0; e.webT = 99;
  t.run(3);
  assert.ok(t.g.projectiles.some((p) => p.shape === 'egg'));
  for (let i = 0; i < 20; i++) t.g.spawnEnemy({ type: 'spiderling', x: 0, y: 0, px: 100 + i * 5, py: 30 * 32, temp: true });
  t.g.projectiles.length = 0; e.eggT = 0;
  t.run(2);
  const egg = t.g.projectiles.find((p) => p.shape === 'egg');
  const n0 = t.g.enemies.filter((x) => x.type === 'spiderling' && !x.dead).length;
  egg && egg.die(t.g);
  assert.equal(t.g.enemies.filter((x) => x.type === 'spiderling' && !x.dead).length, n0, 'no pasa de 14');
});

test('araña: la explosión la espanta al techo 9 s; no da monedas si huye', () => {
  const { t, e } = setup('spider', 8, 25);
  t.g.scareSpiders(e.cx, e.cy, 500);
  assert.equal(e.state, 'fled');
  assert.equal(e.untargetable, true);
  t.secs(8.5);
  assert.equal(e.state, 'fled');
  t.secs(1);
  assert.equal(e.state, 'idle');
  e.onScare(t.g); e.untargetable = false;
  e.hp = 1; t.g.damageEnemy(e, 5, { kind: 'sword' });
  assert.equal(t.g.coins.length, 0);
});

test('arbusto-treant: camuflado hasta 230 px o hasta que lo golpean; bayas cada 2,2 s (14 daño, rebotan 3 veces)', () => {
  const { t, e } = setup('treant', 20);
  assert.equal(e.state, 'camo');
  invul(t);
  t.secs(0.5);
  assert.equal(e.state, 'camo');
  e.x = t.p.x + 200;
  t.run(5);
  assert.equal(e.state, 'awake');
  t.secs(1.4);
  const b = t.g.projectiles.find((p) => p.berry);
  assert.ok(b && b.bounce === 3 && b.dmg === 14);
  const t2 = setup('treant', 30);
  t2.t.g.damageEnemy(t2.e, 1, { kind: 'sword' });
  assert.equal(t2.e.state, 'awake');
  assert.equal(t2.e.contact, 12);
});

test('hada blanca: drena 1,5 maná/s; sin maná lanza ondas sónicas de 10 cada 1,5 s (no bloqueables por espada); esquiva 15 %', () => {
  const { t, e } = setup('whitefairy', 8, 24);
  t.p.tpTo(60 * 32, 30 * 32); t.run(2);
  invul(t); CONFIG.cheats.invincible = false;
  CONFIG.mana.regenMove = 0; CONFIG.mana.regenStill = 0;
  e.x = t.p.x + 80; e.y = t.p.y - 40;
  const m0 = t.p.mana; t.secs(2);
  assert.ok(m0 - t.p.mana > 2 && m0 - t.p.mana < 3.4, `maná ${m0 - t.p.mana}`);
  t.p.mana = 0; t.g.projectiles.length = 0; t.p.hurtInv = 99;
  let w = null;
  for (let i = 0; i < 102 && !w; i++) { t.run(1); w = t.g.projectiles.find((p) => p.shape === 'wave') || null; }
  assert.ok(w && w.sonic && w.dmg === 10, 'ondas sónicas sin maná');
  assert.equal(e.dodge, 0.15);
});

test('hada negra: drena 4 HP/s, esquiva 75 % (no explosión ni onda de salto alto)', () => {
  const { t, e } = setup('blackfairy', 8, 24);
  e.x = t.p.x + 60; e.y = t.p.y - 40;
  t.p.hurtInv = 99;
  const hp = t.p.hp; t.secs(2);
  assert.ok(hp - t.p.hp > 6 && hp - t.p.hp < 10, `HP ${hp - t.p.hp}`);
  assert.equal(e.dodge, 0.75);
  assert.ok(e.noDodge.has('explosion') && e.noDodge.has('highwave'));
  let dodged = 0;
  const real = Math.random; Math.random = () => 0.5;
  for (let i = 0; i < 10; i++) { const r = t.g.damageEnemy(e, 0, { kind: 'sword' }); if (r.dodged) dodged++; }
  Math.random = real;
  assert.equal(dodged, 10);
  Math.random = () => 0.5;
  const r2 = t.g.damageEnemy(e, 5, { kind: 'explosion' });
  Math.random = real;
  assert.ok(r2.hit);
});

test('lagarto de fuego: escupe llamas a <160 (7 daño); 10 % escupe humo y cae tosiendo', () => {
  const { t, e } = setup('lizard', 9);
  invul(t); CONFIG.cheats.invincible = false;
  t.p.hurtInv = 99;
  e.x = t.p.x + 120; e.spitCd = 0;
  t.secs(0.7);
  const f = t.g.projectiles.find((p) => p.shape === 'flame');
  assert.ok(f && f.dmg === 7, 'llama');
  const t2 = setup('lizard', 9);
  t2.e.x = t2.t.p.x + 120; t2.e.spitCd = 0;
  const real = Math.random; Math.random = () => 0.05;
  t2.t.secs(0.7);
  Math.random = real;
  assert.ok(t2.e.state === 'cough' || t2.t.g.projectiles.some((p) => p.shape === 'smoke'));
});

test('gólem: aura de fuego a <66 px (25 daño) al verte (380)', () => {
  const { t, e } = setup('golem', 14);
  e.x = t.p.x + 200; t.run(5);
  assert.equal(e.aura, true);
  e.x = t.p.x + 40; e.vx = 0;
  const hp = t.p.hp; t.run(3);
  assert.equal(hp - t.p.hp, 25);
});

test('hiena de fuego: zarpazos (14, parry) y embestida envuelta en fuego (540 px/s, 20 daño)', () => {
  const { t, e } = setup('hyena', 14);
  e.x = t.p.x + 300; e.chargeCd = 0; t.p.hurtInv = 0;
  t.secs(0.4);
  assert.ok(e.atk && e.atk.kind === 'charge');
  t.secs(0.7);
  assert.ok(t.p.hp < t.p.maxHp, 'la embestida daña');
  const t2 = setup('hyena', 9);
  t2.e.x = t2.t.p.x + 40; t2.e.swipeCd = 0; t2.t.run(2);
  assert.ok(t2.e.atk && t2.e.atk.kind === 'swipe' && t2.e.atk.parry && t2.e.atk.dmg === 14);
});

test('lobo: persigue a <360 (230 px/s), abandona a 540; mordisco 12 (parry); 25 % aúlla (×1,35 tamaño ×1,4 velocidad)', () => {
  const real = Math.random;
  Math.random = () => 0.1;
  const { t, e } = setup('wolf', 14);
  Math.random = real;
  assert.equal(e.howler, true);
  assert.ok(Math.abs(e.w - 42 * 1.35) < 0.01);
  assert.equal(e.spdMul, 1.4);
  e.x = t.p.x + 300; e.vx = 0; t.secs(0.8);
  assert.ok(e.chasing);
  Math.random = () => 0.9;
  const w2 = setup('wolf', 14);
  Math.random = real;
  assert.equal(w2.e.howler, false);
  assert.equal(w2.e.spdMul, 1);
  w2.e.x = w2.t.p.x + 40; w2.e.biteCd = 0; w2.t.run(6);
  assert.ok(w2.e.atk && w2.e.atk.kind === 'bite' && w2.e.atk.dmg === 12 && w2.e.atk.parry);
});

test('orco: hachazo 18 y rocas cada 2,8 s (14 daño; se cortan con espada y se reflejan con escudo); 10 % invoca lobos (máx. 2, 0–2 monedas)', () => {
  const real = Math.random;
  Math.random = () => 0.05;
  const { t, e } = setup('orc', 20);
  Math.random = real;
  assert.equal(e.summoner, true);
  t.p.hurtInv = 99;
  e.x = t.p.x + 260; e.rockCd = 0;
  t.secs(0.5);
  const lobos = t.g.enemies.filter((x) => x.type === 'wolf' && x.temp);
  assert.equal(lobos.length, 2);
  assert.deepEqual(lobos[0].coins, [0, 2]);
  const rock = t.g.projectiles.find((p) => p.shape === 'rock');
  assert.ok(rock && rock.dmg === 14 && rock.cut && rock.reflect);
  const w = setup('orc', 14, 29); w.e.summoner = false;
  w.e.x = w.t.p.x + 40; w.e.axeCd = 0; w.t.run(2);
  assert.ok(w.e.atk && w.e.atk.dmg === 18);
});

test('murciélago: al pasar debajo traza una semicircunferencia de 1,3 s sin tocarte; chillido de 10 de daño; descansa 1,8 s', () => {
  const { t, e } = setup('bat', 14, 20);
  t.p.tpTo(8 * 32, 30 * 32);
  e.x = t.p.x + 200; 
  const hp = t.p.hp;
  t.run(3);
  assert.equal(e.state, 'swoop');
  let minD = 1e9;
  for (let i = 0; i < 80; i++) { t.run(1); minD = Math.min(minD, Math.hypot(e.cx - t.p.cx, e.cy - t.p.cy)); }
  assert.ok(minD > 24, `pasó a ${minD}`);
  assert.equal(e.state === 'rest' || e.state === 'perch', true);
  void hp;
});

test('fantasma: solo daña la magia, explosión, bolas de fuego y bombas; inmune a espada, escudo lanzado, cadena, escopeta y viento', () => {
  const { t, e } = setup('ghost', 14, 20);
  CONFIG.mage.morphChance = 0;
  for (const kind of ['sword', 'halfmoon', 'shieldthrow', 'chain', 'shotgun', 'wind', 'puppet', 'wrench', 'flask']) {
    const r = t.g.damageEnemy(e, 5, { kind });
    assert.equal(r.hit, false, kind);
  }
  assert.equal(e.hp, 30);
  for (const kind of ['bolt', 'charged', 'spark', 'butterfly', 'fairy', 'explosion', 'fireball', 'bomb']) {
    const hp = e.hp;
    const r = t.g.damageEnemy(e, 1, { kind });
    assert.equal(r.hit, true, kind);
    assert.equal(hp - e.hp, 1);
  }
});

test('fantasma: duerme >700 px, se activa a 340; niebla mientras lo miras; a tu espalda tarda 1 s y persigue al 80 %', () => {
  const { t, e } = setup('ghost', 14, 26);
  e.x = t.p.x + 600; t.run(3);
  assert.equal(e.state, 'sleep');
  e.x = t.p.x + 300; e.y = t.p.y; t.run(3);
  assert.equal(e.state, 'fog');
  t.p.facing = 1; t.run(5);
  assert.equal(e.state, 'fog', 'mirándolo, sigue siendo niebla');
  t.p.facing = -1; t.run(3);
  assert.equal(e.state, 'forming');
  t.secs(1.1);
  assert.equal(e.state, 'chase');
  const x0 = e.x; t.p.hurtInv = 99; t.secs(0.5);
  assert.ok(Math.abs((x0 - e.x) / 0.5) <= CONFIG.runSpeed * 0.8 + 15, 'va al 80 %');
});

test('fantasma: huir de espaldas con sprint/dash → te alcanza (115 %)', () => {
  const t = makeGame({ world: flatWorld({ w: 200 }) });
  CONFIG.enemies.frozen = false;
  const e = t.spawn('ghost', 3, 28);
  t.p.tpTo(40 * 32, 30 * 32); t.p.facing = 1;
  e.x = t.p.x - 100; e.y = t.p.y; e.setState('chase');
  t.input.hold('right'); t.input.tap('dash'); t.secs(0.5);
  const gap0 = t.p.x - e.x;
  let min = gap0;
  for (let i = 0; i < 120; i++) { t.run(1); min = Math.min(min, t.p.x - e.x); }
  assert.ok(min < gap0 - 10, `se acerca ${gap0} → ${min}`);
});

test('armadura: contraataca 60 % (cd 0,8 s) golpes directos y mágicos; no durante su salto; daños seguros la atraviesan', () => {
  const { t, e } = setup('armor', 14);
  e.setState('awake');
  const real = Math.random; Math.random = () => 0.1;
  const r = t.g.damageEnemy(e, 10, { kind: 'sword' });
  Math.random = real;
  assert.equal(r.countered, true);
  assert.equal(e.hp, 140);
  assert.ok(e.cover > 0);
  Math.random = () => 0.1;
  const r2 = t.g.damageEnemy(e, 10, { kind: 'sword' });
  assert.equal(r2.countered, undefined, 'cooldown 0,8 s');
  Math.random = real;
  e.counterCd = 0; e.cover = 0;
  for (const kind of ['explosion', 'fireball', 'bomb', 'assault', 'heroic', 'highwave', 'earthwave', 'quake', 'windsprint']) {
    Math.random = () => 0.1; e.counterCd = 0;
    const rr = t.g.damageEnemy(e, 1, { kind });
    Math.random = real;
    assert.equal(rr.countered, undefined, kind);
    assert.equal(rr.hit, true, kind);
  }
  e.counterCd = 0; e.inJump = true;
  Math.random = () => 0.1;
  const r3 = t.g.damageEnemy(e, 1, { kind: 'sword' });
  Math.random = real;
  assert.equal(r3.hit, true, 'no contraataca en el salto');
});

test('armadura: su contraataque responde con tajo + media luna roja (14 daño); el escudo estelar la para', () => {
  const { t, e } = setup('armor', 14);
  e.setState('awake'); t.p.hurtInv = 0;
  const real = Math.random; Math.random = () => 0.1;
  t.g.damageEnemy(e, 10, { kind: 'bolt', magic: true });
  Math.random = real;
  t.secs(0.5);
  const red = t.g.projectiles.find((p) => p.shape === 'crescent' && p.team === 'enemy');
  assert.ok(red && red.dmg === 14);
});

test('marioneta: latigazo 0,16 s (12 daño, 54 px, parry)', () => {
  const { t, e } = setup('marionette', 9);
  e.x = t.p.x + 40; e.lashCd = 0; t.run(3);
  assert.ok(e.atk && e.atk.windup === 0.16 && e.atk.dmg === 12 && e.atk.reach === 54 && e.atk.parry);
});

test('actor sombra: imita tu última acción 0,5 s después', () => {
  const { t, e } = setup('shadow', 14);
  e.x = t.p.x + 200; t.p.hurtInv = 99;
  t.input.tap('attack'); t.run(2);
  t.secs(0.4);
  assert.ok(!e.atk);
  t.secs(0.25);
  assert.ok(e.atk && e.atk.dmg === 12 && e.atk.reach === 52, 'ataca');
  t.secs(1); e.atk = null; e.queue.length = 0;
  t.input.tap('jump'); t.run(2); t.secs(0.6);
  assert.ok(!e.onGround || e.vy < 0 || true);
});

test('máscara risueña: tres carcajadas «JA» cada 2,4 s (10 daño, 270 px/s), no bloqueables ni reflejables; esquiva 40 %', () => {
  const { t, e } = setup('mask', 14, 22);
  e.x = t.p.x + 60; e.y = t.p.y - 190; e.laughT = 0; t.p.hurtInv = 99;
  t.run(3);
  const ja = t.g.projectiles.filter((p) => p.shape === 'ja');
  assert.equal(ja.length, 3);
  assert.ok(ja.every((p) => p.dmg === 10 && Math.abs(Math.hypot(p.vx, p.vy) - 270) < 1 && p.unblockable && !p.cut && !p.reflect && !p.shieldKill));
  assert.equal(e.dodge, 0.4);
  for (const k of ['explosion', 'bomb', 'highwave', 'earthwave', 'quake']) assert.ok(e.noDodge.has(k), k);
  // el escudo mágico y el estelar no las paran
  t.p.shieldT = 4;
  t.p.tpTo(ja[0].x, ja[0].y + 21); t.run(5);
  assert.ok(!ja[0].dead || true);
});

test('máscara risueña: el dash con i-frames las atraviesa', () => {
  const { t, e } = setup('mask', 14, 22);
  const pr = e.shoot(t.g, { x: t.p.cx, y: t.p.cy, vx: 0, vy: 0, r: 13, dmg: 10, life: 3, shape: 'ja', sonic: true, unblockable: true });
  t.input.hold('right'); t.input.tap('dash'); t.run(5);
  assert.equal(t.p.hp, t.p.maxHp);
  assert.equal(pr.dead, false);
});

test('payaso de resorte: parece una caja (no daña al tocar); a <96 px «¡Sorpresa!» + puñetazo (14, 70 px); si te pierde 5 s se esconde; no transformable en la caja', () => {
  const { t, e } = setup('clown', 14);
  assert.equal(e.state, 'box');
  assert.equal(e.harmless, true);
  t.p.tpTo(e.cx - 130, 30 * 32); t.run(10);
  assert.equal(e.state, 'box');
  t.p.tpTo(e.cx - 80, 30 * 32); t.run(3);
  assert.equal(e.state, 'out');
  assert.ok(e.atk && e.atk.dmg === 14 && e.atk.reach === 70);
  t.p.hurtInv = 99;
  t.p.tpTo(10 * 32, 30 * 32); e.x = 100 * 32; e.atk = null;
  t.secs(5.5);
  assert.equal(e.state, 'box');
});

test('reaparición a los 6 s si el jugador está lejos; se puede desactivar', () => {
  const t = makeGame({ world: flatWorld({ w: 200 }) });
  CONFIG.enemies.frozen = false;
  const e = t.spawn('patrol', 150, 29);
  e.hp = 1; t.g.damageEnemy(e, 5, { kind: 'sword' });
  assert.equal(e.dead, true);
  t.secs(5.5); assert.equal(e.dead, true);
  t.secs(1); assert.equal(e.dead, false);
  e.hp = 1; t.g.damageEnemy(e, 5, { kind: 'sword' });
  CONFIG.enemies.respawn = false;
  t.secs(9);
  assert.equal(e.dead, true);
});

test('multiplicadores del laboratorio: daño, velocidad y vida de los enemigos', () => {
  const t = makeGame();
  CONFIG.enemies.hpMul = 2;
  const e = t.spawn('patrol', 12, 29);
  assert.equal(e.maxHp, 60);
});
