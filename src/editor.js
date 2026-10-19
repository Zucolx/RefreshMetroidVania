// Editor de niveles (#editor o desde el menú). Pantalla completa DOM + canvas.
//  · Terreno: sólido, plataforma, pinchos, lava, borrar · pincel 1×1–3×3 o rectángulo
//  · Objetos: inicio, puntos de guardado, salida, amuletos, carteles ({jump}/{attack}/{magic})
//  · Enemigos de todos los biomas, decorado y elementos del teatro
//  · Tema, nombre y tamaño (redimensiona anclando el suelo) · deshacer/rehacer · probar · guardar · exportar/importar
import { h, toast, download, pickFile } from './ui/dom.js';
import { World, T, TILE_NAMES } from './world.js';
import { TILE } from './config.js';
import { THEMES, THEME_IDS, themeOf } from './themes.js';
import { DECOR, DECOR_IDS } from './decor.js';
import { ENEMY_META } from './enemies/index.js';
import { PROP_META, PROP_TYPES } from './props/theater.js';
import { AMULETS, AMULET_IDS } from './items.js';
import { LEVELS, buildLevel } from './levels/index.js';
import { Store } from './storage.js';
import { validateWorld } from './validate.js';
import { clamp, hash2 } from './util.js';
import { controls } from './controls.js';

const COLORS = { solid: '#6a7088', plat: '#c9a34a', spike: '#dde3ee', lava: '#ff6a2a' };

