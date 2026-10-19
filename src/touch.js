// Controles táctiles: joystick flotante (mitad izquierda) + botones (derecha), multitáctil.
// Se dibuja sobre el canvas en coordenadas lógicas (960×540) y alimenta a Input.
import { VIEW_W, VIEW_H } from './config.js';
import { Store } from './storage.js';
import { platform } from './platform.js';
import { controls } from './controls.js';

// Cada botón puede activar varias acciones (ESCUDO = ↓ + MAGIA, EXPLOSIÓN = ↑ + MAGIA).
const BUTTONS = [
  { id: 'jump', label: 'SALTO', x: 872, y: 438, r: 54, acts: ['jump'], color: '#7fd3ff' },
  { id: 'attack', label: 'ATAQUE', x: 758, y: 468, r: 48, acts: ['attack'], color: '#ff9d7a' },
  { id: 'dash', label: 'DASH', x: 764, y: 360, r: 42, acts: ['dash'], color: '#ffe27a' },
  { id: 'magic', label: 'MAGIA', x: 880, y: 322, r: 42, acts: ['magic'], color: '#c79bff' },
  { id: 'special', label: 'ESPECIAL', x: 660, y: 452, r: 40, acts: ['special'], color: '#8dffb0' },
  { id: 'shield', label: 'ESCUDO', x: 666, y: 360, r: 30, acts: ['down', 'magic'], color: '#9fb6ff' },
  { id: 'burst', label: 'EXPLOSIÓN', x: 776, y: 270, r: 30, acts: ['up', 'magic'], color: '#ff9fd0' },
  { id: 'swap', label: '⇄ CAMBIO', x: 590, y: 500, r: 26, acts: ['next'], color: '#ffffff', small: true },
  { id: 'inv', label: '🎒', x: 828, y: 36, r: 22, acts: ['inventory'], color: '#ffffff', small: true },
  { id: 'lab', label: '🧪', x: 776, y: 36, r: 22, acts: ['lab'], color: '#ffffff', small: true },
  { id: 'full', label: '⛶', x: 724, y: 36, r: 22, acts: [], color: '#ffffff', small: true, action: 'fullscreen' },
  { id: 'pause', label: '⏸', x: 924, y: 36, r: 22, acts: ['pause'], color: '#ffffff', small: true },
];

export class TouchControls {
  constructor(input, canvas, game) {
    this.input = input;
    this.canvas = canvas;
    this.game = game;
    this.pointers = new Map(); // id -> { kind, btn?, ox, oy, x, y }
    this.visible = false;
    this.stick = null;
    this.lastTouch = 0;
    this._onFull = null;
  }

  attach() {
    const c = this.canvas;
    const opts = { passive: false };
    c.addEventListener('pointerdown', (e) => this.down(e), opts);
    c.addEventListener('pointermove', (e) => this.move(e), opts);
    c.addEventListener('pointerup', (e) => this.up(e), opts);
    c.addEventListener('pointercancel', (e) => this.up(e), opts);
    c.addEventListener('lostpointercapture', (e) => this.up(e), opts);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  toLogical(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VIEW_W, y: ((e.clientY - r.top) / r.height) * VIEW_H };
  }
  get enabled() {
    const m = Store.data.settings.touch;
    if (m === 'never') return false;
    if (m === 'always') return true;
    return controls.device === 'touch' || (platform.coarse && controls.device !== 'gamepad' && controls.device !== 'keyboard') || (platform.hasTouch && platform.isNative && controls.device !== 'gamepad');
  }
  scale() { return Store.data.settings.touchSize || 1; }

  buttonAt(p) {
    const s = this.scale();
    // los botones escalan respecto a la esquina inferior-derecha
    for (const b of BUTTONS) {
      const bx = VIEW_W - (VIEW_W - b.x) * s, by = VIEW_H - (VIEW_H - b.y) * s;
      const br = b.small ? b.r : b.r * s;
      if (b.small) { if (Math.hypot(p.x - b.x, p.y - b.y) < br + 8) return b; }
      else if (Math.hypot(p.x - bx, p.y - by) < br + 6) return b;
    }
    return null;
  }
  pos(b) {
    const s = this.scale();
    if (b.small) return { x: b.x, y: b.y, r: b.r };
    return { x: VIEW_W - (VIEW_W - b.x) * s, y: VIEW_H - (VIEW_H - b.y) * s, r: b.r * s };
  }

