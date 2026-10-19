// Enemigos del teatro: Marioneta sin hilos, Actor sombra, Máscara risueña y Payaso de resorte.
import { Enemy } from './base.js';
import { patrolStep } from './basic.js';
import { moveBody } from '../physics.js';
import { CONFIG } from '../config.js';
import { TAU, chance, clamp } from '../util.js';
import { audio } from '../audio.js';

export class Marionette extends Enemy {
  static def = { name: 'Marioneta sin hilos', hp: 35, coins: [3, 5], w: 24, h: 42, contact: 8, color: '#c9a070' };
  init() { this.lungeT = 0.4; this.limp = 0; this.lashCd = 0; this.chain = false; }
  ai(g, dt) {
    const T = this.tgt(g);
    const dx = T.x - this.cx, ady = Math.abs(T.y - this.cy), dist = Math.hypot(dx, T.y - this.cy);
    this.lashCd -= dt;
    if (this.atk) { this.updateAtk(g, dt); this.vx *= 0.8; this.physics(g, dt); return; }
    if (this.limp > 0) { this.limp -= dt; this.vx *= 0.8; this.physics(g, dt); return; } // cuelga
    const sees = T.fairy || this.seesPlayer(g, 380);
    if (!sees) {
      // a tirones, lento (45 px/s)
      this.lungeT -= dt;
      const jerk = Math.floor(this.animT * 3) % 2 === 0;
      this.accelX(jerk ? this.facing * this.spd(45) : 0, 1500, dt);
      if (this.onGround && (this.wallAhead(g) || !this.floorAhead(g))) { this.facing = -this.facing; this.vx = 0; }
      this.physics(g, dt);
      return;
    }
    this.face(T.x);
    // a tirones rápidos (380 px/s) en ráfagas cortas
    this.lungeT -= dt;
    const burst = this.lungeT > 0 && this.lungeT < 0.14;
    if (this.lungeT <= 0) this.lungeT = 0.5;
    this.accelX(burst ? this.facing * this.spd(380) : this.facing * this.spd(30), 6000, dt);
    if (this.onGround && this.wallAhead(g)) this.vy = -520;
    if (this.onGround && Math.abs(dx) < 58 && ady < 54 && this.lashCd <= 0) {
      this.lashCd = 1.2; this.vx = 0;
      this.startAtk({ windup: 0.16, active: 0.1, recover: 0.18, dmg: 12, reach: 54, h: 36, parry: true, kind: 'lash' });
      this.chain = chance(0.4);
    }
    this.physics(g, dt);
  }
  onAtkEnd(g) {
    if (this.chain) { this.chain = false; this.startAtk({ windup: 0.14, active: 0.1, recover: 0.25, dmg: 12, reach: 54, h: 36, parry: true, kind: 'lash' }); }
    else this.limp = 0.4;
  }
  paint(c) {
    const t = this.animT;
    const limp = this.limp > 0;
    const jit = limp ? Math.sin(t * 20) * 0.4 : Math.floor(t * 8) % 2 ? 0.08 : -0.08;
    c.fillStyle = '#7a4a2a'; c.fillRect(-9, -14, 5, 14); c.fillRect(4, -14, 5, 14);
    c.fillStyle = '#b03a4a'; c.fillRect(-10, -32, 20, 20);
    c.fillStyle = '#c9a070'; c.beginPath(); c.arc(0, -40, 8 + 0, 0, TAU); c.fill();
    c.fillStyle = '#222'; c.fillRect(2, -42, 3, 3); c.fillRect(-4, -42, 3, 3);
    c.strokeStyle = '#222'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-4, -35); c.lineTo(4, -35); c.stroke();
    // cabo de hilo cortado
    c.strokeStyle = 'rgba(230,230,230,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-4, -48); c.lineTo(-6, -58 + Math.sin(t * 3) * 2); c.moveTo(4, -48); c.lineTo(6, -56); c.stroke();
    const a = this.atk;
    const ang = a ? (a.t < a.windup ? -1.3 : 0.3) : 0.6 + jit;
    c.save(); c.translate(8, -28); c.rotate(ang);
    c.strokeStyle = '#c9a070'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(14, 0); c.stroke();
    if (a) { c.strokeStyle = '#ffdc9a'; c.lineWidth = 3; c.beginPath(); c.moveTo(14, 0); c.lineTo(30 + 10, 0); c.stroke(); }
    c.restore();
    c.strokeStyle = '#c9a070'; c.lineWidth = 4; c.beginPath(); c.moveTo(-8, -28); c.lineTo(-14, -18 + jit * 10); c.stroke();
  }
}

