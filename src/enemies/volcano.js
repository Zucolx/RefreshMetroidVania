// Enemigos del volcán: Lagarto de fuego, Gólem e Hiena de fuego.
import { Enemy } from './base.js';
import { CONFIG } from '../config.js';
import { dropCoins } from '../coins.js';
import { hasAmulet } from '../combat.js';
import { TAU, chance, rrange } from '../util.js';
import { audio } from '../audio.js';
import { patrolStep } from './basic.js';

export class Lizard extends Enemy {
  static def = { name: 'Lagarto de fuego', hp: 40, coins: [3, 6], w: 34, h: 22, contact: 10, color: '#d9532a', fire: true };
  init() { this.spitCd = 1 + Math.random(); this.jumpCd = 0; this.smoky = false; }
  ai(g, dt) {
    const T = this.tgt(g);
    const dx = T.x - this.cx, dist = Math.hypot(dx, T.y - this.cy);
    this.spitCd -= dt; this.jumpCd -= dt;
    if (this.state === 'cough') { // cae tosiendo
      this.vx *= 0.9;
      if (this.st > 1.6) this.setState('idle');
      this.physics(g, dt);
      return;
    }
    if (this.state === 'spit') {
      this.vx *= 0.92;
      if (this.st > 0.3 && !this.spat) { this.spat = true; this.spit(g, T); }
      if (this.st > 0.55) { this.spat = false; this.setState('idle'); }
      this.physics(g, dt);
      return;
    }
    const sees = T.fairy || this.seesPlayer(g, 380);
    if (sees) {
      this.face(T.x);
      if (dist > 130) this.accelX(this.facing * this.spd(120), 900, dt); else this.accelX(0, 900, dt);
      if (this.onGround && this.jumpCd <= 0 && (this.wallAhead(g) || (T.y < this.cy - 60 && Math.abs(dx) < 140))) { this.vy = -520; this.jumpCd = 1.2; }
      if (dist < 160 && this.spitCd <= 0 && Math.abs(T.y - this.cy) < 80) { this.spitCd = 1.9; this.smoky = chance(0.1); this.setState('spit'); this.spat = false; }
      this.physics(g, dt);
    } else patrolStep(this, g, dt, 50);
  }
  spit(g, T) {
    const dir = this.facing;
    if (this.smoky) {
      this.shoot(g, { x: this.cx + dir * 18, y: this.cy - 4, vx: dir * 180, vy: -20, r: 14, dmg: 3, life: 0.9, color: '#777', shape: 'smoke', kind: 'enemy', sonic: true, shieldKill: true });
      this.stun = 1.6; this.setState('cough');
      g.fx.text(this.cx, this.y - 8, '¡cof!', '#cccccc', 0.8, 12);
    } else {
      this.shoot(g, { x: this.cx + dir * 18, y: this.cy - 4, vx: dir * 300, vy: rrange(-20, 20), r: 9, dmg: 7, life: 0.55, color: '#ff8a2a', shape: 'flame', kind: 'enemy', cut: true, shieldKill: true });
      audio.sfx('fire');
      this.vx = -dir * 140; // el retroceso lo empuja
    }
  }
  paint(c) {
    const coughing = this.state === 'cough';
    const w = Math.abs(this.vx) > 10 ? Math.sin(this.animT * 14) * 3 : 0;
    c.fillStyle = '#8a2a1a'; c.fillRect(-12 + w, -5, 5, 5); c.fillRect(7 - w, -5, 5, 5);
    c.fillStyle = '#d9532a'; c.beginPath(); c.ellipse(0, -11, 15, 8, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-14, -11); c.quadraticCurveTo(-26, -8, -28, -16 + Math.sin(this.animT * 5) * 3); c.lineTo(-14, -8); c.fill();
    c.fillStyle = '#e8723a'; c.beginPath(); c.ellipse(13, coughing ? -6 : -14, 8, 6, 0, 0, TAU); c.fill();
    c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(15, coughing ? -8 : -16, 2.2, 0, TAU); c.fill();
    c.fillStyle = '#7a1a0a'; for (let i = 0; i < 3; i++) c.fillRect(-8 + i * 7, -19, 3, 4);
    if (this.state === 'spit' && this.st < 0.3) { c.fillStyle = `rgba(255,150,50,${this.st * 3})`; c.beginPath(); c.arc(22, -12, 5 + this.st * 12, 0, TAU); c.fill(); }
  }
}

