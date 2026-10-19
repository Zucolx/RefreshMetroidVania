import test from 'node:test';
import assert from 'node:assert/strict';
import { controls, Controls, DEFAULT_KEYS, DEFAULT_PAD, ACTIONS, padFamily, padLabel, keyLabel } from '../src/controls.js';
import { Input } from '../src/input.js';
import { platform } from '../src/platform.js';
import { Store } from '../src/storage.js';
import { CONFIG, configOverrides, applyOverrides, resetConfig } from '../src/config.js';

test('controles por defecto de teclado según la tabla (hasta 3 teclas por acción)', () => {
  const k = DEFAULT_KEYS;
  assert.deepEqual(k.jump, ['Space', 'KeyZ', 'KeyJ']);
  assert.deepEqual(k.attack, ['KeyX', 'KeyK']);
  assert.deepEqual(k.dash, ['KeyC', 'KeyL', 'ShiftLeft']);
  assert.deepEqual(k.magic, ['KeyV', 'KeyI']);
  assert.deepEqual(k.special, ['KeyF', 'KeyU']);
  assert.deepEqual(k.prev, ['Digit1']); assert.deepEqual(k.next, ['Digit2']);
  assert.deepEqual(k.inventory, ['KeyE', 'KeyQ']);
  assert.deepEqual(k.pause, ['Escape', 'KeyP']);
  assert.deepEqual(k.respawn, ['KeyR']); assert.deepEqual(k.help, ['KeyH']); assert.deepEqual(k.lab, ['Tab']);
  assert.deepEqual(k.left, ['ArrowLeft', 'KeyA']);
  for (const a of ACTIONS) assert.ok(k[a].length <= 3);
});

test('mando por defecto: A salta, X ataca, B dash, Y/LB magia, RB especial, L2/R2 cambio, Select inventario, Start pausa', () => {
  const p = DEFAULT_PAD;
  assert.deepEqual(p.jump, [0]); assert.deepEqual(p.attack, [2]); assert.deepEqual(p.dash, [1]);
  assert.deepEqual(p.magic, [3, 4]); assert.deepEqual(p.special, [5]);
  assert.deepEqual(p.prev, [6]); assert.deepEqual(p.next, [7]);
  assert.deepEqual(p.inventory, [8]); assert.deepEqual(p.pause, [9]);
});

test('nombres correctos por familia de mando (Xbox, PlayStation, Switch)', () => {
  assert.equal(padFamily('Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)'), 'xbox');
  assert.equal(padFamily('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)'), 'ps');
  assert.equal(padFamily('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'), 'switch');
  assert.equal(padLabel('xbox', 0), 'A'); assert.equal(padLabel('ps', 0), '✕'); assert.equal(padLabel('switch', 0), 'B');
  assert.equal(padLabel('ps', 2), '□'); assert.equal(padLabel('ps', 3), '△'); assert.equal(padLabel('xbox', 3), 'Y');
  assert.equal(padLabel('ps', 6), 'L2'); assert.equal(padLabel('switch', 7), 'ZR'); assert.equal(padLabel('xbox', 8), 'View');
  assert.equal(padLabel('xbox', 'a0-'), 'Stick izq. ←');
  assert.equal(keyLabel('Space'), 'Espacio'); assert.equal(keyLabel('KeyZ'), 'Z'); assert.equal(keyLabel('ShiftLeft'), 'Mayús izq.');
});

test('reasignar tecla: si ya tenía acción, se mueve; máx. 3; borrar', () => {
  const c = new Controls();
  c.setKey('attack', 'KeyZ');                 // Z era de «saltar»
  assert.ok(!c.keys.jump.includes('KeyZ'));
  assert.ok(c.keys.attack.includes('KeyZ'));
  c.setKey('attack', 'KeyB'); c.setKey('attack', 'KeyN');
  assert.ok(c.keys.attack.length <= 3);
  c.clearKey('attack', 0);
  assert.ok(c.keys.attack.length <= 2);
  c.resetKeys();
  assert.deepEqual(c.keys.jump, DEFAULT_KEYS.jump);
});

test('perfil por defecto + perfil propio por mando', () => {
  const c = new Controls();
  c.setPad('PAD-A', 'jump', 1, true);
  assert.deepEqual(c.padProfile('PAD-A').jump, [1]);
  assert.deepEqual(c.padProfile('PAD-B').jump, [0], 'otro mando usa el perfil por defecto');
  c.setPad('', 'jump', 2, false);
  assert.deepEqual(c.pad.default.jump, [2]);
  c.resetPad('PAD-A');
  assert.deepEqual(c.padProfile('PAD-A').jump, [2]);
});

