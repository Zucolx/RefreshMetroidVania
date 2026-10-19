// Enemigos del laboratorio: Patrullero, Perseguidor y Tirador.
import { Enemy } from './base.js';
import { CONFIG } from '../config.js';
import { TAU, chance, clamp } from '../util.js';
import { audio } from '../audio.js';

/** Camina hacia/lejos de un punto y gira en bordes y paredes. */
export function patrolStep(e, g, dt, speed, accel = 900) {
  if (e.onGround && (e.wallAhead(g) || !e.floorAhead(g))) { e.facing = -e.facing; e.vx = 0; }
  e.accelX(e.facing * e.spd(speed), accel, dt);
  e.physics(g, dt);
}

export class Patrol extends Enemy {
  static def = { name: 'Patrullero', hp: 30, coins: [1, 3], w: 28, h: 26, contact: 10, color: '#6fb8c9' };
  ai(g, dt) {
    const T = this.tgt(g);
    if (T.fairy) {
      this.face(T.x);
      this.accelX(this.facing * this.spd(90), 1200, dt);
      this.physics(g, dt);
      return;
    }
    patrolStep(this, g, dt, 70);
  }
  paint(c, t) {
    const bob = Math.sin(this.animT * 8) * 1.2;
    c.fillStyle = '#2b3a4a'; c.fillRect(-12, -6, 24, 6);
    c.fillStyle = '#6fb8c9'; c.beginPath(); c.roundRect(-13, -24 + bob, 26, 20, 6); c.fill();
    c.fillStyle = '#4a8a9a'; c.fillRect(-13, -12 + bob, 26, 3);
    c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(6, -16 + bob, 4, 0, TAU); c.fill();
    c.fillStyle = '#222'; c.beginPath(); c.arc(7, -16 + bob, 1.8, 0, TAU); c.fill();
    c.strokeStyle = '#8a9aa8'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-4, -24 + bob); c.lineTo(-6, -31 + bob); c.stroke();
    c.fillStyle = '#ff5a5a'; c.beginPath(); c.arc(-6, -32 + bob, 2, 0, TAU); c.fill();
    c.fillStyle = '#1a2230'; const w = Math.sin(this.animT * 10) * 3;
    c.beginPath(); c.arc(-7 + w, -2, 3.4, 0, TAU); c.arc(7 - w, -2, 3.4, 0, TAU); c.fill();
  }
}