export class Golem extends Enemy {
  static def = { name: 'Gólem', hp: 160, coins: [10, 16], w: 46, h: 58, contact: 0, color: '#8a6a50', heavy: true, fire: true };
  init() { this.aura = false; this.dying = 0; this.fuse = 0; this.petrified = false; }
  contactRect() {
    if (!this.aura || this.dying > 0) return null;
    return { x: this.cx - 66, y: this.cy - 66, w: 132, h: 132 };
  }
  get contactDmg() { return 25; }
  ai(g, dt) {
    const T = this.tgt(g);
    if (this.dying > 0) {
      this.fuse -= dt;
      this.vx = 0;
      this.physics(g, dt);
      if (this.fuse <= 0) this.explode(g);
      return;
    }
    const d = Math.hypot(T.x - this.cx, T.y - this.cy);
    if (this.seesPlayer(g, 380)) { if (!this.aura) { this.aura = true; g.fx.text(this.cx, this.y - 8, '¡!', '#ff8a2a', 0.6, 16); } }
    else if (d > 520) this.aura = false;
    this.contact = this.aura ? 25 : 0;
    if (this.aura) {
      this.face(T.x);
      this.accelX(this.facing * this.spd(28), 300, dt);
      if (this.onGround && (this.wallAhead(g) || !this.floorAhead(g))) this.vx = 0;
    } else patrolStep(this, g, dt, 14, 300);
    this.physics(g, dt);
  }
  preHit(g, info) {
    if (this.dying > 0) {
      if (info.kind === 'charged' && hasAmulet('water')) this.petrify(g);
      return { cancel: true };
    }
    return null;
  }
  kill(g, info) {
    if (this.dead || this.dying > 0) return;
    this.hp = 0;
    if (info && info.water) { this.petrify(g); return; }
    this.dying = 1; this.fuse = 2; // explota a los 2 s
    this.aura = false;
    g.fx.text(this.cx, this.y - 10, '¡va a explotar!', '#ff6a3a', 1.2, 13);
    audio.sfx('screech');
  }
  petrify(g) {
    if (this.dead) return;
    this.dying = 0; this.dead = true; this.petrified = true;
    this.respawnT = CONFIG.enemies.respawnTime;
    dropCoins(g, this);
    g.stats.kills++;
    g.fx.burst(this.cx, this.cy, 22, '#9aa0a8', 220, 0.6, 4, 300);
    g.fx.ring(this.cx, this.cy, 8, 70, 0.4, '#6fd0ff', 5);
    g.fx.text(this.cx, this.y - 10, '¡petrificado!', '#bfe9ff', 1.2, 13);
    audio.sfx('glass');
  }
  explode(g) {
    this.dying = 0; this.dead = true;
    this.respawnT = CONFIG.enemies.respawnTime;
    g.enemyBlast(this.cx, this.cy, 170, 45, { color: '#ff7a2a', kind: 'blast' });
    g.blast(this.cx, this.cy, 170, 45, { kind: 'explosion', knock: 400, radial: true, lift: 200 });
    g.fx.burst(this.cx, this.cy, 36, '#ff8a2a', 460, 0.8, 5, 200);
    g.fx.ring(this.cx, this.cy, 10, 170, 0.5, '#ff8a2a', 8);
    dropCoins(g, this);
    g.stats.kills++;
    g.shake(10, 0.5);
  }
  onRespawn() { this.petrified = false; this.dying = 0; this.aura = false; }
  drawDead(ctx, cam) {
    if (!this.petrified) return;
    const x = this.x + this.w / 2 - cam.x, y = this.y + this.h - cam.y;
    if (x < -80 || x > 1040) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, 1);
    this.paintBody(ctx, '#9aa0a8', '#7a8088', false);
    ctx.restore();
  }
  paint(c) {
    const red = this.dying > 0 && Math.floor(this.animT * 10) % 2 === 0;
    this.paintBody(c, red ? '#ff6a3a' : '#8a6a50', '#5a4030', this.aura || this.dying > 0);
    if (this.aura && !this.dying) { // aura de fuego
      c.fillStyle = 'rgba(255,120,40,0.16)'; c.beginPath(); c.arc(0, -29, 66, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,150,60,0.6)'; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.arc(0, -29, 66 + Math.sin(this.animT * 4) * 3, 0, TAU); c.stroke(); c.setLineDash([]);
    }
  }
  paintBody(c, col, dark, lit) {
    const w = Math.abs(this.vx) > 5 ? Math.sin(this.animT * 4) * 3 : 0;
    c.fillStyle = dark; c.fillRect(-18 + w, -14, 14, 14); c.fillRect(4 - w, -14, 14, 14);
    c.fillStyle = col; c.beginPath(); c.roundRect(-22, -48, 44, 38, 8); c.fill();
    c.beginPath(); c.roundRect(-12, -62, 24, 18, 5); c.fill();
    c.fillRect(-32, -46, 12, 30); c.fillRect(20, -46, 12, 30);
    c.fillStyle = dark; c.fillRect(-14, -30, 28, 3); c.fillRect(-6, -40, 3, 14); c.fillRect(8, -44, 3, 10);
    c.fillStyle = lit ? '#ffd25a' : '#554'; c.fillRect(3, -56, 6, 4); c.fillRect(-8, -56, 5, 4);
    if (lit) { c.fillStyle = 'rgba(255,120,40,0.8)'; c.fillRect(-8, -36, 16, 4); }
  }
}

