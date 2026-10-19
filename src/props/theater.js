// Peligros dinámicos del teatro: trampillas, cortinas, focos, cuerdas y la noria.
import { TILE, CONFIG } from '../config.js';
import { TAU, clamp, hash2 } from '../util.js';
import { audio } from '../audio.js';

function bodiesOverlap(g, r) {
  const p = g.player;
  if (!p.hidden && r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y) return true;
  for (const e of g.enemies) {
    if (e.dead) continue;
    if (r.x < e.x + e.w && r.x + r.w > e.x && r.y < e.y + e.h && r.y + r.h > e.y) return true;
  }
  return false;
}

// ---------------------------------------------------------------------
/** Trampilla: cerrada 3,5 s → cruje 0,8 s → abierta 1,8 s. Nunca se cierra con alguien dentro. */
class Trapdoor {
  constructor(g, s) {
    this.s = s;
    this.rect = { x: s.x * TILE, y: s.y * TILE, w: (s.w || 2) * TILE, h: 12 };
    this.dyn = { ...this.rect, off: false, trap: true };
    g.world.dyn.push(this.dyn);
    this.state = 'closed';
    this.t = ((s.phase || 0) * 1.7) % 3.5;
    if (g.world.openTrapdoors) { this.state = 'open'; this.dyn.off = true; }
    this.frozen = !!g.world.openTrapdoors;
  }
  update(g, dt) {
    if (this.frozen) return;
    this.t += dt;
    if (this.state === 'closed' && this.t >= 3.5) { this.state = 'creak'; this.t = 0; audio.sfx('tick'); }
    else if (this.state === 'creak' && this.t >= 0.8) { this.state = 'open'; this.t = 0; this.dyn.off = true; g.fx.burst(this.rect.x + this.rect.w / 2, this.rect.y, 10, '#8a6a3c', 120, 0.5, 3, 200); audio.sfx('hit'); }
    else if (this.state === 'open' && this.t >= 1.8) {
      // no se cierra con nadie dentro
      const zone = { x: this.rect.x, y: this.rect.y - 4, w: this.rect.w, h: this.rect.h + 40 };
      if (!bodiesOverlap(g, zone)) { this.state = 'closed'; this.t = 0; this.dyn.off = false; audio.sfx('tick'); }
      else this.t = 1.7;
    }
  }
  draw(ctx, cam, t, layer) {
    if (layer !== 'back') return;
    const r = this.rect;
    const x = r.x - cam.x, y = r.y - cam.y;
    if (x < -r.w - 20 || x > 1000) return;
    ctx.save(); ctx.translate(x, y);
    if (this.state === 'open') { // dos hojas colgando
      ctx.fillStyle = '#4a3220';
      ctx.fillRect(0, 0, 8, r.h + 14); ctx.fillRect(r.w - 8, 0, 8, r.h + 14);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(8, 0, r.w - 16, r.h);
    } else {
      const shake = this.state === 'creak' ? Math.sin(this.t * 70) * 1.4 : 0;
      ctx.translate(0, shake);
      ctx.fillStyle = this.state === 'creak' ? '#9a6a3a' : '#8a5a30'; ctx.fillRect(0, 0, r.w, r.h);
      ctx.fillStyle = '#5a3a1c';
      for (let i = 0; i < r.w / 16; i++) ctx.fillRect(i * 16, 0, 1.5, r.h);
      ctx.fillStyle = '#c9a34a'; ctx.fillRect(0, 0, r.w, 2);
      if (this.state === 'creak') { ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r.w / 2, 0); ctx.lineTo(r.w / 2 - 4, r.h); ctx.stroke(); }
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------
/** Cortina: abierta 4,5 s, cerrada 2,5 s, 0,5 s corriéndose. Nunca se cierra sobre jugador o enemigo. */
class Curtain {
  constructor(g, s) {
    this.s = s;
    this.h = (s.h || 4) * TILE;
    this.rect = { x: s.x * TILE + 10, y: s.y * TILE, w: 12, h: this.h };
    this.dyn = { ...this.rect, off: true, curtain: true };
    g.world.dyn.push(this.dyn);
    this.state = 'open';
    this.t = ((s.phase || 0) * 1.3) % 4.5;
    this.k = 0; // 0 abierta .. 1 cerrada
    this.frozen = !!g.world.openTrapdoors; // el validador la deja abierta
  }
  update(g, dt) {
    if (this.frozen) return;
    this.t += dt;
    if (this.state === 'open' && this.t >= 4.5) {
      const zone = { x: this.rect.x - 14, y: this.rect.y, w: this.rect.w + 28, h: this.rect.h };
      if (!bodiesOverlap(g, zone)) { this.state = 'closing'; this.t = 0; this.dyn.off = false; }
      else this.t = 4.4;
    } else if (this.state === 'closing') {
      this.k = clamp(this.t / 0.5, 0, 1);
      if (this.t >= 0.5) { this.state = 'closed'; this.t = 0; this.k = 1; }
    } else if (this.state === 'closed' && this.t >= 2.5) { this.state = 'opening'; this.t = 0; this.dyn.off = true; }
    else if (this.state === 'opening') {
      this.k = 1 - clamp(this.t / 0.5, 0, 1);
      if (this.t >= 0.5) { this.state = 'open'; this.t = 0; this.k = 0; }
    }
  }
  draw(ctx, cam, t, layer) {
    if (layer !== 'front') return;
    const r = this.rect;
    const x = r.x - cam.x - 10, y = r.y - cam.y;
    if (x < -60 || x > 1000) return;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#c9a34a'; ctx.fillRect(-6, -4, 44, 6);
    // paño recogido a un lado y, al cerrarse, cruzando la apertura
    const open = 1 - this.k;
    ctx.fillStyle = '#8a1f35';
    const wL = 8 + open * 4, wR = 8 + open * 4;
    const cover = this.k * 16;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(wL + cover, 0);
    for (let i = 0; i <= 8; i++) ctx.lineTo(wL + cover + Math.sin(i * 1.5 + t * (this.state === 'closing' ? 8 : 1)) * 1.5, (i / 8) * this.h);
    ctx.lineTo(0, this.h); ctx.fill();
    ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(32 - wR - cover, 0);
    for (let i = 0; i <= 8; i++) ctx.lineTo(32 - wR - cover - Math.sin(i * 1.5 + 1) * 1.5, (i / 8) * this.h);
    ctx.lineTo(32, this.h); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 1; i < 4; i++) { ctx.fillRect(i * 2, 4, 1, this.h - 6); ctx.fillRect(32 - i * 2, 4, 1, this.h - 6); }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------
/** Foco: al pasar debajo (±44 px) tiembla 0,45 s y cae (15 daño). Se rompe y vuelve a los 6 s. */
class Spotlight {
  constructor(g, s) {
    this.s = s;
    this.x = s.x * TILE + TILE / 2;
    this.y0 = s.y * TILE + 6;
    this.y = this.y0;
    this.vy = 0;
    this.state = 'idle';
    this.t = 0;
  }
  update(g, dt) {
    const p = g.player;
    this.t += dt;
    if (this.state === 'idle') {
      if (!p.hidden && Math.abs(p.cx - this.x) < 44 && p.cy > this.y0 && p.cy - this.y0 < 520 && g.world.los(this.x, this.y0 + 10, p.cx, p.cy)) { this.state = 'shake'; this.t = 0; audio.sfx('tick'); }
    } else if (this.state === 'shake') {
      if (this.t >= 0.45) { this.state = 'fall'; this.vy = 0; this.t = 0; }
    } else if (this.state === 'fall') {
      this.vy += 1800 * dt; this.y += this.vy * dt;
      const r = { x: this.x - 16, y: this.y - 8, w: 32, h: 26 };
      const hb = p.hurtBox();
      if (!p.hidden && r.x < hb.x + hb.w && r.x + r.w > hb.x && r.y < hb.y + hb.h && r.y + r.h > hb.y) {
        p.hurt(15 * CONFIG.enemies.damageMul, { x: this.x, y: this.y, kind: 'projectile' });
        this.crash(g);
      } else if (g.world.solidAtPx(this.x, this.y + 14) || this.y > g.world.pxH) this.crash(g);
    } else if (this.state === 'broken' && this.t >= 6) { this.state = 'idle'; this.y = this.y0; this.t = 0; }
  }
  crash(g) {
    this.state = 'broken'; this.t = 0;
    g.fx.burst(this.x, this.y + 10, 16, '#ffe9a0', 280, 0.6, 3, 400);
    g.fx.ring(this.x, this.y + 10, 4, 36, 0.3, '#ffe9a0', 3);
    audio.sfx('glass');
  }
  draw(ctx, cam, t, layer) {
    if (layer !== 'front') return;
    if (this.state === 'broken') return;
    const x = this.x - cam.x, y = this.y - cam.y;
    if (x < -50 || x > 1010) return;
    ctx.save(); ctx.translate(x + (this.state === 'shake' ? Math.sin(this.t * 80) * 2 : 0), y);
    if (this.state === 'idle' || this.state === 'shake') { // haz tenue
      ctx.fillStyle = 'rgba(255,240,180,0.07)'; ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(8, 8); ctx.lineTo(60, 340); ctx.lineTo(-60, 340); ctx.fill();
    }
    ctx.strokeStyle = '#2a2a34'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -(y - (this.y0 - cam.y)) - 10); ctx.lineTo(0, -6); ctx.stroke();
    ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.roundRect(-13, -6, 26, 18, 4); ctx.fill();
    ctx.fillStyle = this.state === 'shake' ? '#ff7a5a' : '#ffe9a0'; ctx.beginPath(); ctx.ellipse(0, 12, 11, 4, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------
/** Cuerda: enreda como telaraña (máx. 1 vez / 2,5 s). El dash con i-frames las cruza. */
class Rope {
  constructor(g, s) {
    this.s = s;
    this.x = s.x * TILE + TILE / 2;
    this.y0 = s.y * TILE;
    this.len = (s.len || 4) * TILE;
    this.cd = 0;
    this.ph = hash2(s.x, s.y) * 6;
  }
  update(g, dt) {
    this.cd -= dt;
    const p = g.player;
    if (this.cd > 0 || p.hidden) return;
    const sway = Math.sin(g.time * 1.3 + this.ph) * 6;
    if (p.x < this.x + 4 + sway && p.x + p.w > this.x - 4 + sway && p.y < this.y0 + this.len && p.y + p.h > this.y0) {
      if (p.isInvuln() || p.dashT > 0) return;
      this.cd = 2.5;
      p.entangle(2);
      audio.sfx('whoosh');
    }
  }
  draw(ctx, cam, t, layer) {
    if (layer !== 'front') return;
    const x = this.x - cam.x, y = this.y0 - cam.y;
    if (x < -30 || x > 990) return;
    const sway = Math.sin(t * 1.3 + this.ph) * 6;
    ctx.save();
    ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway * 0.4, y + this.len / 2, x + sway, y + this.len); ctx.stroke();
    ctx.strokeStyle = '#8a7a56'; ctx.lineWidth = 1;
    for (let i = 1; i < this.len / 12; i++) { const k = (i * 12) / this.len; ctx.beginPath(); ctx.moveTo(x + sway * k * k - 3, y + k * this.len); ctx.lineTo(x + sway * k * k + 3, y + k * this.len + 3); ctx.stroke(); }
    ctx.fillStyle = '#8a7a56'; ctx.beginPath(); ctx.arc(x + sway, y + this.len, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------
/** Noria: góndolas a 0,35 rad/s, siempre horizontales; te llevan encima. */
class Ferris {
  constructor(g, s) {
    this.s = s;
    this.cx = s.x * TILE + TILE / 2;
    this.cy = s.y * TILE + TILE / 2;
    this.r = s.r || 140;
    this.n = s.n || 6;
    this.a = 0;
    this.w = 0.35;
    this.gond = [];
    for (let i = 0; i < this.n; i++) {
      const d = { x: 0, y: 0, w: 56, h: 8, oneWay: true, off: false, vx: 0, vy: 0, gondola: true };
      g.world.dyn.push(d);
      this.gond.push(d);
    }
    this.place(0);
  }
  pos(i, a) {
    const ang = a + (i / this.n) * TAU;
    return { x: this.cx + Math.cos(ang) * this.r, y: this.cy + Math.sin(ang) * this.r };
  }
  place(dt) {
    this.gond.forEach((d, i) => {
      const q = this.pos(i, this.a);
      d.x = q.x - d.w / 2; d.y = q.y;
    });
  }
  update(g, dt) {
    const before = this.gond.map((d) => ({ x: d.x, y: d.y }));
    this.a += this.w * dt;
    this.place(dt);
    const bodies = [g.player, ...g.enemies];
    this.gond.forEach((d, i) => {
      const dx = d.x - before[i].x, dy = d.y - before[i].y;
      d.vx = dx / dt; d.vy = dy / dt;
      for (const b of bodies) {
        if (b.ride === d && (!b.dead)) { b.x += dx; b.y += dy; }
      }
    });
  }
  draw(ctx, cam, t, layer) {
    if (layer !== 'back') return;
    const x = this.cx - cam.x, y = this.cy - cam.y;
    if (x < -this.r - 80 || x > 960 + this.r + 80) return;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#6a5a7a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2;
    for (let i = 0; i < this.n; i++) { const q = this.pos(i, this.a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(q.x - this.cx, q.y - this.cy); ctx.stroke(); }
    ctx.fillStyle = '#c9a34a'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, this.r + 60); ctx.moveTo(0, 0); ctx.lineTo(30, this.r + 60); ctx.stroke();
    // góndolas siempre horizontales
    for (let i = 0; i < this.n; i++) {
      const q = this.pos(i, this.a);
      const gx = q.x - this.cx, gy = q.y - this.cy;
      ctx.fillStyle = i % 2 ? '#b0343c' : '#c9a34a'; ctx.fillRect(gx - 28, gy, 56, 8);
      ctx.strokeStyle = '#2a1a2a'; ctx.lineWidth = 1.5; ctx.strokeRect(gx - 28, gy, 56, 8);
      ctx.strokeStyle = '#6a5a7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx - 24, gy); ctx.lineTo(gx - 24, gy - 18); ctx.moveTo(gx + 24, gy); ctx.lineTo(gx + 24, gy - 18); ctx.moveTo(gx - 24, gy - 18); ctx.lineTo(gx + 24, gy - 18); ctx.stroke();
    }
    ctx.restore();
  }
}

const MAP = { trapdoor: Trapdoor, curtain: Curtain, spotlight: Spotlight, rope: Rope, ferris: Ferris };

export const PROP_TYPES = Object.keys(MAP);
export const PROP_META = {
  trapdoor: { label: 'Trampilla', w: 2 },
  curtain: { label: 'Cortina', h: 4 },
  spotlight: { label: 'Foco', ceil: true },
  rope: { label: 'Cuerda', len: 4, ceil: true },
  ferris: { label: 'Noria', r: 140 },
};

export function createTheaterProp(g, spec) {
  const C = MAP[spec.type];
  return C ? new C(g, spec) : null;
}