export class Chaser extends Enemy {
  static def = { name: 'Perseguidor', hp: 60, coins: [3, 6], w: 30, h: 30, contact: 15, color: '#d98a4a' };
  init() { this.cd = 0; this.setState('idle'); }
  ai(g, dt) {
    const T = this.tgt(g);
    const p = g.player;
    const dx = T.x - this.cx, dist = Math.hypot(dx, T.y - this.cy);
    this.cd -= dt;
    if (this.state === 'idle') {
      patrolStep(this, g, dt, 60);
      if (T.fairy || this.seesPlayer(g, 380)) this.setState('chase');
      return;
    }
    if (this.state === 'chase') {
      this.face(T.x);
      if (!T.fairy && dist > 650) { this.setState('idle'); return; }
      this.accelX(this.facing * this.spd(210), 1600, dt);
      if (this.onGround) {
        const higher = T.y < this.cy - 50 && Math.abs(dx) < 170;
        if ((this.wallAhead(g) || higher) && this.st > 0.15) { this.vy = -720; }
        else if (!this.floorAhead(g) && Math.abs(dx) > 40 && this.st > 0.15 && dist < 520) this.vy = -640;
        if (this.cd <= 0 && Math.abs(dx) < 210 && Math.abs(dx) > 70 && Math.abs(T.y - this.cy) < 60) { this.setState('windup'); this.vx = 0; }
      }
      this.physics(g, dt);
      return;
    }
    if (this.state === 'windup') { // se agacha antes de embestir
      this.vx *= 0.8;
      if (this.st > 0.3) this.setState('charge');
      this.physics(g, dt);
      return;
    }
    if (this.state === 'charge') {
      this.vx = this.facing * this.spd(480);
      if (this.st > 0.4 || this.wallAhead(g, this.facing, 6)) { this.cd = 1.4; this.setState('chase'); }
      this.physics(g, dt);
    }
    void p;
  }
  paint(c, t) {
    const run = Math.abs(this.vx) > 20;
    const crouch = this.state === 'windup' ? 6 : 0;
    const sw = run ? Math.sin(this.animT * 18) * 4 : 0;
    c.fillStyle = '#7a4a2a';
    c.fillRect(-12 + sw, -6, 6, 6); c.fillRect(6 - sw, -6, 6, 6);
    c.fillStyle = this.state === 'charge' ? '#ff6a3a' : '#d98a4a';
    c.beginPath(); c.roundRect(-14, -28 + crouch, 28, 24 - crouch * 0.4, 8); c.fill();
    c.fillStyle = '#8a4a1a'; c.beginPath(); c.moveTo(-12, -28 + crouch); c.lineTo(-6, -36 + crouch); c.lineTo(0, -28 + crouch); c.lineTo(6, -36 + crouch); c.lineTo(12, -28 + crouch); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(7, -19 + crouch, 4.5, 0, TAU); c.fill();
    c.fillStyle = '#a01818'; c.beginPath(); c.arc(8, -19 + crouch, 2.4, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(4, -9 + crouch); c.lineTo(7, -5 + crouch); c.lineTo(10, -9 + crouch); c.fill();
  }
}

export class Shooter extends Enemy {
  static def = { name: 'Tirador', hp: 40, coins: [3, 5], w: 26, h: 34, contact: 8, color: '#9a8ad9' };
  init() { this.shotT = 1 + Math.random(); this.dodged = new Set(); this.dodgeCd = 0; }
  ai(g, dt) {
    const T = this.tgt(g);
    const dx = T.x - this.cx, dist = Math.hypot(dx, T.y - this.cy);
    this.face(T.x);
    this.shotT -= dt; this.dodgeCd -= dt;
    // mantiene 260 px y huye si el jugador está a < 170
    let target = 0;
    if (dist < 170) target = -Math.sign(dx) * this.spd(150);
    else if (dist > 260 && dist < 600) target = Math.sign(dx) * this.spd(90);
    if (this.onGround && target && (this.wallAhead(g, Math.sign(target)) || !this.floorAhead(g, Math.sign(target)))) target = 0;
    this.accelX(target, 1000, dt);
    // esquiva el 60 % de los proyectiles saltando
    if (this.onGround && this.dodgeCd <= 0) {
      for (const pr of g.projectiles) {
        if (pr.team !== 'player' || pr.dead || this.dodged.has(pr.id)) continue;
        const rx = this.cx - pr.x, ry = this.cy - pr.y;
        if (Math.abs(rx) < 150 && Math.abs(ry) < 70 && rx * pr.vx > 0) {
          this.dodged.add(pr.id);
          if (chance(0.6)) { this.vy = -520; this.dodgeCd = 0.6; }
          break;
        }
      }
      if (this.dodged.size > 40) this.dodged.clear();
    }
    if (this.shotT <= 0 && dist < 560 && (T.fairy || this.seesPlayer(g, 560))) {
      this.shotT = 1.6;
      const a = Math.atan2(T.y - this.cy + 4, T.x - this.cx);
      this.shoot(g, { x: this.cx + this.facing * 16, y: this.cy - 4, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, r: 6, dmg: 12, life: 380 / 380 * 1.6, color: '#c8a8ff', shape: 'orb', kind: 'enemy', cut: true, reflect: true, shieldKill: true });
      audio.sfx('fire');
      this.recoil = 0.12;
    }
    if (this.recoil > 0) this.recoil -= dt;
    this.physics(g, dt);
  }
  paint(c, t) {
    const r = this.recoil > 0 ? -3 : 0;
    c.fillStyle = '#3a3060'; c.fillRect(-9, -8, 7, 8); c.fillRect(2, -8, 7, 8);
    c.fillStyle = '#9a8ad9'; c.beginPath(); c.roundRect(-11, -26, 22, 20, 6); c.fill();
    c.fillStyle = '#c8bff0'; c.beginPath(); c.arc(0, -31, 8, 0, TAU); c.fill();
    c.fillStyle = '#1a1230'; c.fillRect(1, -33, 7, 4);
    c.fillStyle = '#ffe27a'; c.fillRect(4, -32, 3, 2);
    // arma
    c.fillStyle = '#4a4a5a'; c.fillRect(6 + r, -22, 16, 5);
    c.fillStyle = '#c8a8ff'; c.beginPath(); c.arc(23 + r, -19.5, 3, 0, TAU); c.fill();
  }
}
void clamp; void CONFIG;
