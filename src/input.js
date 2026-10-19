// Entrada unificada: teclado + varios mandos simultáneos + táctil → estados de acción.
// El juego consume los bordes (pulsado/soltado) una vez por paso fijo con beginStep().
import { ACTIONS, controls } from './controls.js';
import { platform } from './platform.js';
import { Store } from './storage.js';

const AXIS_THRESHOLD = 0.4;
const PREVENT = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab']);

export class Input {
  constructor() {
    this.keys = new Set();
    this.down = Object.fromEntries(ACTIONS.map((a) => [a, false]));
    this.prev = { ...this.down };
    this.pressedAcc = {};
    this.releasedAcc = {};
    this.pressed = {};
    this.released = {};
    this.held = { ...this.down };
    this.touchHeld = {};
    this.padHeld = {};
    this.capture = null; // callback de reasignación
    this.padSeen = new Map(); // id -> índice
    this.axisX = 0;
    this.axisY = 0;
    this.rawPads = [];
    this.ui = { up: false, down: false, left: false, right: false, ok: false, back: false }; // navegación de menús con mando
    this._uiPrev = { ...this.ui };
    this.uiPressed = {};
  }

  attach(target = window) {
    target.addEventListener('keydown', (e) => this.onKey(e, true));
    target.addEventListener('keyup', (e) => this.onKey(e, false));
    target.addEventListener('blur', () => { this.keys.clear(); this.recompute(); });
    target.addEventListener('gamepadconnected', (e) => this.padSeen.set(e.gamepad.id, e.gamepad.index));
  }