export class Shadow extends Enemy {
  static def = { name: 'Actor sombra', hp: 40, coins: [3, 6], w: 24, h: 44, contact: 10, color: '#2a2438' };
  init() { this.seen = 0; this.queue = []; this.dashT = 0; this.jumpCd = 0; }
  get contactMul() { return this.dashT > 0 ? 1.6 : 1; }
  ai(g, dt) {
    const T = this.tgt(g);
    const p = g.player;
    const dx = T.x - this.cx, dist = Math.hypot(dx, T.y - this.cy);
    this.jumpCd -= dt;
    if (this.atk) { this.updateAtk(g, dt); this.vx *= 0.8; this.physics(g, dt); return; }
    if (this.dashT > 0) {
      this.dashT -= dt; this.vx = this.facing * 600;
      this.physics(g, dt);
      return;
    }
    const sees = T.fairy || (dist < 420 && g.world.los(this.cx, this.cy, T.x, T.y));
    if (!sees) { patrolStep(this, g, dt, 30, 600); return; }
    this.face(T.x);
    // registra la última acción del jugador y la repite 0,5 s después
    const la = p.lastAct;
    if (la && la.time > this.seen) { this.seen = la.time; this.queue.push({ t: 0.5, type: la.type }); }
    let acted = false;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.queue.splice(i, 1); acted = true;
        if (q.type === 'attack') this.startAtk({ windup: 0.12, active: 0.1, recover: 0.2, dmg: 12, reach: 52, h: 38, parry: true, kind: 'mimic' });
        else if (q.type === 'jump' && this.onGround) this.vy = -700;
        else if (q.type === 'dash') { this.dashT = 0.25; this.vx = this.facing * 600; }
      }
    }
    void acted;
    if (!this.atk && this.dashT <= 0) {
      // si no haces nada, se acerca (90)
      const recent = this.queue.length > 0;
      this.accelX(!recent && Math.abs(dx) > 40 ? this.facing * this.spd(90) : 0, 800, dt);
      if (this.onGround && this.wallAhead(g)) this.vy = -600;
    }
    this.physics(g, dt);
  }
  paint(c) {
    const t = this.animT;
    c.globalAlpha = 0.92;
    c.fillStyle = '#1b1626'; c.fillRect(-8, -16, 6, 16); c.fillRect(2, -16, 6, 16);
    c.beginPath(); c.moveTo(-11, -16); c.lineTo(-9, -36); c.quadraticCurveTo(0, -42, 9, -36); c.lineTo(11, -16); c.fill();
    c.beginPath(); c.arc(0, -42, 8.4, 0, TAU); c.fill();
    // capa
    c.fillStyle = '#2a2040'; c.beginPath(); c.moveTo(-8, -34); c.lineTo(-20 - Math.sin(t * 3) * 3, -10); c.lineTo(-6, -14); c.fill();
    c.fillStyle = '#c9a0ff'; c.fillRect(2, -44, 4, 2); c.fillRect(-4, -44, 3, 2);
    const a = this.atk;
    if (a) { c.save(); c.translate(8, -30); c.rotate(a.t < a.windup ? -1.2 : 0.4); c.fillStyle = '#9a8ab8'; c.fillRect(0, -2, 34, 3); c.restore(); }
    c.globalAlpha = 1;
    if (this.dashT > 0) { c.fillStyle = 'rgba(201,160,255,0.35)'; c.fillRect(-40, -44, 40, 44); }
  }
}

