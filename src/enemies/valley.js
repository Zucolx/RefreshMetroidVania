// Enemigos del valle: Lobo, Hada negra y Orco.
import { Enemy } from './base.js';
import { FairyBase } from './forest.js';
import { patrolStep } from './basic.js';
import { CONFIG } from '../config.js';
import { TAU, chance, clamp } from '../util.js';
import { audio } from '../audio.js';

export class Wolf extends Enemy {
  static def = { name: 'Lobo', hp: 45, coins: [4, 7], w: 42, h: 24, contact: 8, color: '#8a8a9a' };
  init(g, spec) {
    this.leader = spec.leader || null;
    this.howler = chance(this.temp ? 0.1 : 0.25);
    if (this.temp) this.coins = [0, 2];
    this.removeDead = this.temp;
    if (this.howler) {
      const k = 1.35, oh = this.h;
      this.w *= k; this.h *= k; this.y -= this.h - oh; this.scale = k; this.snap();
      this.home = { x: this.x, y: this.y };
    } else this.scale = 1;
    this.biteCd = 0; this.jumpCd = 0; this.chasing = false;
  }
  get spdMul() { return this.howler ? 1.4 : 1; }
  ai(g, dt) {
    const T = this.tgt(g);
    const dx = T.x - this.cx, ady = Math.abs(T.y - this.cy), dist = Math.hypot(dx, T.y - this.cy);
    this.biteCd -= dt; this.jumpCd -= dt;
    if (this.atk) { this.updateAtk(g, dt); this.vx *= 0.9; this.physics(g, dt); return; }
    const sees = T.fairy || this.seesPlayer(g, 360) || (this.chasing && dist < 540);
    if (sees) {
      if (!this.chasing) { this.chasing = true; if (this.howler) { audio.sfx('howl'); g.fx.ring(this.cx, this.cy - 10, 6, 60, 0.5, '#fff', 2); } }
      this.face(T.x);
      this.accelX(this.facing * this.spd(230) * this.spdMul, 2000, dt);
      if (this.onGround && this.jumpCd <= 0 && (this.wallAhead(g) || (T.y < this.cy - 60 && Math.abs(dx) < 150))) { this.vy = -640; this.jumpCd = 1; }
      if (this.onGround && Math.abs(dx) < 48 * this.scale && ady < 44 && this.biteCd <= 0) {
        this.biteCd = 1; this.vx = 0;
        this.startAtk({ windup: 0.2, active: 0.12, recover: 0.2, dmg: 12, reach: 44 * this.scale, h: 30, parry: true, kind: 'bite' });
      }
      this.physics(g, dt);
    } else {
      this.chasing = false;
      if (this.leader && !this.leader.dead && Math.abs(this.leader.cx - this.cx) > 110) {
        this.face(this.leader.cx);
        this.accelX(this.facing * this.spd(200), 1500, dt);
        if (this.onGround && this.wallAhead(g)) this.vy = -600;
        this.physics(g, dt);
      } else patrolStep(this, g, dt, 60);
    }
  }
  paint(c) {
    const run = Math.abs(this.vx) > 20;
    const s = run ? Math.sin(this.animT * 22) * 5 : 0;
    const k = this.scale || 1;
    c.scale(k, k);
    c.fillStyle = '#5a5a6a'; c.fillRect(-16 + s, -6, 5, 6); c.fillRect(-6 - s, -6, 5, 6); c.fillRect(6 + s, -6, 5, 6); c.fillRect(15 - s, -6, 5, 6);
    c.fillStyle = this.howler ? '#6a6a86' : '#8a8a9a'; c.beginPath(); c.ellipse(-2, -14, 19, 9, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-18, -14); c.quadraticCurveTo(-30, -10, -31, -18 + Math.sin(this.animT * 6) * 3); c.lineTo(-16, -9); c.fill();
    c.fillStyle = '#9a9aaa'; c.beginPath(); c.ellipse(17, -17, 9, 7, -0.2, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(14, -23); c.lineTo(17, -31); c.lineTo(21, -23); c.fill();
    c.fillStyle = this.howler ? '#ff5a3a' : '#ffe27a'; c.beginPath(); c.arc(19, -19, 1.8, 0, TAU); c.fill();
    c.fillStyle = '#fff'; if (this.atk && this.atk.t > this.atk.windup * 0.5) { c.fillRect(22, -14, 3, 4); c.fillRect(25, -13, 3, 3); } else c.fillRect(23, -14, 2, 2);
    if (this.howler) { c.strokeStyle = 'rgba(255,90,60,0.5)'; c.lineWidth = 2; c.beginPath(); c.ellipse(-2, -14, 23, 13, 0, 0, TAU); c.stroke(); }
  }
}

export class BlackFairy extends FairyBase {
  static def = { name: 'Hada negra', hp: 1, coins: [4, 6], w: 16, h: 16, contact: 0, color: '#2a1a3a', flies: true, dodge: 0.75 };
  get detect() { return 330; }
  get orbitR() { return 100; }
  drainPlayer(g, dt, p) { p.drain(4, 0, dt); }
  paint(c) { this.paintFairy(c, '#3a2450', 'rgba(150,60,200,0.3)', '#c879ff'); }
}

export class Orc extends Enemy {
  static def = { name: 'Orco', hp: 90, coins: [8, 14], w: 42, h: 62, contact: 12, color: '#8aa87a', heavy: true };
  init() {
    this.axeCd = 0; this.rockCd = 1.5;
    this.summoner = chance(0.1);
    this.summoned = false;
  }
  ai(g, dt) {
    const T = this.tgt(g);
    const dx = T.x - this.cx, ady = Math.abs(T.y - this.cy), dist = Math.hypot(dx, T.y - this.cy);
    this.axeCd -= dt; this.rockCd -= dt;
    if (this.atk) { this.updateAtk(g, dt); this.vx *= 0.8; this.physics(g, dt); return; }
    const sees = T.fairy || this.seesPlayer(g, 430);
    if (!sees) { patrolStep(this, g, dt, 30, 300); return; }
    this.face(T.x);
    if (this.summoner && !this.summoned) {
      this.summoned = true;
      const alive = g.enemies.filter((e) => e.leader === this && !e.dead).length;
      for (let i = alive; i < 2; i++) g.spawnEnemy({ type: 'wolf', x: 0, y: 0, px: this.cx + (i ? 50 : -50), py: this.y + this.h, temp: true, leader: this });
      g.fx.text(this.cx, this.y - 10, '¡a mí, lobos!', '#ffe27a', 1, 12);
      audio.sfx('howl');
    }
    const near = Math.abs(dx) < 60 && ady < 60;
    this.accelX(near ? 0 : this.facing * this.spd(80), 600, dt);
    if (this.onGround && (this.wallAhead(g) || !this.floorAhead(g))) this.vx = 0;
    if (near && this.axeCd <= 0) {
      this.axeCd = 1.6;
      this.startAtk({ windup: 0.4, active: 0.15, recover: 0.3, dmg: 18, reach: 62, h: 52, parry: true, kind: 'axe' });
    } else if (this.rockCd <= 0 && dist > 110 && dist < 430 && g.world.los(this.cx, this.cy, T.x, T.y)) {
      this.rockCd = 2.8;
      const t = clamp(Math.abs(dx) / 300, 0.45, 1.1);
      this.shoot(g, { x: this.cx + this.facing * 14, y: this.y + 12, vx: dx / t, vy: (T.y - this.y) / t - 0.5 * 1000 * t, r: 11, dmg: 14, life: 3, grav: 1000, color: '#8a8070', shape: 'rock', kind: 'enemy', cut: true, reflect: true, shieldKill: true, spin: 7 });
      audio.sfx('whoosh');
    }
    this.physics(g, dt);
  }
  paint(c) {
    const w = Math.abs(this.vx) > 5 ? Math.sin(this.animT * 7) * 3 : 0;
    c.fillStyle = '#4a5a3a'; c.fillRect(-14 + w, -16, 11, 16); c.fillRect(3 - w, -16, 11, 16);
    c.fillStyle = '#8aa87a'; c.beginPath(); c.roundRect(-18, -46, 36, 34, 8); c.fill();
    c.fillStyle = '#6a4a2a'; c.fillRect(-18, -22, 36, 6);
    c.fillStyle = '#9ab88a'; c.beginPath(); c.arc(2, -52, 11, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.fillRect(8, -48, 3, 4); c.fillRect(-1, -48, 3, 4);
    c.fillStyle = '#c01818'; c.fillRect(9, -57, 3, 3); c.fillRect(0, -57, 3, 3);
    // hacha
    const a = this.atk;
    const ang = a ? (a.t < a.windup ? -1.2 - (a.t / a.windup) * 0.8 : -2 + ((a.t - a.windup) / 0.15) * 3) : -0.4;
    c.save(); c.translate(14, -36); c.rotate(ang);
    c.fillStyle = '#6a4a2a'; c.fillRect(0, -2, 34, 4);
    c.fillStyle = '#c9ccd6'; c.beginPath(); c.moveTo(30, -12); c.lineTo(42, -5); c.lineTo(42, 7); c.lineTo(30, 12); c.fill();
    c.restore();
    if (this.summoner) { c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(-14, -40, 3, 0, TAU); c.fill(); }
  }
}
void CONFIG;
