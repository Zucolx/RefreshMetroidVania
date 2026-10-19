// Monedas de plata: valor aleatorio en [mín, máx] repartido en monedas de 5 y de 1; imán; caducidad.
import { CONFIG } from './config.js';
import { Body, moveBody } from './physics.js';
import { rint, rrange, TAU } from './util.js';
import { Store } from './storage.js';

export class Coin extends Body {
  constructor(x, y, value) {
    super(x - 5, y - 5, value >= 5 ? 14 : 10, value >= 5 ? 14 : 10);
    this.value = value;
    this.vx = rrange(-130, 130);
    this.vy = rrange(-420, -220);
    this.age = 0;
    this.dead = false;
    this.attract = false;
    this.spin = rrange(0, TAU);
  }
  update(g, dt) {
    this.snap();
    this.age += dt;
    const c = CONFIG.coins;
    if (this.age > c.life) { this.dead = true; return; }
    const p = g.player;
    const d = Math.hypot(p.cx - this.cx, p.cy - this.cy);
    if (this.age > c.magnetDelay && d < c.magnet && !p.hidden) this.attract = true;
    if (this.attract) {
      const s = 520 + (c.magnet - Math.min(d, c.magnet)) * 2;
      const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
      this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
      this.x += this.vx * dt; this.y += this.vy * dt;
    } else {
      // flotan sobre lava y pinchos
      const hz = g.world.hazardAt({ x: this.x, y: this.y + this.h - 2, w: this.w, h: 6 });
      if (hz) { this.vy = Math.min(this.vy, -60); this.vy -= 800 * dt; this.vx *= 0.98; }
      this.vy = Math.min(this.vy + CONFIG.gravity * 0.6 * dt, 700);
      const vyBefore = this.vy;
      const r = moveBody(g.world, this, dt);
      if (r.d) { this.vy = vyBefore > 160 ? -vyBefore * 0.45 : 0; this.vx *= 0.8; }
      if (r.l || r.r) this.vx *= -0.5;
    }
    if (d < 22 && !p.hidden) this.collect(g);
  }
  collect(g) {
    this.dead = true;
    Store.data.coins += this.value;
    g.coinsRun = (g.coinsRun || 0) + this.value;
    g.audio.sfx('coin');
    g.fx.dot(this.cx, this.cy, 0, -60, 0.4, '#e8ecf5', 3, 0);
  }
  draw(ctx, cam, t) {
    if (this.dead) return;
    const blink = this.age > CONFIG.coins.life - 4 && Math.floor(this.age * 8) % 2;
    if (blink) return;
    const x = this.cx - cam.x, y = this.cy - cam.y;
    ctx.save();
    ctx.translate(x, y);
    const sx = Math.abs(Math.cos(this.age * 6 + this.spin));
    ctx.scale(Math.max(0.25, sx), 1);
    const r = this.value >= 5 ? 8 : 5;
    ctx.fillStyle = '#c9d2e0'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#7e8aa0'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#f5f8ff'; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.4, 0, TAU); ctx.fill();
    if (this.value >= 5) { // estrella en las grandes
      ctx.fillStyle = '#7e8aa0'; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? 2.2 : 5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

/** Reparte el total en monedas de 5 y de 1. */
export function splitCoins(total) {
  const out = [];
  let n = Math.max(0, Math.round(total));
  while (n >= 5) { out.push(5); n -= 5; }
  while (n > 0) { out.push(1); n--; }
  return out;
}

export function dropCoins(g, e) {
  const c = CONFIG.coins;
  if (!c.enabled || e.noCoins || !e.coins) return 0;
  const [lo, hi] = e.coins;
  const total = Math.round(rint(lo, hi) * c.mul);
  for (const v of splitCoins(total)) g.coins.push(new Coin(e.cx, e.cy, v));
  return total;
}