export class Mask extends Enemy {
  static def = { name: 'Máscara risueña', hp: 20, coins: [2, 5], w: 28, h: 28, contact: 6, color: '#f0e0c0', flies: true, dodge: 0.4 };
  init() {
    this.laughT = 1.2; this.ph = Math.random() * TAU;
    this.noDodge = new Set(['explosion', 'bomb', 'highwave', 'earthwave', 'quake', 'heroic', 'skate', 'rocket']);
  }
  ai(g, dt) {
    const T = this.tgt(g);
    const p = g.player;
    this.ph += dt * 1.6;
    const d = Math.hypot(p.cx - this.cx, p.cy - this.cy);
    if (d > 640 && !T.fairy) { this.vx *= 0.9; this.vy *= 0.9; this.x += this.vx * dt; this.y += this.vy * dt; return; }
    // flota unos 190 px por encima
    let ty = T.y - 190;
    for (let k = 0; k < 8 && g.world.solidAtPx(T.x, ty); k++) ty += 24;
    this.steer(T.x + Math.sin(this.ph) * 80, ty + Math.sin(this.ph * 1.7) * 10, this.spd(150), 600, dt);
    const r = moveBody(g.world, this, dt);
    if (r.l || r.r) this.vx *= -0.3;
    if (r.u || r.d) this.vy *= -0.3;
    this.face(T.x);
    this.laughT -= dt;
    if (this.laughT <= 0 && d < 560) {
      this.laughT = 2.4;
      const base = Math.atan2(T.y - this.cy, T.x - this.cx);
      for (const k of [-1, 0, 1]) {
        const a = base + k * 0.26;
        // carcajadas sónicas: no bloqueables ni reflejables (ni cortables)
        this.shoot(g, { x: this.cx, y: this.cy + 6, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, r: 13, dmg: 10, life: 2.6, color: '#ffe27a', shape: 'ja', kind: 'enemy', sonic: true, unblockable: true, cut: false, reflect: false, shieldKill: false });
      }
      audio.sfx('ja');
      this.laughAnim = 0.35;
    }
    if (this.laughAnim > 0) this.laughAnim -= dt;
  }
  paint(c) {
    const lau = this.laughAnim > 0;
    c.translate(0, -14 + Math.sin(this.ph * 2) * 2);
    c.fillStyle = '#f0e0c0'; c.beginPath(); c.ellipse(0, 0, 13, 15, 0, 0, TAU); c.fill();
    c.strokeStyle = '#8a6a3a'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#222'; c.beginPath(); c.ellipse(-5, -4, 3.2, 2, 0.3, 0, TAU); c.ellipse(5, -4, 3.2, 2, -0.3, 0, TAU); c.fill();
    c.strokeStyle = '#a02838'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, lau ? 2 : 1, lau ? 8 : 6, 0.15, Math.PI - 0.15); c.stroke();
    if (lau) { c.fillStyle = '#7a1a28'; c.beginPath(); c.arc(0, 4, 6, 0, Math.PI); c.fill(); }
    c.fillStyle = '#d9a0a0'; c.beginPath(); c.arc(-9, 2, 2.4, 0, TAU); c.arc(9, 2, 2.4, 0, TAU); c.fill();
    c.fillStyle = '#c9a34a'; c.beginPath(); c.moveTo(-6, -14); c.lineTo(0, -20); c.lineTo(6, -14); c.fill();
  }
}

