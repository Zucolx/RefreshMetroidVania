// Asignaciones de controles (teclado + mandos) y textos/iconos por dispositivo.
import { deepClone } from './util.js';
import { Store } from './storage.js';

export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'magic', 'special', 'prev', 'next', 'inventory', 'pause', 'respawn', 'help', 'lab'];

export const ACTION_LABELS = {
  left: 'Mover izquierda', right: 'Mover derecha', up: 'Arriba', down: 'Abajo',
  jump: 'Saltar', attack: 'Atacar', dash: 'Dash', magic: 'Magia', special: 'Especial',
  prev: 'Personaje anterior', next: 'Personaje siguiente', inventory: 'Inventario',
  pause: 'Pausa', respawn: 'Reaparecer', help: 'Ayuda', lab: 'Laboratorio',
};

export const DEFAULT_KEYS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyZ', 'KeyJ'], attack: ['KeyX', 'KeyK'], dash: ['KeyC', 'KeyL', 'ShiftLeft'],
  magic: ['KeyV', 'KeyI'], special: ['KeyF', 'KeyU'], prev: ['Digit1'], next: ['Digit2'],
  inventory: ['KeyE', 'KeyQ'], pause: ['Escape', 'KeyP'], respawn: ['KeyR'], help: ['KeyH'], lab: ['Tab'],
};

// Mapeo estándar de la Gamepad API: 0 abajo · 1 derecha · 2 izquierda · 3 arriba · 4 LB · 5 RB · 6 LT · 7 RT ·
// 8 Select · 9 Start · 10 L3 · 11 R3 · 12-15 cruceta. Ejes: 'a0-' = stick izq. a la izquierda, etc.
export const DEFAULT_PAD = {
  left: [14, 'a0-'], right: [15, 'a0+'], up: [12, 'a1-'], down: [13, 'a1+'],
  jump: [0], attack: [2], dash: [1], magic: [3, 4], special: [5], prev: [6], next: [7],
  inventory: [8], pause: [9], respawn: [], help: [], lab: [11],
};

export function padFamily(id = '') {
  if (/054c|playstation|dualshock|dualsense|sony|ps[345]/i.test(id)) return 'ps';
  if (/057e|nintendo|switch|joy-?con|pro controller/i.test(id)) return 'switch';
  return 'xbox';
}
const PAD_NAMES = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menú', 'LS', 'RS', '↑', '↓', '←', '→'],
  ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', '↑', '↓', '←', '→'],
  switch: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', '↑', '↓', '←', '→'],
};
export const FAMILY_NAMES = { xbox: 'Xbox', ps: 'PlayStation', switch: 'Nintendo Switch' };

export function padLabel(family, b) {
  if (typeof b === 'number') return PAD_NAMES[family][b] || `Botón ${b}`;
  const m = /^a(\d)([+-])$/.exec(b);
  if (m) {
    const stick = m[1] < 2 ? 'Stick izq.' : 'Stick der.';
    const dir = m[1] % 2 === 0 ? (m[2] === '-' ? '←' : '→') : (m[2] === '-' ? '↑' : '↓');
    return `${stick} ${dir}`;
  }
  return String(b);
}

const KEY_NAMES = {
  Space: 'Espacio', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'Mayús izq.',
  ShiftRight: 'Mayús der.', ControlLeft: 'Ctrl izq.', ControlRight: 'Ctrl der.', AltLeft: 'Alt izq.', AltRight: 'Alt der.',
  Escape: 'Esc', Enter: 'Intro', Tab: 'Tab', Backspace: 'Retroceso', Delete: 'Supr', Comma: ',', Period: '.',
  Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
  Backslash: '\\', CapsLock: 'Bloq Mayús',
};
export function keyLabel(code) {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return `Num ${code.slice(6)}`;
  return code;
}

export const TOUCH_LABELS = {
  jump: 'SALTO', attack: 'ATAQUE', dash: 'DASH', magic: 'MAGIA', special: 'ESPECIAL', prev: '⇄', next: '⇄',
  inventory: '🎒', pause: '⏸', lab: '🧪', help: '?', left: '◀', right: '▶', up: '▲', down: '▼', respawn: '↺',
};

export class Controls {
  constructor() {
    this.keys = deepClone(DEFAULT_KEYS);
    this.pad = { default: deepClone(DEFAULT_PAD), byId: {} };
    this.device = 'keyboard'; // último dispositivo usado: keyboard | gamepad | touch
    this.padId = ''; // id del último mando usado
  }
  load() {
    const c = Store.data.controls;
    if (c) {
      if (c.keys) for (const a of ACTIONS) if (Array.isArray(c.keys[a])) this.keys[a] = c.keys[a].slice(0, 3);
      if (c.pad) {
        if (c.pad.default) for (const a of ACTIONS) if (Array.isArray(c.pad.default[a])) this.pad.default[a] = c.pad.default[a];
        this.pad.byId = c.pad.byId || {};
      }
    }
  }
  save() {
    Store.data.controls = { keys: this.keys, pad: this.pad };
    Store.save();
  }
  padProfile(id) {
    return this.pad.byId[id] || this.pad.default;
  }
  /** Asigna una tecla (máx. 3 por acción). Si otra acción la tenía, se mueve. */
  setKey(action, code, slot = -1) {
    for (const a of ACTIONS) this.keys[a] = this.keys[a].filter((k) => k !== code);
    const list = this.keys[action];
    if (slot >= 0 && slot < list.length) list[slot] = code;
    else if (list.length < 3) list.push(code);
    else list[2] = code;
    this.save();
  }
  clearKey(action, slot) {
    this.keys[action].splice(slot, 1);
    this.save();
  }
  /** Asigna botón/eje de mando al perfil de ese mando (se crea el perfil propio si no existe). */
  setPad(id, action, binding, perPad = true) {
    let prof;
    if (perPad && id) {
      if (!this.pad.byId[id]) this.pad.byId[id] = deepClone(this.pad.default);
      prof = this.pad.byId[id];
    } else prof = this.pad.default;
    for (const a of ACTIONS) if (a !== action) prof[a] = (prof[a] || []).filter((b) => b !== binding);
    prof[action] = [binding];
    this.save();
  }
  resetKeys() { this.keys = deepClone(DEFAULT_KEYS); this.save(); }
  resetPad(id) {
    if (id && this.pad.byId[id]) delete this.pad.byId[id];
    else this.pad.default = deepClone(DEFAULT_PAD);
    this.save();
  }
  /** Texto de la tecla/botón activo para una acción según el dispositivo en uso (carteles y ayuda). */
  glyph(action) {
    if (this.device === 'touch') return TOUCH_LABELS[action] || action;
    if (this.device === 'gamepad') {
      const fam = padFamily(this.padId);
      const prof = this.padProfile(this.padId);
      const b = (prof[action] || []).find((x) => typeof x === 'number' && x < 12) ?? (prof[action] || [])[0];
      if (b !== undefined) return padLabel(fam, b);
    }
    const k = this.keys[action][0];
    return k ? keyLabel(k) : '—';
  }
  /** Sustituye {jump}, {attack}… en un texto. */
  fill(text) {
    return text.replace(/\{(\w+)\}/g, (m, a) => (ACTIONS.includes(a) ? this.glyph(a) : m));
  }
}

export const controls = new Controls();