  onKey(e, isDown) {
    const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox';
    if (isDown && this.capture) {
      e.preventDefault();
      const cb = this.capture;
      this.capture = null;
      cb({ type: 'key', code: e.code });
      return;
    }
    if (typing) return;
    if (isDown && PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (isDown) { this.keys.add(e.code); controls.device = 'keyboard'; } else this.keys.delete(e.code);
    this.recompute();
  }

  setTouch(action, v) {
    if (!!this.touchHeld[action] === v) return;
    this.touchHeld[action] = v;
    if (v) controls.device = 'touch';
    this.recompute();
  }

  /** Lee todos los mandos conectados (se llama una vez por frame de render). */
  pollPads() {
    const pads = platform.getGamepads();
    this.rawPads = pads;
    const held = {};
    let ax = 0, ay = 0;
    for (const pad of pads) {
      const prof = controls.padProfile(pad.id);
      const bState = (b) => {
        if (typeof b === 'number') {
          const btn = pad.buttons[b];
          return !!btn && (btn.pressed || btn.value > 0.5);
        }
        const m = /^a(\d)([+-])$/.exec(b);
        if (!m) return false;
        const v = pad.axes[+m[1]] || 0;
        return m[2] === '+' ? v > AXIS_THRESHOLD : v < -AXIS_THRESHOLD;
      };
      for (const a of ACTIONS) {
        const list = prof[a] || [];
        for (const b of list) if (bState(b)) { held[a] = true; break; }
      }
      // los D-pad/stick de menú nunca se pierden aunque se reasignen
      if (pad.buttons[12] && pad.buttons[12].pressed) held.up = true;
      if (pad.buttons[13] && pad.buttons[13].pressed) held.down = true;
      if (pad.buttons[14] && pad.buttons[14].pressed) held.left = true;
      if (pad.buttons[15] && pad.buttons[15].pressed) held.right = true;
      const sx = pad.axes[0] || 0, sy = pad.axes[1] || 0;
      if (Math.abs(sx) > Math.abs(ax) && Math.abs(sx) > 0.2) ax = sx;
      if (Math.abs(sy) > Math.abs(ay) && Math.abs(sy) > 0.2) ay = sy;
      // captura de reasignación por mando
      if (this.capture) {
        for (let i = 0; i < pad.buttons.length; i++) {
          const b = pad.buttons[i];
          if (b.pressed || b.value > 0.7) {
            const cb = this.capture; this.capture = null;
            cb({ type: 'pad', id: pad.id, binding: i });
            return;
          }
        }
        for (let i = 0; i < Math.min(4, pad.axes.length); i++) {
          if (Math.abs(pad.axes[i]) > 0.8) {
            const cb = this.capture; this.capture = null;
            cb({ type: 'pad', id: pad.id, binding: `a${i}${pad.axes[i] > 0 ? '+' : '-'}` });
            return;
          }
        }
      }
      if (Object.keys(held).length && !this.capture) { controls.device = 'gamepad'; controls.padId = pad.id; }
    }
    this.axisX = ax; this.axisY = ay;
    this.padHeld = held;
    // navegación UI
    const u = {
      up: !!held.up, down: !!held.down, left: !!held.left, right: !!held.right,
      ok: pads.some((p) => p.buttons[0] && p.buttons[0].pressed),
      back: pads.some((p) => p.buttons[1] && p.buttons[1].pressed),
    };
    for (const k of Object.keys(u)) this.uiPressed[k] = u[k] && !this._uiPrev[k];
    this._uiPrev = u;
    this.ui = u;
    this.recompute();
  }

  recompute() {
    for (const a of ACTIONS) {
      let d = !!this.touchHeld[a] || !!this.padHeld[a];
      if (!d) for (const k of controls.keys[a]) if (this.keys.has(k)) { d = true; break; }
      if (d !== this.down[a]) {
        this.down[a] = d;
        if (d) this.pressedAcc[a] = true; else this.releasedAcc[a] = true;
      }
    }
  }

  /** Congela el estado de acciones para un paso fijo de simulación. */
  beginStep() {
    this.pressed = this.pressedAcc; this.pressedAcc = {};
    this.released = this.releasedAcc; this.releasedAcc = {};
    this.held = { ...this.down };
    // un toque más corto que un frame mantiene 'held' en ese paso
    for (const a of Object.keys(this.pressed)) this.held[a] = this.held[a] || true;
    return this;
  }
  /** Consume un evento de pulsación a nivel de aplicación (pausa, inventario…). */
  consume(action) {
    if (this.pressedAcc[action]) { delete this.pressedAcc[action]; return true; }
    return false;
  }
  flushEdges() { this.pressedAcc = {}; this.releasedAcc = {}; }
  /** Estado analógico del eje horizontal/vertical en [-1,1] (digital si no hay stick). */
  get moveX() { return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0); }
  get moveY() { return (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0); }
  clear() {
    this.keys.clear(); this.touchHeld = {}; this.padHeld = {};
    this.pressedAcc = {}; this.releasedAcc = {};
    this.recompute();
    this.pressedAcc = {}; this.releasedAcc = {};
  }
  rumble(ms = 80, s = 0.6, w = 0.4) {
    if (Store.data.settings.vibration === false) return;
    if (controls.device === 'gamepad') {
      for (const p of this.rawPads) platform.vibrate(p, ms, s, w);
    } else if (controls.device === 'touch') platform.vibrate(null, ms);
  }
}

/** Entrada falsa para pruebas sin DOM: se maneja a mano con hold()/tap(). */
export class FakeInput {
  constructor() {
    this.state = Object.fromEntries(ACTIONS.map((a) => [a, false]));
    this.held = { ...this.state };
    this.pressed = {};
    this.released = {};
    this._press = {};
    this._rel = {};
    this.axisX = 0; this.axisY = 0;
  }
  hold(a, v = true) {
    if (v && !this.state[a]) this._press[a] = true;
    if (!v && this.state[a]) this._rel[a] = true;
    this.state[a] = v;
  }
  tap(a) { this._press[a] = true; this._rel[a] = true; }
  beginStep() {
    this.pressed = this._press; this.released = this._rel;
    this._press = {}; this._rel = {};
    this.held = { ...this.state };
    for (const a of Object.keys(this.pressed)) this.held[a] = true;
    return this;
  }
  get moveX() { return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0); }
  get moveY() { return (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0); }
  clear() { for (const a of ACTIONS) this.state[a] = false; this._press = {}; this._rel = {}; }
  rumble() {}
}
