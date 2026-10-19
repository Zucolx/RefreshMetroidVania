// Enemigos del castillo: Murciélago, Fantasma y Armadura viviente.
import { Enemy } from './base.js';
import { moveBody } from '../physics.js';
import { ARMOR_SAFE } from '../combat.js';
import { CONFIG } from '../config.js';
import { TAU, chance, clamp, sign } from '../util.js';
import { audio } from '../audio.js';

export class Bat extends Enemy {
  static def = { name: 'Murciélago', hp: 15, coins: [2, 4], w: 24, h: 14, contact: 8, color: '#5a4a7a', hang: true, flies: true };
  init() { this.perch = { x: this.x, y: this.y }; this.rest = 0; this.sw = null; }
  ai(g, dt) {
    const p = g.player;
    if (this.state === 'swoop') {
      const s = this.sw;
      s.u += dt / 1.3;
      const u = Math.min(1, s.u);
      this.x = s.x0 + s.dx * (1 - Math.cos(Math.PI * u)) - this.w / 2 + this.w / 2;
      this.y = s.y0 + s.ry * Math.sin(Math.PI * u);
      this.facing = sign(s.dx) || 1;
      if (!s.screeched && u >= 0.5) {
        s.screeched = true;
        this.shoot(g, { x: this.cx, y: this.cy + 6, vx: 0, vy: 0, r: 46, dmg: 10, life: 0.28, color: '#c9b0ff', shape: 'shout', kind: 'enemy', sonic: true, noWorld: true, shieldKill: true });
        audio.sfx('screech');
      }
      if (u >= 1) { this.setState('rest'); this.rest = 1.8; }
      return;
    }
    if (this.state === 'rest') {
      this.rest -= dt;
      // vuelve al techo
      this.x += (this.perch.x - this.x) * Math.min(1, dt * 3.5); this.y += (this.perch.y - this.y) * Math.min(1, dt * 3.5);
      if (this.rest <= 0) this.setState('perch');
      return;
    }
    this.x = this.perch.x; this.y = this.perch.y;
    // ¿pasa el jugador por debajo? (~360 px en horizontal con visión)
    const dx = p.cx - this.cx;
    if (!p.hidden && Math.abs(dx) < 360 && p.cy > this.cy + 30 && p.cy - this.cy < 420 && g.world.los(this.cx, this.cy, p.cx, p.cy)) {
      const dxp = Math.abs(dx) < 70 ? (sign(dx) || 1) * 70 : dx;
      const ry = clamp(p.y - 36 - this.y, 36, 240);
      this.sw = { u: 0, x0: this.cx, y0: this.y, dx: dxp, ry, screeched: false };
      this.setState('swoop');
      audio.sfx('screech');
    }
  }
  paint(c) {
    const swoop = this.state === 'swoop';
    const fl = swoop ? Math.sin(this.animT * 30) : this.state === 'rest' ? Math.sin(this.animT * 16) * 0.6 : 0;
    const y0 = swoop || this.state === 'rest' ? -8 : -this.h + 4;
    c.fillStyle = '#4a3a66';
    c.beginPath(); c.moveTo(0, y0); c.quadraticCurveTo(-14, y0 - 8 - fl * 8, -20, y0 + 2); c.quadraticCurveTo(-12, y0 + 2, -8, y0 + 6); c.fill();
    c.beginPath(); c.moveTo(0, y0); c.quadraticCurveTo(14, y0 - 8 - fl * 8, 20, y0 + 2); c.quadraticCurveTo(12, y0 + 2, 8, y0 + 6); c.fill();
    c.fillStyle = '#6a5a8a'; c.beginPath(); c.ellipse(0, y0 + 3, 5, 6.5, 0, 0, TAU); c.fill();
    c.fillStyle = '#ff5a5a'; c.fillRect(1, y0, 2, 2); c.fillRect(-3, y0, 2, 2);
    c.fillStyle = '#e8e0f0'; c.fillRect(-2, y0 + 5, 1.4, 2.6); c.fillRect(1, y0 + 5, 1.4, 2.6);
    c.fillStyle = '#6a5a8a'; c.beginPath(); c.moveTo(-4, y0 - 2); c.lineTo(-3, y0 - 8); c.lineTo(-1, y0 - 2); c.moveTo(1, y0 - 2); c.lineTo(3, y0 - 8); c.lineTo(4, y0 - 2); c.fill();
  }
}