export class FireHyena extends Enemy {
  static def = { name: 'Hiena de fuego', hp: 55, coins: [5, 9], w: 40, h: 26, contact: 10, color: '#c46a2a', fire: true };
  init() { this.chargeCd = 2; this.swipeCd = 0; this.jumpCd = 0; }
  ai(g, dt) {
    const T = this.tgt(g);
    const dx = T.x - this.cx, ady = Math.abs(T.y - this.cy), dist = Math.hypot(dx, T.y - this.cy);
    this.chargeCd -= dt; this.swipeCd -= dt; this.jumpCd -= dt;
    if (this.atk) {
      this.updateAtk(g, dt);
      if (this.atk && this.atk.kind === 'charge') { this.vx = this.facing * (this.atk.t > this.atk.windup ? this.spd(540) : 0); }
      else this.vx *= 0.85;
      this.physics(g, dt);
      return;
    }
    const sees = T.fairy || this.seesPlayer(g, 430);
    if (!sees) { patrolStep(this, g, dt, 60); return; }
    this.face(T.x);
    this.accelX(this.facing * this.spd(230), 1800, dt);
    if (this.onGround && this.jumpCd <= 0 && (this.wallAhead(g) || (T.y < this.cy - 60 && Math.abs(dx) < 150))) { this.vy = -640; this.jumpCd = 1; }
    if (this.onGround && Math.abs(dx) < 56 && ady < 50 && this.swipeCd <= 0) {
      this.swipeCd = 1.1; this.vx = 0;
      this.startAtk({ windup: 0.25, active: 0.12, recover: 0.2, dmg: 14, reach: 52, h: 34, parry: true, kind: 'swipe' });
    } else if (this.onGround && this.chargeCd <= 0 && Math.abs(dx) > 130 && Math.abs(dx) < 340 && ady < 50) {
      this.chargeCd = 3.4; this.vx = 0;
      this.startAtk({ windup: 0.45, active: 0.45, recover: 0.3, dmg: 20, reach: 36, h: 28, parry: false, kind: 'charge', lunge: 0 });
    }
    this.physics(g, dt);
  }
  onAtkEnd() { this.vx = 0; }
  paint(c) {
    const run = Math.abs(this.vx) > 20;
    const s = run ? Math.sin(this.animT * 20) * 5 : 0;
    const charging = this.atk && this.atk.kind === 'charge';
    c.fillStyle = '#7a3a1a'; c.fillRect(-16 + s, -6, 5, 6); c.fillRect(-6 - s, -6, 5, 6); c.fillRect(6 + s, -6, 5, 6); c.fillRect(14 - s, -6, 5, 6);
    c.fillStyle = '#c46a2a'; c.beginPath(); c.ellipse(-2, -14, 20, 9, 0, 0, TAU); c.fill();
    c.fillStyle = '#e8903a'; c.beginPath(); c.ellipse(17, -17, 9, 7, -0.2, 0, TAU); c.fill();
    c.fillStyle = '#3a1a0a'; c.beginPath(); c.moveTo(16, -24); c.lineTo(20, -30); c.lineTo(22, -22); c.fill();
    c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(19, -19, 2, 0, TAU); c.fill();
    c.fillStyle = '#7a3a1a'; for (let i = 0; i < 4; i++) c.fillRect(-14 + i * 7, -23, 3, 5);
    c.fillStyle = '#fff'; c.fillRect(22, -14, 2, 3);
    if (charging) { // envuelta en fuego
      c.fillStyle = `rgba(255,${100 + Math.random() * 80},30,0.6)`;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-20 + i * 8 + rrange(-3, 3), -16 + rrange(-8, 8), 6 + rrange(0, 4), 0, TAU); c.fill(); }
    }
    if (this.atk && this.atk.kind === 'swipe' && this.atkProgress() < 1) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(24, -18, 12, -1, 0.5 + this.atkProgress()); c.stroke(); }
  }
}
