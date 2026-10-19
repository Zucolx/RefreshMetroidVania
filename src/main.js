// Arranque: escalado responsive, bucle de paso fijo a 60 Hz con interpolación, estados de la aplicación.
// Estados: menu → select → play ↔ pause, más editor y lab.
import { STEP, VIEW_W, VIEW_H } from './config.js';
import { platform } from './platform.js';
import { Store } from './storage.js';
import { controls } from './controls.js';
import { Input } from './input.js';
import { TouchControls } from './touch.js';
import { audio } from './audio.js';
import { Game } from './game.js';
import { World } from './world.js';
import { buildLevel, LEVELS } from './levels/index.js';
import { drawHud } from './hud.js';
import { Menus } from './ui/menus.js';
import { LabPanel } from './ui/lab.js';
import { Editor } from './editor.js';
import { sprites } from './render/hybrid.js';
import { drawBackground } from './themes.js';
import { THEME_IDS } from './themes.js';
import { clamp } from './util.js';

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.frameEl = document.getElementById('frame');
    this.state = 'menu';
    this.input = new Input();
    this.game = new Game({ input: this.input });
    this.touch = new TouchControls(this.input, this.canvas, this.game);
    this.menus = new Menus(this);
    this.lab = new LabPanel(this);
    this.editor = new Editor(this);
    this.fromEditor = false;
    this.acc = 0;
    this.last = 0;
    this.t = 0;
    this.pendingWorld = null;
    this.running = false;
    this.navIndex = -1;
  }

  init() {
    Store.load();
    controls.load();
    platform.setupNative();
    this.input.attach(window);
    this.touch.attach();
    platform.onFirstGesture(() => audio.unlock());
    platform.onLifecycle((s) => { if (s !== 'visible' && this.state === 'play') this.pauseMenu(); });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('fullscreenchange', () => this.resize());
    window.addEventListener('keydown', (e) => this.menuKey(e));
    this.resize();
    sprites.reload();
    this.game.onComplete = (g) => this.onComplete(g);
    // arranque directo por parámetros (útil para pruebas): ?level=forest
    const q = new URLSearchParams(location.search);
    if (location.hash === '#editor') this.openEditor();
    else if (q.get('level')) {
      if (q.get('team')) Store.data.team = q.get('team').split(',');
      this.startLevel(q.get('level'));
      if (q.get('lab')) this.toggleLab(true);
    } else this.menus.main();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- escalado ----------
  resize() {
    const k = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    this.scale = k;
    this.frameEl.style.transform = `scale(${k})`;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const s = clamp(k * dpr, 1, 2.5);
    const w = Math.round(VIEW_W * s), h = Math.round(VIEW_H * s);
    if (this.canvas.width !== w) { this.canvas.width = w; this.canvas.height = h; }
    this.pxScale = s;
    const portrait = window.innerHeight > window.innerWidth;
    document.getElementById('rotate').classList.toggle('hidden', !(portrait && (platform.coarse || platform.hasTouch) && window.innerWidth < 800));
    this.editor.onResize && this.editor.onResize();
  }

  // ---------- estados ----------
  setState(s) { this.state = s; }

  startLevel(id) {
    const world = buildLevel(id);
    if (!world) return;
    this.fromEditor = false;
    this.beginPlay(world, id);
  }
  startCustom(id) {
    const j = Store.data.customLevels[id];
    if (!j) return;
    this.fromEditor = false;
    this.beginPlay(World.fromJSON(j), 'custom:' + id);
  }
  startLab() {
    this.fromEditor = false;
    this.beginPlay(buildLevel('lab'), 'lab');
    this.toggleLab(true);
  }
  testWorld(world) {
    this.fromEditor = true;
    this.editor.hide();
    this.beginPlay(world, 'editor');
  }
  beginPlay(world, id) {
    this.currentId = id;
    this.currentWorldJSON = world.toJSON();
    this.game.load(world, { levelId: id, team: Store.data.team.length ? Store.data.team.slice() : ['swordsman'] });
    this.game.completed = false;
    this.menus.clear();
    this.input.clear();
    this.touch.releaseAll();
    this.state = 'play';
    this.acc = 0;
  }
  restart() {
    if (!this.currentWorldJSON) return;
    this.beginPlay(World.fromJSON(this.currentWorldJSON), this.currentId);
  }
  pauseMenu() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    this.touch.releaseAll();
    this.menus.pauseMenu();
  }
  resume() {
    this.menus.clear();
    this.state = 'play';
    this.input.clear();
    this.acc = 0;
  }
  inventory() {
    this.state = 'inventory';
    this.menus.inventory();
  }
  toMenu() {
    this.lab.hide();
    this.state = 'menu';
    this.fromEditor = false;
    this.menus.main();
  }
  toggleLab(force) {
    if (this.state !== 'play' && this.state !== 'lab') return;
    this.lab.toggle(force);
  }
  openEditor(world) {
    this.lab.hide();
    this.menus.clear();
    this.state = 'editor';
    this.editor.show(world);
  }
  backToEditor() {
    this.menus.clear();
    this.state = 'editor';
    this.editor.show();
  }
  onComplete(g) {
    const id = this.currentId;
    if (id && !String(id).startsWith('custom:') && id !== 'editor' && id !== 'lab') Store.complete(id);
    else if (id === 'lab') Store.complete('lab');
    Store.save();
    const idx = LEVELS.findIndex((l) => l.id === id);
    const lv = LEVELS[idx];
    setTimeout(() => {
      if (this.state !== 'play') return;
      this.state = 'complete';
      this.menus.complete({ name: lv ? lv.name : g.world.name, time: g.time, coins: g.coinsRun || 0, kills: g.stats.kills, next: idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1].id : null });
    }, 1600);
  }

  // ---------- navegación de menús por teclado / mando ----------
  navItems() {
    const scr = Array.from(document.querySelectorAll('#ui .screen')).filter((s) => !s.classList.contains('hidden')).pop();
    if (!scr) return [];
    return Array.from(scr.querySelectorAll('button:not(:disabled), .card, .slot, select, input[type=range], input[type=checkbox]')).filter((e) => e.offsetParent !== null);
  }
  navMove(dir) {
    const items = this.navItems();
    if (!items.length) return;
    items.forEach((e) => e.classList.remove('nav-focus'));
    const cur = items.findIndex((e) => e === document.activeElement);
    let i = this.navIndex >= 0 && this.navIndex < items.length ? this.navIndex : cur;
    i = i < 0 ? 0 : (i + dir + items.length) % items.length;
    this.navIndex = i;
    items[i].classList.add('nav-focus');
    items[i].focus({ preventScroll: false });
    items[i].scrollIntoView({ block: 'nearest' });
    audio.sfx('menu');
  }
  navActivate() {
    const items = this.navItems();
    const el = items.find((e) => e.classList.contains('nav-focus')) || document.activeElement;
    if (el && el.click) el.click();
  }
  navBack() {
    const b = document.querySelector('#ui .screen:not(.hidden) .back');
    if (b) b.click();
  }
  menuKey(e) {
    if (!this.menus.active || this.input.capture) return;
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    const k = e.code;
    if (k === 'ArrowDown' || k === 'ArrowRight') { this.navMove(1); e.preventDefault(); }
    else if (k === 'ArrowUp' || k === 'ArrowLeft') { this.navMove(-1); e.preventDefault(); }
    else if (k === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { this.navActivate(); e.preventDefault(); }
  }

  // ---------- bucle ----------
  frame(ts) {
    requestAnimationFrame((t) => this.frame(t));
    const dtReal = Math.min(0.1, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    this.t += dtReal;
    const input = this.input;
    input.pollPads();
    this.hotkeys();
    this.padMenuNav();
    let alpha = 1;
    if (this.state === 'play') {
      this.acc += dtReal;
      let n = 0;
      while (this.acc >= STEP && n++ < 6) {
        this.game.step(STEP);
        this.acc -= STEP;
      }
      if (n >= 6) this.acc = 0;
      alpha = this.acc / STEP;
    } else {
      input.flushEdges();
    }
    this.draw(alpha);
  }

  hotkeys() {
    const i = this.input;
    if (this.state === 'play') {
      if (i.consume('pause')) this.pauseMenu();
      else if (i.consume('inventory')) this.inventory();
      else if (i.consume('lab')) this.toggleLab();
      else if (i.consume('help')) { this.state = 'pause'; this.menus.help(); }
    } else if (this.state === 'pause' || this.state === 'inventory') {
      if (i.consume('pause') || i.consume('inventory')) {
        const nested = document.querySelectorAll('#ui .screen.hidden').length;
        if (nested) this.navBack(); else this.resume();
      } else if (i.consume('help')) this.resume();
    } else if (this.state === 'menu') {
      if (i.consume('help')) { /* sin efecto */ }
    }
  }
  padMenuNav() {
    if (!this.menus.active || this.input.capture) return;
    const u = this.input.uiPressed;
    if (u.down || u.right) this.navMove(1);
    if (u.up || u.left) this.navMove(-1);
    if (u.ok) this.navActivate();
    if (u.back) this.navBack();
    this.input.uiPressed = {};
  }

  draw(alpha) {
    const ctx = this.ctx;
    const s = this.pxScale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    const playing = this.state === 'play' || this.state === 'pause' || this.state === 'inventory' || this.state === 'complete' || this.state === 'lab';
    if (playing && this.game.world) {
      this.game.draw(ctx, alpha);
      drawHud(ctx, this.game, this.t);
      this.touch.draw(ctx, this.state === 'play');
    } else if (this.state !== 'editor') {
      this.drawBackdrop(ctx);
    }
    if (this.state === 'play' || this.state === 'pause') {
      // se usa solo con fines de depuración
    }
  }

  drawBackdrop(ctx) {
    const t = this.t;
    const theme = THEME_IDS[Math.floor(t / 10) % THEME_IDS.length];
    drawBackground(ctx, { theme }, { x: t * 60, y: 120 }, t);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

const app = new App();
window.__app = app; // acceso para depuración y pruebas
app.init();