export class Clown extends Enemy {
  static def = { name: 'Payaso de resorte', hp: 30, coins: [3, 6], w: 26, h: 32, contact: 8, color: '#d9534f' };
  init() { this.setState('box'); this.lost = 0; this.punchCd = 0; this.jumpCd = 0; this.pop = 0; }
  get harmless() { return this.state === 'box'; }
  set harmless(v) {}
  get canMorph() { return this.state !== 'box'; }
  set canMorph(v) {}
  surprise(g) {
    if (this.state !== 'box') return;
    this.setState('out'); this.pop = 0.35; this.lost = 0;
    g.fx.text(this.cx, this.y - 10, '¡Sorpresa!', '#ffe27a', 1, 14);
    g.fx.burst(this.cx, this.cy, 16, '#ffb3d9', 260, 0.6, 3, 200);
    audio.sfx('ja');
    this.face(g.player.cx);
    this.startAtk({ windup: 0.2, active: 0.12, recover: 0.25, dmg: 14, reach: 70, h: 36, parry: true, kind: 'punch' });
  }
  onDamaged(g) { if (this.state === 'box') this.surprise(g); }
  ai(g, dt) {
    const T = this.tgt(g);
    const dx = T.x - this.cx, ady = Math.abs(T.y - this.cy), dist = Math.hypot(dx, T.y - this.cy);
    this.punchCd -= dt; this.jumpCd -= dt;
    if (this.pop > 0) this.pop -= dt;
    if (this.state === 'box') {
      this.vx = 0; this.physics(g, dt);
      if (dist < 96) this.surprise(g);
      return;
    }
    if (this.atk) { this.updateAtk(g, dt); this.vx *= 0.85; this.physics(g, dt); return; }
    const sees = T.fairy || dist < 400;
    this.lost = sees ? 0 : this.lost + dt;
    if (this.lost > 5) { this.setState('box'); g.fx.smoke(this.cx, this.cy, 4); return; }
    this.face(T.x);
    // persigue a saltos
    if (this.onGround && this.jumpCd <= 0 && Math.abs(dx) > 50) { this.vy = -480; this.vx = this.facing * this.spd(220); this.jumpCd = 0.7; }
    if (!this.onGround) this.accelX(this.facing * this.spd(220), 800, dt); else this.vx *= 0.8;
    if (this.onGround && Math.abs(dx) < 58 && ady < 48 && this.punchCd <= 0) {
      this.punchCd = 0.9; this.vx = 0;
      this.startAtk({ windup: 0.22, active: 0.1, recover: 0.2, dmg: 14, reach: 70, h: 36, parry: true, kind: 'punch' });
    }
    this.physics(g, dt);
  }
  paint(c) {
    const t = this.animT;
    if (this.state === 'box') { // parece una caja de regalo
      c.fillStyle = '#d9534f'; c.fillRect(-13, -26, 26, 26);
      c.fillStyle = '#ffe27a'; c.fillRect(-2, -26, 4, 26); c.fillRect(-13, -15, 26, 4);
      c.fillStyle = '#ffe27a'; c.beginPath(); c.ellipse(-5, -30, 6, 4, -0.4, 0, TAU); c.ellipse(5, -30, 6, 4, 0.4, 0, TAU); c.fill();
      c.fillStyle = '#c0392b'; c.fillRect(-14, -28, 28, 4);
      return;
    }
    // muelle y cuerpo
    const sp = this.onGround ? 0 : 1;
    c.strokeStyle = '#9a9aaa'; c.lineWidth = 2;
    c.beginPath(); for (let i = 0; i < 5; i++) { c.lineTo(i % 2 ? 6 : -6, -i * (4 + sp * 2)); } c.stroke();
    const top = -22 - sp * 6;
    c.fillStyle = '#d9534f'; c.beginPath(); c.roundRect(-11, top - 12, 22, 14, 5); c.fill();
    c.fillStyle = '#fff'; c.fillRect(-11, top - 7, 22, 3);
    c.fillStyle = '#f5d9c0'; c.beginPath(); c.arc(0, top - 20, 9, 0, TAU); c.fill();
    c.fillStyle = '#d94a8a'; c.beginPath(); c.arc(-8, top - 24, 5, 0, TAU); c.arc(8, top - 24, 5, 0, TAU); c.fill();
    c.fillStyle = '#e02828'; c.beginPath(); c.arc(1, top - 18, 2.8, 0, TAU); c.fill();
    c.fillStyle = '#222'; c.fillRect(3, top - 23, 2, 3); c.fillRect(-4, top - 23, 2, 3);
    c.fillStyle = '#4a6ad9'; c.beginPath(); c.moveTo(-6, top - 28); c.lineTo(0, top - 40); c.lineTo(6, top - 28); c.fill();
    const a = this.atk;
    const ext = a ? (a.t < a.windup ? -4 : 28) : 4;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(10 + ext, top - 6, 5.5, 0, TAU); c.fill();
    c.strokeStyle = '#d9534f'; c.lineWidth = 3; c.beginPath(); c.moveTo(8, top - 6); c.lineTo(10 + ext, top - 6); c.stroke();
    void t;
  }
}
void clamp; void CONFIG;
