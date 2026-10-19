// Proyectiles de jugador y enemigos. Un único tipo con ganchos (onUpdate/onHitEnemy/onWorld…) cubre todos los casos.
import { CONFIG } from './config.js';
import { circleRect, TAU } from './util.js';
import { sprites } from './render/hybrid.js';

let UID = 1;

export class Projectile {
  constructor(o) {
    Object.assign(this, {
      x: 0, y: 0, vx: 0, vy: 0, r: 6, team: 'player', kind: 'bolt', dmg: 1, life: 2, grav: 0,
      pierce: 0, bounce: 0, owner: null, color: '#fff', shape: 'orb', rot: 0, spin: 0,
      cut: false, reflect: false, shieldKill: true, unblockable: false, sonic: false, magic: false,
      noWorld: false, dead: false, age: 0, knock: 200, stun: 0, mana: 0, info: null, melee: false,
    }, o);
    this.id = UID++;
    this.hit = new Set();
    this.hits = 0;
  }

  die(g, silent) {
    if (this.dead) return;
    this.dead = true;
    if (this.onDie) this.onDie(g, silent);
  }

  update(g, dt) {
    const k = this.ts ?? 1; // burbuja de tiempo / estasis
    this.ts = 1;
    dt *= k;
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) { this.die(g, true); return; }
    if (this.onUpdate && this.onUpdate(g, dt) === false) return;
    this.vy += this.grav * dt;
    this.rot += this.spin * dt;
    const dx = this.vx * dt, dy = this.vy * dt;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    for (let i = 0; i < n; i++) {
      this.x += dx / n; this.y += dy / n;
      if (!this.noWorld && g.world.solidAtPx(this.x, this.y)) {
        // reboto contra la pared si queda alguno
        if (this.bounce > 0) {
          this.x -= dx / n; this.y -= dy / n;
          const sx = g.world.solidAtPx(this.x + Math.sign(dx) * (Math.abs(dx) / n + 2), this.y);
          const sy = g.world.solidAtPx(this.x, this.y + Math.sign(dy) * (Math.abs(dy) / n + 2));
          if (sx || !sy) this.vx = -this.vx * (this.bounceK || 1);
          if (sy || !sx) this.vy = -this.vy * (this.bounceK || 1);
          this.bounce--;
          this.hit.clear();
          if (this.onBounce) this.onBounce(g);
          break;
        }
        if (this.onWorld) this.onWorld(g);
        this.die(g);
        return;
      }
      if (this.team === 'player') {
        if (this.checkEnemies(g)) return;
      } else if (this.checkPlayer(g)) return;
    }
    if (this.x < -200 || this.y < -400 || this.x > g.world.pxW + 200 || this.y > g.world.pxH + 200) this.die(g, true);
  }

  checkEnemies(g) {
    for (const e of g.enemies) {
      if (e.dead || e.untargetable || this.hit.has(e)) continue;
      if (!circleRect(this.x, this.y, this.r, e.hitRect ? e.hitRect() : e)) continue;
      this.hit.add(e);
      const info = this.info || {
        kind: this.kind, dmg: this.dmg, magic: this.magic, melee: this.melee, knock: this.knock,
        dir: Math.sign(this.vx) || 1, stun: this.stun, mana: this.mana, from: { x: this.x, y: this.y }, proj: this, src: this.owner,
      };
      info.proj = this;
      info.from = { x: this.x, y: this.y };
      const res = g.damageEnemy(e, this.dmg, info);
      if (this.onHitEnemy) this.onHitEnemy(g, e, res);
      if (res && res.passThrough) continue;
      this.hits++;
      if (this.pierce >= 0 && this.hits > this.pierce && !this.dead) { this.die(g); return true; }
      if (this.dead) return true;
    }
    return false;
  }

  checkPlayer(g) {
    const p = g.player;
    const f = g.fairy;
    if (f && f.alive && Math.hypot(this.x - f.x, this.y - f.y) < this.r + 12) {
      f.hit(g, this.dmg * CONFIG.enemies.damageMul);
      this.die(g);
      return true;
    }
    if (p.hidden) return false;
    // zona de escudo mágico / escudo estelar se resuelven en el jugador antes del daño
    if (circleRect(this.x, this.y, this.r, p.hurtBox())) {
      if (this.onPlayer && this.onPlayer(g) === false) return false;
      const out = g.hurtPlayer(this.dmg * CONFIG.enemies.damageMul, { x: this.x - this.vx * 0.01, y: this.y, kind: 'projectile', proj: this, stun: this.stun, web: this.web });
      if (out !== 'passed') { this.die(g); return true; }
    }
    return false;
  }

  /** Invierte el proyectil para el jugador (escudo mágico ×2 / escudo estelar). */
  reflectBack(g, mul = 2) {
    this.team = 'player';
    this.vx = -this.vx * mul; this.vy = -this.vy * mul;
    this.dmg *= mul; this.life = Math.max(this.life, 1.5);
    this.hit.clear(); this.hits = 0;
    this.kind = 'reflected';
    this.reflected = true;
    if (this.onReflect) this.onReflect(g);
  }

  draw(ctx, cam, t) {
    if (this.dead) return;
    const x = this.x - cam.x, y = this.y - cam.y;
    if (x < -80 || x > 1040 || y < -80 || y > 620) return;
    const ang = this.shape === 'crescent' || this.shape === 'bolt' || this.shape === 'bullet' || this.shape === 'flame' ? Math.atan2(this.vy, this.vx) : this.rot;
    sprites.slot(ctx, 'fx', 'proj_' + this.shape, null, this.age, { x, y, rot: ang }, (c) => drawShape(c, this, t));
    if (CONFIG.debug.hitboxes) {
      ctx.strokeStyle = this.team === 'player' ? '#3f3' : '#f33'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, this.r, 0, TAU); ctx.stroke();
    }
  }
}