export class Editor {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('editor');
    this.world = null;
    this.visible = false;
    this.zoom = 22;
    this.ox = 0; this.oy = 0;
    this.tool = { kind: 'tile', v: T.SOLID };
    this.brush = 1; // 1,2,3 o 'rect'
    this.grid = true;
    this.undo = []; this.redo = [];
    this.pointers = new Map();
    this.dirty = true;
    this.spaceDown = false;
    this.cursor = null;
    this.raf = 0;
    this.keys = new Set();
    this.built = false;
    this.onKey = (e) => this.keydown(e);
    this.onKeyUp = (e) => { this.keys.delete(e.code); if (e.code === 'Space') this.spaceDown = false; };
  }

  // ---------------------------------------------------------------- ciclo de vida
  show(world) {
    if (world) this.setWorld(world);
    else if (!this.world) {
      const draft = Store.data.editorDraft;
      if (draft) { try { this.setWorld(World.fromJSON(draft)); } catch (e) { this.setWorld(buildLevel('lab')); } }
      else this.setWorld(buildLevel('lab')); // primera vez: el Laboratorio como ejemplo
    }
    if (!this.built) this.build();
    this.el.classList.remove('hidden');
    this.visible = true;
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    this.syncFields();
    this.onResize();
    cancelAnimationFrame(this.raf);
    const loop = () => { if (!this.visible) return; this.raf = requestAnimationFrame(loop); this.step(); };
    loop();
  }
  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    cancelAnimationFrame(this.raf);
    this.saveDraft();
  }
  setWorld(w) {
    this.world = w;
    this.undo = []; this.redo = [];
    this.fit();
    this.dirty = true;
    if (this.built) this.syncFields();
  }
  fit() {
    const w = this.world;
    const cw = this.canvas ? this.canvas.clientWidth || 900 : 900, ch = this.canvas ? this.canvas.clientHeight || 500 : 500;
    this.zoom = clamp(Math.floor(Math.min(cw / w.w, ch / w.h)), 8, 32);
    this.ox = 0;
    this.oy = Math.max(0, w.h * TILE - (ch * TILE) / this.zoom);
  }
  saveDraft() {
    try { Store.data.editorDraft = this.world.toJSON(); Store.save(); } catch (e) { /* cuota */ }
  }

  // ---------------------------------------------------------------- UI
  build() {
    this.built = true;
    const el = this.el;
    el.innerHTML = '';
    // ---- barra superior ----
    this.nameIn = h('input', { type: 'text', placeholder: 'Nombre', style: { width: '140px' }, onInput: () => { this.world.name = this.nameIn.value; } });
    this.themeSel = h('select', { onChange: () => { this.world.theme = this.themeSel.value; this.dirty = true; } },
      THEME_IDS.map((t) => h('option', { value: t }, THEMES[t].name)));
    this.wIn = h('input', { type: 'number', min: 30, max: 400, style: { width: '62px' } });
    this.hIn = h('input', { type: 'number', min: 20, max: 120, style: { width: '58px' } });
    this.brushSel = h('select', { onChange: () => { this.brush = this.brushSel.value === 'rect' ? 'rect' : Number(this.brushSel.value); } },
      h('option', { value: 1 }, 'Pincel 1×1'), h('option', { value: 2 }, 'Pincel 2×2'), h('option', { value: 3 }, 'Pincel 3×3'), h('option', { value: 'rect' }, 'Rectángulo'));
    const levelSel = h('select', { onChange: () => { if (levelSel.value) { this.pushUndo(); this.setWorld(World.fromJSON(buildLevel(levelSel.value).toJSON())); toast('Copia del nivel abierta'); levelSel.value = ''; } } },
      h('option', { value: '' }, 'Abrir copia de…'), LEVELS.map((l) => h('option', { value: l.id }, l.name)));
    const top = h('div', { class: 'topbar' },
      h('button', { onClick: () => this.exit() }, '← Menú'),
      this.nameIn, this.themeSel,
      h('span', { class: 'status' }, 'Tamaño'), this.wIn, '×', this.hIn,
      h('button', { class: 'small', onClick: () => this.applySize() }, 'Aplicar'),
      this.brushSel,
      h('button', { class: 'small', onClick: () => { this.zoomBy(1.25); } }, '＋'),
      h('button', { class: 'small', onClick: () => { this.zoomBy(0.8); } }, '－'),
      h('button', { class: 'small', onClick: () => { this.grid = !this.grid; this.dirty = true; } }, '▦ Rejilla'),
      h('button', { class: 'small', onClick: () => this.doUndo() }, '↶'),
      h('button', { class: 'small', onClick: () => this.doRedo() }, '↷'),
      h('button', { class: 'primary', onClick: () => this.play() }, '▶ Probar'),
      h('button', { onClick: () => this.save() }, '💾 Guardar'),
      h('button', { class: 'small', onClick: () => this.validate() }, '✔ Validar'),
      h('button', { class: 'small', onClick: () => this.exportJSON() }, 'Exportar'),
      h('button', { class: 'small', onClick: () => this.importJSON() }, 'Importar'),
      levelSel,
      h('button', { class: 'small danger', onClick: () => this.newLevel() }, 'Nuevo'));
    // ---- paleta ----
    this.palette = h('div', { class: 'side' });
    this.buildPalette();
    this.canvas = h('canvas');
    this.status = h('div', { class: 'status' }, 'Clic: pintar · clic derecho: borrar · rueda: zoom · Espacio+arrastrar / WASD: desplazar · Ctrl+Z/Y · Ctrl+S · Intro: probar');
    el.append(top, h('div', { class: 'main' }, this.palette, this.canvas), this.status);
    this.ctx = this.canvas.getContext('2d');
    this.bindCanvas();
  }

  toolBtn(label, tool, color, title) {
    const b = h('button', { title: title || '', style: color ? { borderLeft: `5px solid ${color}` } : null, onClick: () => { this.tool = tool; this.refreshTools(); } }, label);
    b._tool = tool;
    (this.toolBtns ||= []).push(b);
    return b;
  }
  refreshTools() {
    for (const b of this.toolBtns || []) {
      const t = b._tool;
      const on = t.kind === this.tool.kind && (t.v === this.tool.v);
      b.classList.toggle('on', on);
    }
    if (this.status) this.status.textContent = `Herramienta: ${this.toolName()}`;
  }
  toolName() {
    const t = this.tool;
    if (t.kind === 'tile') return t.v === T.AIR ? 'Borrar terreno' : TILE_NAMES[t.v];
    return { start: 'Inicio del jugador', cp: 'Punto de guardado', exit: 'Salida', sign: 'Cartel', erase: 'Goma (todo)' }[t.kind] || `${t.kind}: ${t.v}`;
  }
  buildPalette() {
    const p = this.palette;
    p.innerHTML = '';
    this.toolBtns = [];
    const grid = (...b) => h('div', { class: 'pal' }, ...b);
    p.append(h('h4', null, 'Terreno'), grid(
      this.toolBtn('Sólido', { kind: 'tile', v: T.SOLID }, COLORS.solid),
      this.toolBtn('Plataforma', { kind: 'tile', v: T.PLAT }, COLORS.plat),
      this.toolBtn('Pinchos', { kind: 'tile', v: T.SPIKE }, COLORS.spike),
      this.toolBtn('Lava', { kind: 'tile', v: T.LAVA }, COLORS.lava),
      this.toolBtn('Borrar', { kind: 'tile', v: T.AIR }, '#222'),
      this.toolBtn('Goma total', { kind: 'erase', v: 0 }, '#a33', 'Borra también objetos y enemigos')));
    p.append(h('h4', null, 'Objetos'), grid(
      this.toolBtn('Inicio', { kind: 'start', v: 0 }, '#6fff9f'),
      this.toolBtn('Guardado', { kind: 'cp', v: 0 }, '#ffe27a'),
      this.toolBtn('Salida', { kind: 'exit', v: 0 }, '#c79bff'),
      this.toolBtn('Cartel', { kind: 'sign', v: 0 }, '#c9a070', 'Texto con {jump} {attack} {magic}'),
      ...AMULET_IDS.map((a) => this.toolBtn(AMULETS[a].icon + ' ' + AMULETS[a].short, { kind: 'amulet', v: a }, AMULETS[a].color))));
    const biomes = new Map();
    for (const [id, m] of Object.entries(ENEMY_META)) { if (!biomes.has(m.biome)) biomes.set(m.biome, []); biomes.get(m.biome).push([id, m]); }
    for (const [b, list] of biomes) p.append(h('h4', null, 'Enemigos · ' + b), grid(...list.map(([id, m]) => this.toolBtn(m.label, { kind: 'enemy', v: id }, m.color))));
    p.append(h('h4', null, 'Decorado'), grid(...DECOR_IDS.map((id) => this.toolBtn(DECOR[id].name, { kind: 'decor', v: id }, '#7a9a6a'))));
    p.append(h('h4', null, 'Teatro (dinámicos)'), grid(...PROP_TYPES.map((id) => this.toolBtn(PROP_META[id].label, { kind: 'prop', v: id }, '#b0343c'))));
    this.refreshTools();
  }

  syncFields() {
    if (!this.nameIn) return;
    this.nameIn.value = this.world.name || '';
    this.themeSel.value = this.world.theme;
    this.wIn.value = this.world.w; this.hIn.value = this.world.h;
  }

  // ---------------------------------------------------------------- canvas
  onResize() {
    if (!this.canvas || !this.visible) return;
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(100, Math.floor(r.width * dpr));
    this.canvas.height = Math.max(100, Math.floor(r.height * dpr));
    this.dpr = dpr;
    this.dirty = true;
  }
  /** Coordenadas de tile bajo un evento. */
  tileAt(ev) {
    const r = this.canvas.getBoundingClientRect();
    const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
    return { x: Math.floor(sx / this.zoom + this.ox / TILE), y: Math.floor(sy / this.zoom + this.oy / TILE), sx, sy };
  }
  zoomBy(k, sx, sy) {
    const r = this.canvas.getBoundingClientRect();
    sx = sx ?? r.width / 2; sy = sy ?? r.height / 2;
    const wx = sx / this.zoom + this.ox / TILE, wy = sy / this.zoom + this.oy / TILE;
    this.zoom = clamp(this.zoom * k, 5, 60);
    this.ox = (wx - sx / this.zoom) * TILE; this.oy = (wy - sy / this.zoom) * TILE;
    this.clampView(); this.dirty = true;
  }
  clampView() {
    const r = this.canvas.getBoundingClientRect();
    const w = this.world;
    this.ox = clamp(this.ox, -100, Math.max(0, w.w * TILE - r.width * TILE / this.zoom + 100));
    this.oy = clamp(this.oy, -100, Math.max(0, w.h * TILE - r.height * TILE / this.zoom + 100));
  }
  bindCanvas() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => { e.preventDefault(); const r = c.getBoundingClientRect(); this.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    c.addEventListener('pointerdown', (e) => this.pdown(e));
    c.addEventListener('pointermove', (e) => this.pmove(e));
    c.addEventListener('pointerup', (e) => this.pup(e));
    c.addEventListener('pointercancel', (e) => this.pup(e));
  }
  pdown(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) { this.stroke = null; this.pinch = this.pinchState(); return; }
    const t = this.tileAt(e);
    if (e.button === 1 || this.spaceDown) { this.pan = { x: e.clientX, y: e.clientY, ox: this.ox, oy: this.oy }; return; }
    const erase = e.button === 2;
    this.pushUndo();
    this.stroke = { erase, start: t, last: t, rect: this.brush === 'rect' && this.isTile() && !erase };
    if (!this.stroke.rect) this.paintAt(t, erase);
    this.dirty = true;
  }
  pmove(e) {
    const t = this.tileAt(e);
    this.cursor = t;
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2 && this.pinch) {
      const s = this.pinchState();
      this.zoomBy(s.d / this.pinch.d, s.cx, s.cy);
      this.ox -= (s.cx - this.pinch.cx) / this.zoom * TILE; this.oy -= (s.cy - this.pinch.cy) / this.zoom * TILE;
      this.pinch = s; this.clampView(); this.dirty = true;
      return;
    }
    if (this.pan) {
      this.ox = this.pan.ox - (e.clientX - this.pan.x) / this.zoom * TILE;
      this.oy = this.pan.oy - (e.clientY - this.pan.y) / this.zoom * TILE;
      this.clampView(); this.dirty = true; return;
    }
    if (this.stroke && !this.stroke.rect) {
      // interpola entre puntos para no dejar huecos
      const a = this.stroke.last;
      const n = Math.max(Math.abs(t.x - a.x), Math.abs(t.y - a.y));
      for (let i = 1; i <= n; i++) this.paintAt({ x: Math.round(a.x + (t.x - a.x) * i / n), y: Math.round(a.y + (t.y - a.y) * i / n) }, this.stroke.erase);
      this.stroke.last = t;
    }
    this.dirty = true;
    this.updateStatus(t);
  }
  pup(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pan) { this.pan = null; return; }
    if (this.stroke && this.stroke.rect) {
      const a = this.stroke.start, b = this.tileAt(e);
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.world.set(x, y, this.tool.v);
    }
    this.stroke = null;
    this.dirty = true;
    this.saveDraftSoon();
  }
  pinchState() {
    const p = [...this.pointers.values()];
    const r = this.canvas.getBoundingClientRect();
    return { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, cx: (p[0].x + p[1].x) / 2 - r.left, cy: (p[0].y + p[1].y) / 2 - r.top };
  }
  saveDraftSoon() { clearTimeout(this._sd); this._sd = setTimeout(() => this.saveDraft(), 600); }
  isTile() { return this.tool.kind === 'tile'; }
  updateStatus(t) {
    if (!t || !this.world.inBounds(t.x, t.y)) return;
    const tile = this.world.get(t.x, t.y);
    this.status.textContent = `(${t.x}, ${t.y}) · ${TILE_NAMES[tile]} · ${this.toolName()} · zoom ${this.zoom.toFixed(0)} · ${this.world.w}×${this.world.h}`;
  }

  // ---------------------------------------------------------------- edición
  snapshot() { return JSON.stringify(this.world.toJSON()); }
  pushUndo() {
    this.undo.push(this.snapshot());
    if (this.undo.length > 60) this.undo.shift();
    this.redo.length = 0;
  }
  doUndo() {
    if (!this.undo.length) return;
    this.redo.push(this.snapshot());
    this.world = World.fromJSON(JSON.parse(this.undo.pop()));
    this.syncFields(); this.dirty = true;
  }
  doRedo() {
    if (!this.redo.length) return;
    this.undo.push(this.snapshot());
    this.world = World.fromJSON(JSON.parse(this.redo.pop()));
    this.syncFields(); this.dirty = true;
  }

  paintAt(t, erase) {
    const w = this.world, tool = this.tool;
    if (erase) {
      if (this.isTile()) this.setBrush(t, T.AIR);
      this.removeEntitiesAt(t);
      return;
    }
    switch (tool.kind) {
      case 'tile': this.setBrush(t, tool.v); break;
      case 'erase': this.setBrush(t, T.AIR); this.removeEntitiesAt(t); break;
      case 'start': { const p = this.snapDown(t); w.start = { x: p.x, y: p.y }; break; }
      case 'cp': { const p = this.snapDown(t); w.checkpoints = w.checkpoints.filter((c) => !(c.x === p.x && c.y === p.y)); w.checkpoints.push(p); break; }
      case 'exit': { const p = this.snapDown(t); w.exit = p; break; }
      case 'amulet': { const p = this.snapDown(t); w.amulets = w.amulets.filter((a) => a.type !== tool.v); w.amulets.push({ type: tool.v, ...p }); break; }
      case 'sign': {
        const p = this.snapDown(t);
        const text = window.prompt('Texto del cartel (usa {jump}, {attack}, {magic}, {dash}… y \\n para saltos de línea):', '{jump} salta · {attack} ataca · {magic} magia');
        if (text !== null) { w.signs = w.signs.filter((s) => !(s.x === p.x && s.y === p.y)); w.signs.push({ ...p, text: text.replace(/\\n/g, '\n') }); }
        this.stroke = null; this.pointers.clear();
        break;
      }
      case 'enemy': {
        const meta = ENEMY_META[tool.v] || {};
        const p = meta.ceil ? this.snapUp(t) : meta.fly ? { x: t.x, y: t.y } : this.snapDown(t);
        if (!w.enemies.some((e) => e.x === p.x && e.y === p.y)) w.enemies.push({ type: tool.v, x: p.x, y: p.y });
        break;
      }
      case 'decor': { const p = this.snapDown(t); if (!w.decor.some((d) => d.x === p.x && d.y === p.y)) w.decor.push({ type: tool.v, x: p.x, y: p.y }); break; }
      case 'prop': this.placeProp(t); break;
      default: break;
    }
  }
  setBrush(t, v) {
    const n = this.brush === 'rect' ? 1 : this.brush;
    const o = Math.floor((n - 1) / 2);
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) this.world.set(t.x - o + dx, t.y - o + dy, v);
  }
  snapDown(t) {
    const w = this.world;
    let y = clamp(t.y, 1, w.h - 2);
    for (let k = 0; k < 8; k++) { if (w.get(t.x, y + 1) === T.SOLID || w.get(t.x, y + 1) === T.PLAT) return { x: t.x, y }; y++; }
    return { x: t.x, y: clamp(t.y, 1, w.h - 2) };
  }
  snapUp(t) {
    const w = this.world;
    let y = clamp(t.y, 1, w.h - 2);
    for (let k = 0; k < 10; k++) { if (w.get(t.x, y - 1) === T.SOLID) return { x: t.x, y }; y--; }
    return { x: t.x, y: clamp(t.y, 1, w.h - 2) };
  }
  placeProp(t) {
    const w = this.world, type = this.tool.v;
    const meta = PROP_META[type];
    const spec = { type, x: t.x, y: t.y };
    if (type === 'trapdoor') { spec.w = Number(window.prompt('Ancho de la trampilla (tiles):', String(meta.w))) || meta.w; spec.phase = w.props.length; }
    else if (type === 'curtain') { const p = this.snapUp(t); spec.x = t.x; spec.y = p.y; spec.h = Number(window.prompt('Alto de la cortina (tiles):', String(meta.h || 4))) || 4; spec.phase = w.props.length; }
    else if (type === 'spotlight') { const p = this.snapUp(t); spec.y = p.y; }
    else if (type === 'rope') { const p = this.snapUp(t); spec.y = p.y; spec.len = Number(window.prompt('Largo de la cuerda (tiles):', String(meta.len))) || meta.len; }
    else if (type === 'ferris') { spec.r = Number(window.prompt('Radio de la noria (px):', String(meta.r))) || meta.r; }
    w.props = w.props.filter((q) => !(q.type === type && q.x === spec.x && q.y === spec.y));
    w.props.push(spec);
    this.stroke = null; this.pointers.clear();
  }
  removeEntitiesAt(t) {
    const w = this.world;
    const near = (o) => Math.abs(o.x - t.x) <= 0 && Math.abs(o.y - t.y) <= 1;
    w.enemies = w.enemies.filter((o) => !near(o));
    w.decor = w.decor.filter((o) => !near(o));
    w.signs = w.signs.filter((o) => !near(o));
    w.checkpoints = w.checkpoints.filter((o) => !near(o));
    w.amulets = w.amulets.filter((o) => !near(o));
    w.props = w.props.filter((o) => !(Math.abs(o.x - t.x) <= (o.w || 1) && Math.abs(o.y - t.y) <= (o.h || 1) && o.x <= t.x && t.x < o.x + (o.w || 1) + 0.5));
    if (w.exit && near(w.exit)) w.exit = null;
  }

  // ---------------------------------------------------------------- acciones
  keydown(e) {
    if (!this.visible) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    this.keys.add(e.code);
    if (e.code === 'Space') { this.spaceDown = true; e.preventDefault(); }
    if (e.ctrlKey || e.metaKey) {
      if (e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? this.doRedo() : this.doUndo(); }
      else if (e.code === 'KeyY') { e.preventDefault(); this.doRedo(); }
      else if (e.code === 'KeyS') { e.preventDefault(); this.save(); }
      return;
    }
    if (e.code === 'Enter') { e.preventDefault(); this.play(); }
    if (e.code === 'Digit1') this.brushSel.value = '1', this.brush = 1;
    if (e.code === 'Digit2') this.brushSel.value = '2', this.brush = 2;
    if (e.code === 'Digit3') this.brushSel.value = '3', this.brush = 3;
    if (e.code === 'KeyG') { this.grid = !this.grid; this.dirty = true; }
  }
  step() {
    // desplazamiento con WASD / flechas
    const k = this.keys;
    const sp = 22 / this.zoom * TILE * 0.6;
    if (k.has('KeyW') || k.has('ArrowUp')) { this.oy -= sp; this.dirty = true; }
    if (k.has('KeyS') || k.has('ArrowDown')) { this.oy += sp; this.dirty = true; }
    if (k.has('KeyA') || k.has('ArrowLeft')) { this.ox -= sp; this.dirty = true; }
    if (k.has('KeyD') || k.has('ArrowRight')) { this.ox += sp; this.dirty = true; }
    if (this.dirty) { this.clampView(); this.draw(); this.dirty = false; }
  }
  exit() { this.saveDraft(); this.hide(); this.app.toMenu(); }
  play() {
    if (!this.world.start) { toast('Falta el punto de inicio'); return; }
    this.saveDraft();
    this.app.testWorld(World.fromJSON(JSON.parse(this.snapshot())));
  }
  slug(s) { return (s || 'nivel').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nivel'; }
  save() {
    const name = (this.world.name || '').trim() || window.prompt('Nombre del nivel:', 'Mi nivel') || 'Mi nivel';
    this.world.name = name; this.nameIn.value = name;
    const id = this.slug(name);
    Store.data.customLevels[id] = JSON.parse(this.snapshot());
    Store.save();
    toast(`Guardado: «${name}» (Jugar → Tus niveles)`);
  }
  exportJSON() { download(`${this.slug(this.world.name)}.json`, this.snapshot()); }
  async importJSON() {
    const text = await pickFile('.json');
    if (!text) return;
    try {
      const j = JSON.parse(text);
      if (!j.rle || !j.w || !j.h) throw new Error('formato');
      this.pushUndo();
      this.setWorld(World.fromJSON(j));
      toast('Nivel importado');
    } catch (e) { toast('JSON de nivel no válido'); }
  }
  applySize() {
    const nw = clamp(Number(this.wIn.value) || this.world.w, 30, 400), nh = clamp(Number(this.hIn.value) || this.world.h, 20, 120);
    this.pushUndo();
    this.world.resize(nw, nh);
    this.fit(); this.dirty = true; this.syncFields();
  }
  newLevel() {
    if (!window.confirm('¿Crear un nivel vacío? (se puede deshacer)')) return;
    this.pushUndo();
    const w = new World(80, 40, this.world.theme, 'Nivel nuevo');
    w.fill(0, 34, 80, 6, T.SOLID);
    w.fill(0, 0, 1, 40, T.SOLID); w.fill(79, 0, 1, 40, T.SOLID); w.fill(0, 0, 80, 1, T.SOLID);
    w.start = { x: 4, y: 33 };
    this.world = w; this.fit(); this.syncFields(); this.dirty = true;
  }
  validate() {
    const w = World.fromJSON(JSON.parse(this.snapshot()));
    if (!w.start) { toast('Falta el punto de inicio'); return; }
    // si el nivel trae ladders/meta del builder no, se valida solo alcance y retorno
    w.meta = w.meta || {};
    const t0 = performance.now();
    const r = validateWorld(w, { abilities: w.abilities });
    const ms = Math.round(performance.now() - t0);
    const msg = r.ok ? `✔ Nivel válido (${r.stats.reachable} posiciones, ${ms} ms)` : `✗ ${r.errors.length} problema(s):\n` + r.errors.slice(0, 8).join('\n');
    window.alert(msg);
  }

  // ---------------------------------------------------------------- dibujo
  draw() {
    const ctx = this.ctx, w = this.world, z = this.zoom, dpr = this.dpr || 1;
    const W = this.canvas.width / dpr, H = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = themeOf(w.theme);
    ctx.fillStyle = '#0b0e18'; ctx.fillRect(0, 0, W, H);
    const cx = this.ox / TILE, cy = this.oy / TILE;
    // área del nivel
    ctx.fillStyle = '#121828';
    ctx.fillRect(-cx * z, -cy * z, w.w * z, w.h * z);
    const x0 = Math.max(0, Math.floor(cx)), x1 = Math.min(w.w - 1, Math.ceil(cx + W / z));
    const y0 = Math.max(0, Math.floor(cy)), y1 = Math.min(w.h - 1, Math.ceil(cy + H / z));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = w.tiles[y * w.w + x];
        if (!t) continue;
        const px = (x - cx) * z, py = (y - cy) * z;
        if (t === T.SOLID) {
          ctx.fillStyle = hash2(x, y) > 0.5 ? th.solid : th.solidAlt;
          ctx.fillRect(px, py, z + 0.5, z + 0.5);
          if (y === 0 || w.tiles[(y - 1) * w.w + x] !== T.SOLID) { ctx.fillStyle = th.top; ctx.fillRect(px, py, z + 0.5, Math.max(2, z * 0.18)); }
        } else if (t === T.PLAT) {
          ctx.fillStyle = th.plat; ctx.fillRect(px, py, z + 0.5, Math.max(3, z * 0.28));
        } else if (t === T.SPIKE) {
          ctx.fillStyle = th.spike;
          for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(px + k * z / 4, py + z); ctx.lineTo(px + k * z / 4 + z / 8, py + z * 0.45); ctx.lineTo(px + (k + 1) * z / 4, py + z); ctx.fill(); }
        } else if (t === T.LAVA) {
          ctx.fillStyle = '#c4300c'; ctx.fillRect(px, py, z + 0.5, z + 0.5);
          if (y === 0 || w.tiles[(y - 1) * w.w + x] !== T.LAVA) { ctx.fillStyle = th.lava; ctx.fillRect(px, py, z + 0.5, z * 0.3); }
        }
      }
    }
    // rejilla
    if (this.grid && z >= 12) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = x0; x <= x1 + 1; x++) { ctx.moveTo((x - cx) * z, (y0 - cy) * z); ctx.lineTo((x - cx) * z, (y1 + 1 - cy) * z); }
      for (let y = y0; y <= y1 + 1; y++) { ctx.moveTo((x0 - cx) * z, (y - cy) * z); ctx.lineTo((x1 + 1 - cx) * z, (y - cy) * z); }
      ctx.stroke();
    }
    // decorado
    ctx.font = `bold ${Math.max(8, z * 0.45)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const d of w.decor) {
      const def = DECOR[d.type]; if (!def) continue;
      const px = (d.x - cx) * z, py = (d.y - cy) * z;
      ctx.fillStyle = 'rgba(122,154,106,0.35)'; ctx.strokeStyle = '#7a9a6a'; ctx.lineWidth = 1;
      const wpx = def.w * z, hpx = Math.min(def.h * z, 3 * z);
      ctx.fillRect(px + z / 2 - wpx / 2, py + z - hpx, wpx, hpx); ctx.strokeRect(px + z / 2 - wpx / 2, py + z - hpx, wpx, hpx);
      ctx.fillStyle = '#cfe3c0'; ctx.fillText(def.name.slice(0, 3), px + z / 2, py + z - hpx / 2);
    }
    // props dinámicos
    for (const p of w.props) {
      const px = (p.x - cx) * z, py = (p.y - cy) * z;
      ctx.strokeStyle = '#ff6a7a'; ctx.fillStyle = 'rgba(176,52,60,0.35)'; ctx.lineWidth = 2;
      if (p.type === 'trapdoor') { ctx.fillRect(px, py, (p.w || 2) * z, z * 0.4); ctx.strokeRect(px, py, (p.w || 2) * z, z * 0.4); }
      else if (p.type === 'curtain') { ctx.fillRect(px + z * 0.3, py, z * 0.4, (p.h || 4) * z); ctx.strokeRect(px + z * 0.3, py, z * 0.4, (p.h || 4) * z); }
      else if (p.type === 'rope') { ctx.beginPath(); ctx.moveTo(px + z / 2, py); ctx.lineTo(px + z / 2, py + (p.len || 4) * z); ctx.stroke(); }
      else if (p.type === 'spotlight') { ctx.fillRect(px + z * 0.1, py, z * 0.8, z * 0.6); ctx.strokeRect(px + z * 0.1, py, z * 0.8, z * 0.6); }
      else if (p.type === 'ferris') { ctx.beginPath(); ctx.arc(px + z / 2, py + z / 2, (p.r || 140) / TILE * z, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#ffb3bb'; ctx.fillText(PROP_META[p.type] ? PROP_META[p.type].label.slice(0, 4) : p.type, px + z / 2, py + z * 0.9);
    }
    // carteles, enemigos, objetos
    for (const s of w.signs) this.icon(ctx, s.x, s.y, '#c9a070', 'i', cx, cy, z);
    for (const e of w.enemies) { const m = ENEMY_META[e.type] || { color: '#888', label: '?' }; this.icon(ctx, e.x, e.y, m.color, m.label.slice(0, 2), cx, cy, z, true); }
    for (const c of w.checkpoints) this.icon(ctx, c.x, c.y, '#ffe27a', '⚑', cx, cy, z);
    for (const a of w.amulets) this.icon(ctx, a.x, a.y, AMULETS[a.type] ? AMULETS[a.type].color : '#fff', '◆', cx, cy, z);
    if (w.exit) this.icon(ctx, w.exit.x, w.exit.y, '#c79bff', '⚐', cx, cy, z);
    if (w.start) this.icon(ctx, w.start.x, w.start.y, '#6fff9f', '▶', cx, cy, z);
    // marco del nivel
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(-cx * z, -cy * z, w.w * z, w.h * z);
    // cursor / vista previa del pincel
    if (this.cursor && !this.pan) {
      const n = this.isTile() ? (this.brush === 'rect' ? 1 : this.brush) : 1;
      const o = Math.floor((n - 1) / 2);
      ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 2;
      ctx.strokeRect((this.cursor.x - o - cx) * z, (this.cursor.y - o - cy) * z, n * z, n * z);
      if (this.stroke && this.stroke.rect) {
        const a = this.stroke.start, b = this.cursor;
        ctx.fillStyle = 'rgba(255,210,90,0.2)';
        ctx.fillRect((Math.min(a.x, b.x) - cx) * z, (Math.min(a.y, b.y) - cy) * z, (Math.abs(a.x - b.x) + 1) * z, (Math.abs(a.y - b.y) + 1) * z);
      }
    }
  }
  icon(ctx, x, y, color, label, cx, cy, z, circle) {
    const px = (x - cx) * z + z / 2, py = (y - cy) * z + z / 2;
    ctx.fillStyle = color; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px, py, z * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#10131c'; ctx.font = `bold ${Math.max(8, z * 0.42)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, px, py + 1);
    void circle;
  }
}
void controls;