export class Ghost extends Enemy {
  static def = { name: 'Fantasma', hp: 30, coins: [6, 10], w: 24, h: 34, contact: 12, color: '#c8d0ff', flies: true, ghost: true };
  init() { this.mist = 0; this.form = 0; this.lookedAt = false; this.chargeT = 0; this.baseContact = 12; this.setState('sleep'); this.hideBar = true; }
  get harmless() { return this.state === 'sleep' || this.state === 'fog' || this.state === 'forming'; }
  set harmless(v) {}
  ai(g, dt) {
    const p = g.player;
    const dx = p.cx - this.cx, dy = p.cy - this.cy, d = Math.hypot(dx, dy);
    const looking = Math.sign(this.cx - p.cx) === p.facing; // el jugador mira al fantasma
    this.facing = dx >= 0 ? 1 : -1;
    if (this.state === 'sleep') {
      this.vx *= 0.9; this.vy = Math.sin(this.animT * 1.5) * 8;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (d < 340 && Math.abs(dy) < 240 && !p.hidden) { this.setState('fog'); g.fx.text(this.cx, this.y - 8, '…', '#c8d0ff', 0.8, 16); }
      return;
    }
    if (d > 700) { this.setState('sleep'); return; }
    if (this.state === 'fog') {
      // mientras lo miras es niebla: apenas se mueve
      this.vx *= 0.9; this.vy *= 0.9;
      this.x += (dx * 0.05) * dt; this.y += (dy * 0.05) * dt;
      if (!looking) { this.setState('forming'); }
      return;
    }
    if (this.state === 'forming') {
      if (looking) { this.setState('fog'); return; }
      if (this.st >= 1) this.setState('chase');
      return;
    }
    if (this.state === 'chase') {
      if (looking) {
        // al girarte vuelve a niebla, salvo un 30 % que embiste
        if (chance(0.3)) { this.setState('charge'); this.chargeDir = Math.atan2(dy, dx); }
        else this.setState('fog');
        return;
      }
      const away = sign(p.vx) === sign(this.cx - p.cx) * -1 * -1 ? false : false;
      void away;
      const fleeing = Math.abs(p.vx) > CONFIG.runSpeed * 1.2 && sign(p.vx) === sign(p.cx - this.cx);
      const spd = fleeing ? Math.abs(p.vx) * 1.15 : CONFIG.runSpeed * 0.8;
      const a = Math.atan2(dy, dx);
      this.vx = Math.cos(a) * spd * CONFIG.enemies.speedMul; this.vy = Math.sin(a) * spd * CONFIG.enemies.speedMul;
      this.x += this.vx * dt; this.y += this.vy * dt;
      return;
    }
    if (this.state === 'charge') {
      this.vx = Math.cos(this.chargeDir) * 520; this.vy = Math.sin(this.chargeDir) * 520;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.st > 0.5) this.setState('chase');
    }
  }
  // el daño del embestir es 20; el de contacto normal, 12
  get contactMul() { return this.state === 'charge' ? 20 / 12 : 1; }
  paint(c) {
    const a = this.state === 'sleep' ? 0.3 : this.state === 'fog' ? 0.38 : this.state === 'forming' ? 0.38 + Math.min(1, this.st) * 0.5 : 0.9;
    c.globalAlpha = a;
    const w = Math.sin(this.animT * 4) * 2;
    c.fillStyle = this.state === 'fog' ? '#aab4e8' : '#dfe6ff';
    c.beginPath(); c.arc(0, -24, 11, Math.PI, 0);
    c.lineTo(11, -4 + w); c.lineTo(6, -9); c.lineTo(2, -2 + w); c.lineTo(-3, -9); c.lineTo(-7, -2 - w); c.lineTo(-11, -6); c.closePath(); c.fill();
    c.fillStyle = '#1a1a3a';
    if (this.state === 'sleep') { c.fillRect(-4, -23, 4, 1.6); c.fillRect(2, -23, 4, 1.6); c.fillStyle = '#c8d0ff'; c.font = 'bold 10px system-ui'; c.fillText('z', 8, -34 - Math.sin(this.animT * 2) * 3); }
    else { c.beginPath(); c.ellipse(-3, -24, 2.2, 3.2, 0, 0, TAU); c.ellipse(5, -24, 2.2, 3.2, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(1, -16, 2.6, 3.4, 0, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
  }
}

export class Armor extends Enemy {
  static def = { name: 'Armadura viviente', hp: 140, coins: [12, 20], w: 40, h: 66, contact: 12, color: '#7a7e92', heavy: true };
  init() { this.counterCd = 0; this.cover = 0; this.inJump = false; this.jumpCd = 3; this.stabCd = 0; this.counterAtk = false; this.setState('dormant'); }
  get harmless() { return this.state === 'dormant'; }
  set harmless(v) {}
  ai(g, dt) {
    const T = this.tgt(g);
    const dx = T.x - this.cx, ady = Math.abs(T.y - this.cy), dist = Math.hypot(dx, T.y - this.cy);
    this.counterCd -= dt; this.stabCd -= dt; this.jumpCd -= dt;
    if (this.cover > 0) { this.cover -= dt; this.vx *= 0.8; this.physics(g, dt); if (this.cover <= 0) this.respondCounter(g); return; }
    if (this.state === 'dormant') {
      if (dist < 430 && (T.fairy || g.world.los(this.cx, this.cy, T.x, T.y))) { this.setState('awake'); g.fx.burst(this.cx, this.cy - 30, 10, '#9aa0b8', 160, 0.5, 3, 0); audio.sfx('hit'); }
      this.physics(g, dt);
      return;
    }
    if (this.state === 'jump') {
      this.inJump = true;
      this.physics(g, dt);
      if (this.onGround && this.st > 0.2) {
        this.inJump = false; this.vx = 0;
        g.enemyBlast(this.cx, this.y + this.h - 6, 80, 32, { color: '#c9ccd6', kind: 'blast' });
        this.setState('awake'); this.jumpCd = 4;
      }
      return;
    }
    if (this.state === 'windjump') { // salto cargado
      this.vx = 0; this.physics(g, dt);
      if (this.st > 0.6) { this.setState('jump'); this.vy = -720; this.vx = Math.sign(dx || this.facing) * 280; }
      return;
    }
    if (this.atk) { this.updateAtk(g, dt); this.vx *= 0.8; this.physics(g, dt); return; }
    this.face(T.x);
    if (dist > 740 && !T.fairy) { this.setState('dormant'); return; }
    const near = Math.abs(dx) < 64 && ady < 60;
    this.accelX(near ? 0 : this.facing * this.spd(85), 500, dt);
    if (this.onGround && (this.wallAhead(g) || !this.floorAhead(g))) this.vx = 0;
    if (near && this.stabCd <= 0) { this.stabCd = 1.5; this.startAtk({ windup: 0.45, active: 0.14, recover: 0.3, dmg: 18, reach: 66, h: 40, parry: true, kind: 'stab' }); }
    else if (this.jumpCd <= 0 && Math.abs(dx) > 120 && Math.abs(dx) < 340 && this.onGround) { this.setState('windjump'); }
    this.physics(g, dt);
  }
  /** Contraataque: 60 %, enfriamiento 0,8 s; no durante su salto. */
  preHit(g, info) {
    if (this.state === 'dormant') this.setState('awake');
    if (this.inJump || this.state === 'windjump' || this.state === 'jump') return null;
    if (ARMOR_SAFE.has(info.kind) || this.counterCd > 0 || !chance(0.6)) return null;
    this.counterCd = 0.8;
    if (info.proj && !info.proj.dead) info.proj.die(g, true);
    this.cover = 0.3;
    this.cancelAttack();
    this.vx = 0;
    g.fx.ring(this.cx, this.cy - 10, 6, 44, 0.3, '#ffffff', 4);
    g.fx.burst(this.cx, this.cy - 10, 8, '#e8eaf2', 220, 0.3, 3, 0);
    g.fx.text(this.cx, this.y - 8, '¡contra!', '#ffffff', 0.6, 12);
    audio.sfx('parry');
    return { cancel: true, countered: true };
  }
  respondCounter(g) {
    this.face(g.player.cx);
    this.startAtk({ windup: 0.05, active: 0.12, recover: 0.2, dmg: 14, reach: 62, h: 44, parry: false, kind: 'counter' });
    this.shoot(g, { x: this.cx + this.facing * 24, y: this.cy - 6, vx: this.facing * 420, vy: 0, r: 16, dmg: 14, life: 1.1, color: '#ff4a4a', shape: 'crescent', kind: 'enemy', shieldKill: true });
    audio.sfx('slash');
  }
  paint(c) {
    const dorm = this.state === 'dormant';
    const w = Math.abs(this.vx) > 5 ? Math.sin(this.animT * 6) * 3 : 0;
    const cov = this.cover > 0;
    c.fillStyle = '#5a5e72'; c.fillRect(-14 + w, -20, 11, 20); c.fillRect(3 - w, -20, 11, 20);
    c.fillStyle = '#7a7e92'; c.beginPath(); c.roundRect(-16, -50, 32, 32, 6); c.fill();
    c.fillStyle = '#9a9eb4'; c.fillRect(-16, -50, 32, 5); c.fillRect(-18, -46, 6, 12); c.fillRect(12, -46, 6, 12);
    c.fillStyle = '#7a7e92'; c.beginPath(); c.roundRect(-9, -66, 18, 18, 5); c.fill();
    c.fillStyle = dorm ? '#222' : '#ff5a3a'; c.fillRect(-1, -60, 9, 3);
    c.fillStyle = '#c9a34a'; c.fillRect(-1.5, -72, 3, 7);
    // espada / escudo
    const a = this.atk;
    const ang = cov ? -1.4 : a ? (a.t < a.windup ? -0.6 - (a.t / a.windup) * 1.2 : -1.8 + ((a.t - a.windup) / 0.14) * 2.6) : 0.2;
    c.save(); c.translate(12, -40); c.rotate(ang);
    c.fillStyle = '#e8eef7'; c.fillRect(0, -2, 44, 4); c.fillStyle = '#c9a34a'; c.fillRect(-4, -5, 4, 10);
    c.restore();
    if (cov) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(8, -40, 26, -1.2, 1.2); c.stroke(); }
    if (this.state === 'windjump') { c.fillStyle = 'rgba(255,150,80,0.5)'; c.beginPath(); c.arc(0, 0, 16 + this.st * 20, Math.PI, 0); c.fill(); }
  }
}
void moveBody;