test('los carteles muestran la tecla o el botón del dispositivo activo', () => {
  const c = new Controls();
  assert.equal(c.fill('{jump} salta · {attack}'), 'Espacio salta · X');
  c.device = 'gamepad'; c.padId = 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c)';
  assert.equal(c.fill('{jump} / {attack} / {magic}'), '✕ / □ / △');
  c.device = 'touch';
  assert.equal(c.fill('{jump}'), 'SALTO');
});

test('persistencia de controles, amuletos, niveles, monedas, equipo y configuración del laboratorio', () => {
  Store.data.coins = 123; Store.data.completed = ['lab', 'forest']; Store.data.team = ['mage', 'clockmaker'];
  Store.give('fire'); Store.give('wind'); Store.toggleEquip('wind');
  controls.setKey('jump', 'KeyM');
  resetConfig();
  CONFIG.gravity = 3000; CONFIG.sword.reach = 80;
  Store.save();
  const raw = platform.storage.getItem('mvlab.save.v1');
  assert.ok(raw);
  // recarga desde cero
  CONFIG.gravity = 2400; CONFIG.sword.reach = 64;
  Store.data = { coins: 0 };
  Store.load();
  assert.equal(Store.data.coins, 123);
  assert.deepEqual(Store.data.completed, ['lab', 'forest']);
  assert.deepEqual(Store.data.team, ['mage', 'clockmaker']);
  assert.ok(Store.has('fire') && Store.has('wind') && !Store.equipped('wind'));
  assert.equal(CONFIG.gravity, 3000);
  assert.equal(CONFIG.sword.reach, 80);
  controls.keys.jump = ['Space'];
  controls.load();
  assert.ok(controls.keys.jump.includes('KeyM'));
  assert.deepEqual(configOverrides(), { gravity: 3000, 'sword.reach': 80 });
  resetConfig(); controls.resetKeys();
});

test('borrar progreso conserva controles, ajustes y niveles propios', () => {
  Store.data.customLevels.x = { name: 'x' };
  Store.data.coins = 50; Store.give('water');
  Store.resetProgress();
  assert.equal(Store.data.coins, 0);
  assert.equal(Store.has('water'), false);
  assert.ok(Store.data.customLevels.x);
});

function fakePads(list) {
  platform.getGamepads = () => list;
}
const mkPad = (id, index) => ({ id, index, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });

test('varios mandos simultáneos controlan al personaje; el stick y los gatillos funcionan', () => {
  const input = new Input();
  const a = mkPad('Xbox 360 Controller (Vendor: 045e)', 0), b = mkPad('Wireless Controller (Vendor: 054c)', 1);
  fakePads([a, b]);
  a.axes[0] = 1;                         // stick → en el mando 1
  b.buttons[0].pressed = true;           // ✕ salto en el mando 2
  b.buttons[7] = { pressed: false, value: 0.9 };     // R2 analógico
  input.pollPads();
  const s = input.beginStep();
  assert.equal(s.held.right, true);
  assert.equal(s.held.jump, true);
  assert.equal(s.held.next, true);
  assert.equal(s.pressed.jump, true);
  assert.equal(controls.device, 'gamepad');
  fakePads([]);
});

test('el teclado y el táctil comparten las mismas acciones', () => {
  const input = new Input();
  input.keys.add('KeyD'); input.keys.add('Space'); input.recompute();
  let s = input.beginStep();
  assert.ok(s.held.right && s.held.jump && s.pressed.jump);
  input.keys.clear(); input.recompute(); input.beginStep();
  input.setTouch('dash', true);
  s = input.beginStep();
  assert.ok(s.held.dash);
  assert.equal(controls.device, 'touch');
  input.setTouch('dash', false);
});

test('adaptador de plataforma: Web, Android (Capacitor) y Steam (Electron)', async () => {
  const saved = globalThis.window;
  const savedNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const setNav = (value) => Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });
  const mkEnv = (extra) => {
    globalThis.window = { addEventListener() {}, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, ...extra };
    globalThis.document = { addEventListener() {}, documentElement: { classList: { add() {} } } };
    setNav({ maxTouchPoints: 0, userAgent: 'x', getGamepads: () => [] });
    globalThis.location = { search: '' };
  };
  mkEnv({});
  let m = await import('../src/platform.js?web');
  assert.equal(new m.Platform().target, 'web');
  mkEnv({ Capacitor: { isNativePlatform: () => true, Plugins: {} } });
  m = await import('../src/platform.js?android');
  const pa = new m.Platform();
  assert.equal(pa.target, 'android'); assert.equal(pa.isNative, true);
  mkEnv({ electronAPI: { storage: { get: () => '1', set() {}, remove() {} }, setFullscreen() {} } });
  m = await import('../src/platform.js?steam');
  const ps = new m.Platform();
  assert.equal(ps.target, 'steam'); assert.equal(ps.storage.kind, 'file');
  globalThis.window = saved; delete globalThis.document; delete globalThis.location;
  if (savedNav) Object.defineProperty(globalThis, 'navigator', savedNav); else delete globalThis.navigator;
});