function glow(c, r, color, a = 0.35) {
  c.globalAlpha = a; c.fillStyle = color;
  c.beginPath(); c.arc(0, 0, r * 1.9, 0, TAU); c.fill();
  c.globalAlpha = 1;
}

function drawShape(c, p, t) {
  const r = p.r;
  switch (p.shape) {
    case 'orb':
      glow(c, r, p.color);
      c.fillStyle = p.color; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-r * 0.25, -r * 0.25, r * 0.4, 0, TAU); c.fill();
      break;
    case 'bolt': // proyectil mágico alargado
      glow(c, r, p.color, 0.3);
      c.fillStyle = p.color;
      c.beginPath(); c.ellipse(0, 0, r * 1.6, r * 0.9, 0, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(r * 0.3, 0, r * 0.8, r * 0.4, 0, 0, TAU); c.fill();
      break;
    case 'crescent': // media luna
      c.strokeStyle = p.color; c.lineWidth = r * 0.7; c.lineCap = 'round';
      c.beginPath(); c.arc(-r * 0.6, 0, r * 1.3, -1.1, 1.1); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = r * 0.25;
      c.beginPath(); c.arc(-r * 0.6, 0, r * 1.3, -1.0, 1.0); c.stroke();
      break;
    case 'berry':
      c.fillStyle = p.color; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, TAU); c.fill();
      c.fillStyle = '#3a7a2c'; c.fillRect(-1, -r - 3, 2, 4);
      break;
    case 'rock':
      c.fillStyle = '#7d7468'; c.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, rr = r * (0.8 + ((i * 37) % 5) / 14); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-r * 0.3, 0, r * 0.7, r * 0.3);
      break;
    case 'flame':
      glow(c, r, '#ff8a2a', 0.35);
      c.fillStyle = '#ff6a1a'; c.beginPath(); c.ellipse(0, 0, r * 1.5, r, 0, 0, TAU); c.fill();
      c.fillStyle = '#ffd25a'; c.beginPath(); c.ellipse(r * 0.2, 0, r * 0.8, r * 0.55, 0, 0, TAU); c.fill();
      break;
    case 'smoke':
      c.fillStyle = 'rgba(90,90,90,0.7)'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.fillStyle = 'rgba(140,140,140,0.5)'; c.beginPath(); c.arc(r * 0.3, -r * 0.2, r * 0.7, 0, TAU); c.fill();
      break;
    case 'net':
      c.strokeStyle = 'rgba(240,240,240,0.9)'; c.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI; c.beginPath(); c.moveTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(-Math.cos(a) * r, -Math.sin(a) * r); c.stroke(); }
      c.beginPath(); c.arc(0, 0, r * 0.5, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
      break;
    case 'egg':
      c.fillStyle = '#e8e2c0'; c.beginPath(); c.ellipse(0, 0, r * 0.8, r, 0, 0, TAU); c.fill();
      c.fillStyle = '#8fbf6a'; c.beginPath(); c.arc(-r * 0.2, r * 0.2, r * 0.25, 0, TAU); c.fill();
      break;
    case 'wave': { // onda sónica
      const col = p.color;
      c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round';
      const dir = Math.sign(p.vx) || 1;
      for (let i = 0; i < 3; i++) { c.globalAlpha = 1 - i * 0.28; c.beginPath(); c.arc(-dir * i * 6, 0, r * (0.6 + i * 0.3), -0.9 + (dir < 0 ? Math.PI : 0), 0.9 + (dir < 0 ? Math.PI : 0)); c.stroke(); }
      c.globalAlpha = 1;
      break; }
    case 'ja':
      c.font = 'bold 16px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ffe27a'; c.strokeStyle = '#6b2a3a'; c.lineWidth = 3;
      c.strokeText('JA', 0, 0); c.fillText('JA', 0, 0);
      break;
    case 'shout': // chillido
      c.strokeStyle = p.color; c.lineWidth = 3;
      for (let i = 0; i < 3; i++) { c.globalAlpha = 0.9 - i * 0.25; c.beginPath(); c.arc(0, 0, r * (0.5 + i * 0.5), 0, TAU); c.stroke(); }
      c.globalAlpha = 1;
      break;
    case 'star':
      glow(c, r, p.color, 0.3);
      c.fillStyle = p.color; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.45 : r * 1.1; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.fill();
      break;
    case 'bullet':
      c.fillStyle = p.color; c.beginPath(); c.ellipse(0, 0, r * 1.3, r * 0.8, 0, 0, TAU); c.fill();
      break;
    case 'flask':
      c.fillStyle = p.color; c.beginPath(); c.arc(0, 2, r, 0, TAU); c.fill();
      c.fillStyle = '#cfe9f5'; c.fillRect(-2, -r - 2, 4, 6);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(-r * 0.3, 0, r * 0.3, 0, TAU); c.fill();
      break;
    case 'butterfly': {
      const fl = Math.sin(p.age * 30) * 0.6;
      c.fillStyle = p.color;
      c.save(); c.scale(1, 0.4 + Math.abs(fl)); c.beginPath(); c.ellipse(-3, -3, 5, 4, 0, 0, TAU); c.ellipse(-3, 3, 5, 4, 0, 0, TAU); c.fill(); c.restore();
      c.fillStyle = '#fff'; c.fillRect(-1, -1, 4, 2);
      break; }
    case 'shield':
      c.rotate(p.age * 14);
      c.fillStyle = '#9ec8ff'; c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, rr = i % 2 ? r * 0.55 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.fill(); c.stroke();
      break;
    case 'bomb':
      c.fillStyle = '#222'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.fillStyle = (Math.floor(p.age * 12) % 2) ? '#ff5a2a' : '#ffd25a'; c.fillRect(-1.5, -r - 5, 3, 5);
      break;
    case 'needle':
      c.strokeStyle = '#e8d9a0'; c.lineWidth = 3; c.beginPath(); c.moveTo(-r * 2, 0); c.lineTo(r * 2, 0); c.stroke();
      c.fillStyle = '#e8d9a0'; c.beginPath(); c.moveTo(r * 2, 0); c.lineTo(r * 1.2, -3); c.lineTo(r * 1.2, 3); c.fill();
      break;
    case 'fireball':
      glow(c, r, '#ff7a2a', 0.45);
      c.fillStyle = '#ff7a2a'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(0, 0, r * 0.55, 0, TAU); c.fill();
      break;
    default:
      c.fillStyle = p.color; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  }
}
