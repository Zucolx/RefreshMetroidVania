import test from 'node:test';
import assert from 'node:assert/strict';
import { SpriteSystem } from '../src/render/hybrid.js';
import { drawRig, POSE0 } from '../src/render/rig.js';
import { CONFIG, resetConfig } from '../src/config.js';
import { createKit } from '../src/characters/index.js';

function recCtx() {
  const calls = [];
  const proxy = new Proxy({}, {
    get(_, k) {
      if (k === 'calls') return calls;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...a) => { calls.push([String(k), ...a]); };
    },
    set(_, k, v) { calls.push(['set:' + String(k), v]); return true; },
  });
  return proxy;
}
const fakeImg = { width: 64, height: 64 };
function sys() {
  const s = new SpriteSystem();
  s.defs.set('swordsman.torso', { owner: 'swordsman', slot: 'torso', frames: [[0, 0, 16, 24], [16, 0, 16, 24]], anchor: [0.5, 0.9], fps: 8, loop: true, offset: [0, 0], rot: 0, scale: 1, z: 0, img: fakeImg });
  return s;
}

test('modo Formas: siempre se dibuja la forma procedural', () => {
  resetConfig(); CONFIG.render.mode = 'shapes';
  const s = sys(); const ctx = recCtx();
  let used = 0;
  const sprite = s.slot(ctx, 'swordsman', 'torso', 'idle', 0, { x: 5, y: 6 }, () => { used++; });
  assert.equal(sprite, false); assert.equal(used, 1);
  assert.ok(!ctx.calls.some((c) => c[0] === 'drawImage'));
});

test('modo Sprites: el sprite sustituye a la forma respetando posición y rotación; sin sprite vuelve el fallback', () => {
  resetConfig(); CONFIG.render.mode = 'sprites';
  const s = sys(); const ctx = recCtx();
  let used = 0;
  const sprite = s.slot(ctx, 'swordsman', 'torso', 'idle', 0, { x: 5, y: 6, rot: 0.3 }, () => { used++; });
  assert.equal(sprite, true); assert.equal(used, 0);
  const draw = ctx.calls.find((c) => c[0] === 'drawImage');
  assert.ok(draw, 'drawImage');
  assert.deepEqual(draw.slice(2, 6), [0, 0, 16, 24]);                       // frame 0
  assert.ok(ctx.calls.some((c) => c[0] === 'translate' && c[1] === 5 && c[2] === 6));
  assert.ok(ctx.calls.some((c) => c[0] === 'rotate' && c[1] === 0.3));
  // un slot sin sprite cae al fallback procedural
  const ctx2 = recCtx(); let used2 = 0;
  s.slot(ctx2, 'swordsman', 'head', 'idle', 0, { x: 0, y: 0 }, () => { used2++; });
  assert.equal(used2, 1);
  // la animación avanza por frames
  const ctx3 = recCtx();
  s.slot(ctx3, 'swordsman', 'torso', 'idle', 0.13, { x: 0, y: 0 }, () => {});
  assert.deepEqual(ctx3.calls.find((c) => c[0] === 'drawImage').slice(2, 6), [16, 0, 16, 24]);
});

test('modo Mixto: sprite + silueta procedural semitransparente', () => {
  resetConfig(); CONFIG.render.mode = 'mixed';
  const s = sys(); const ctx = recCtx();
  let used = 0;
  s.slot(ctx, 'swordsman', 'torso', 'idle', 0, { x: 0, y: 0 }, () => { used++; });
  assert.equal(used, 1);
  assert.ok(ctx.calls.some((c) => c[0] === 'drawImage'));
});

test('desactivar el sprite devuelve la forma procedural idéntica', () => {
  resetConfig();
  const s = sys();
  const a = recCtx(), b = recCtx();
  CONFIG.render.mode = 'shapes';
  s.slot(a, 'swordsman', 'torso', 'idle', 0, { x: 1, y: 2 }, (c) => { c.fillRect(0, 0, 4, 4); });
  s.defs.clear();
  CONFIG.render.mode = 'sprites';
  s.slot(b, 'swordsman', 'torso', 'idle', 0, { x: 1, y: 2 }, (c) => { c.fillRect(0, 0, 4, 4); });
  assert.deepEqual(a.calls, b.calls);
});

test('z configurable: el z del sprite reordena los slots; búsqueda owner.slot.anim → owner.slot → *.slot', () => {
  resetConfig(); CONFIG.render.mode = 'sprites';
  const s = new SpriteSystem();
  s.defs.set('*.fx', { frames: [[0, 0, 4, 4]], anchor: [0.5, 0.5], fps: 1, loop: true, offset: [0, 0], rot: 0, scale: 1, z: 0, img: fakeImg });
  s.defs.set('wolf.body.bite', { frames: [[0, 0, 8, 8]], anchor: [0.5, 0.5], fps: 1, loop: true, offset: [0, 0], rot: 0, scale: 1, z: 0, img: fakeImg });
  assert.ok(s.find('wolf', 'body', 'bite'));
  assert.equal(s.find('wolf', 'body', 'run'), null);
  assert.ok(s.find('cualquiera', 'fx', 'x'));
  const order = [];
  s.defs.set('a.legs', { frames: [[0, 0, 1, 1]], anchor: [0, 0], fps: 1, loop: true, offset: [0, 0], rot: 0, scale: 1, z: 10, img: fakeImg });
  s.slots(recCtx(), 'a', 'idle', 0, [
    { slot: 'legs', z: 1, xf: {}, fb: () => order.push('legs') },
    { slot: 'torso', z: 2, xf: {}, fb: () => order.push('torso') },
  ]);
  assert.deepEqual(order, ['torso'], 'legs usa sprite (z 10) y torso va por fallback');
});

for (const id of ['swordsman', 'mage', 'artificer', 'alchemist', 'puppeteer', 'clockmaker']) {
  test(`${id}: el muñeco se dibuja por slots (legs, torso, head, arm, weapon) con y sin sprites`, () => {
    resetConfig();
    const kit = createKit(id);
    const p = { facing: 1, animName: 'idle_base', charging: false, swingAnim: null, runMode: null, in: {}, onGround: true, vx: 0 };
    for (const mode of ['shapes', 'sprites', 'mixed']) {
      CONFIG.render.mode = mode;
      const ctx = recCtx();
      assert.doesNotThrow(() => drawRig(ctx, p, kit, { ...POSE0 }, 0));
      assert.ok(ctx.calls.length > 20);
    }
    CONFIG.render.mode = 'shapes';
  });
}