  down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType !== 'mouse') {
      controls.device = 'touch';
      this.lastTouch = performance.now();
    }
    if (e.pointerType === 'mouse' && !this.enabled) return;
    if (!this.enabled && e.pointerType === 'mouse') return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    const p = this.toLogical(e);
    const btn = this.buttonAt(p);
    if (btn) {
      this.pointers.set(e.pointerId, { kind: 'btn', btn, x: p.x, y: p.y });
      this.pressButton(btn, true);
    } else if (p.x < VIEW_W * 0.55 && p.y > 90) {
      this.pointers.set(e.pointerId, { kind: 'stick', ox: p.x, oy: p.y, x: p.x, y: p.y });
      this.updateStick(this.pointers.get(e.pointerId));
    } else {
      this.pointers.set(e.pointerId, { kind: 'none', x: p.x, y: p.y });
    }
  }
  move(e) {
    const st = this.pointers.get(e.pointerId);
    if (!st) return;
    e.preventDefault();
    const p = this.toLogical(e);
    st.x = p.x; st.y = p.y;
    if (st.kind === 'stick') this.updateStick(st);
    else if (st.kind === 'btn') {
      const nb = this.buttonAt(p);
      if (nb !== st.btn) {
        this.pressButton(st.btn, false);
        st.btn = nb;
        if (nb) this.pressButton(nb, true);
        else st.kind = 'none';
      }
    }
  }
  up(e) {
    const st = this.pointers.get(e.pointerId);
    if (!st) return;
    this.pointers.delete(e.pointerId);
    if (st.kind === 'stick') this.releaseStick();
    else if (st.kind === 'btn' && st.btn) this.pressButton(st.btn, false);
  }

  pressButton(b, v) {
    if (b.action === 'fullscreen') {
      if (v) platform.toggleFullscreen(document.getElementById('stage'));
      return;
    }
    if (b.id === 'swap' && v) {
      // el botón de cambio alterna siguiente (pulsación corta) y anterior (si ya se cambió hace poco)
      this.input.setTouch('next', true);
      setTimeout(() => this.input.setTouch('next', false), 60);
      return;
    }
    b.pressed = v;
    for (const a of b.acts) this.refreshAction(a);
  }
  refreshAction(a) {
    const on = BUTTONS.some((b) => b.pressed && b.acts.includes(a)) || (this.stickDirs && this.stickDirs[a]);
    this.input.setTouch(a, !!on);
  }

  updateStick(st) {
    const dx = st.x - st.ox, dy = st.y - st.oy;
    const dead = 14, d = Math.hypot(dx, dy);
    // el origen sigue al dedo si se aleja demasiado (joystick flotante)
    const maxR = 60;
    if (d > maxR) { st.ox += (dx / d) * (d - maxR); st.oy += (dy / d) * (d - maxR); }
    const dirs = { left: false, right: false, up: false, down: false };
    if (d > dead) {
      const a = Math.atan2(dy, dx);
      const cx = Math.cos(a), cy = Math.sin(a);
      dirs.right = cx > 0.38; dirs.left = cx < -0.38;
      dirs.down = cy > 0.5; dirs.up = cy < -0.5;
    }
    this.stickDirs = dirs;
    this.stick = st;
    for (const k of ['left', 'right', 'up', 'down']) this.refreshAction(k);
  }
  releaseStick() {
    this.stickDirs = null; this.stick = null;
    for (const k of ['left', 'right', 'up', 'down']) this.refreshAction(k);
  }
  releaseAll() {
    this.pointers.clear();
    for (const b of BUTTONS) b.pressed = false;
    this.releaseStick();
    for (const b of BUTTONS) for (const a of b.acts) this.refreshAction(a);
  }

  draw(ctx, active) {
    if (!this.enabled) return;
    const op = Store.data.settings.touchOpacity ?? 0.55;
    ctx.save();
    ctx.globalAlpha = op;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of BUTTONS) {
      if (!active && !['pause', 'full'].includes(b.id)) continue;
      const { x, y, r } = this.pos(b);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = b.pressed ? b.color : 'rgba(15,18,30,0.75)';
      ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = b.color; ctx.stroke();
      ctx.fillStyle = b.pressed ? '#0a0d18' : b.color;
      ctx.font = `bold ${b.small ? 15 : Math.max(10, Math.round(r / 4.2))}px system-ui, sans-serif`;
      ctx.fillText(b.label, x, y);
    }
    if (active) {
      const st = this.stick;
      if (st) {
        ctx.globalAlpha = op + 0.1;
        ctx.beginPath(); ctx.arc(st.ox, st.oy, 62, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
        const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.min(62, Math.hypot(dx, dy));
        const a = Math.atan2(dy, dx);
        ctx.beginPath(); ctx.arc(st.ox + Math.cos(a) * d, st.oy + Math.sin(a) * d, 28, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
      } else {
        ctx.globalAlpha = op * 0.7;
        ctx.beginPath(); ctx.arc(120, 440, 62, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.fillText('JOYSTICK', 120, 440);
      }
    }
    ctx.restore();
  }
}
