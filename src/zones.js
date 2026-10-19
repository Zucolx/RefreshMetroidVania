// Zonas temporales de área: temblor, charcos de ácido, vapores, burbujas de tiempo y estelas de estasis.
import { TAU, rrange } from './util.js';

export class Zone {
  constructor(o) {
    Object.assign(this, { kind: 'generic', x: 0, y: 0, r: 40, life: 1, age: 0, tick: 0, dead: false }, o);
    this.max = this.life;
  }
  update(g, dt) {
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const fn = UPDATE[this.kind];
    if (fn) fn(this, g, dt);
    if (this.onUpdate) this.onUpdate(this, g, dt);
  }
  inside(e) {
    const dx = Math.max(e.x - this.x, 0, this.x - (e.x + e.w));
    const dy = Math.max(e.y - this.y, 0, this.y - (e.y + e.h));
    return dx * dx + dy * dy <= this.r * this.r;
  }
  draw(ctx, cam, t) {
    const x = this.x - cam.x, y = this.y - cam.y;
    if (x < -this.r - 20 || x > 1000 + this.r || y < -this.r - 20 || y > 600 + this.r) return;
    const fn = DRAW[this.kind];
    ctx.save();
    ctx.translate(x, y);
    if (fn) fn(ctx, this, t);
    if (this.onDraw) this.onDraw(ctx, this, t);
    ctx.restore();
  }
}

const UPDATE = {
  quake(z, g, dt) {
    z.tick -= dt;
    if (z.tick <= 0) {
      z.tick = 0.25;
      for (const e of g.enemies) {
        if (e.dead || e.untargetable || e.flies && false) continue;
        if (z.inside(e) && Math.abs(e.cy - z.y) < 140) {
          g.damageEnemy(e, z.dps * 0.25, { kind: 'quake', knock: 0, from: { x: z.x, y: z.y }, quiet: true, dir: 0 });
        }
      }
      g.fx.burst(z.x + rrange(-z.r, z.r), z.y, 3, '#c9a46a', 90, 0.4, 3, 200, 1.2, -Math.PI / 2);
    }
  },
  acid(z, g, dt) {
    z.tick -= dt;
    if (z.tick <= 0) {
      z.tick = 0.5;
      for (const e of g.enemies) {
        if (e.dead || e.untargetable || e.flies || e.ghost) continue;
        if (Math.abs(e.x + e.w / 2 - z.x) < z.r && Math.abs(e.y + e.h - z.y) < 22) {
          g.damageEnemy(e, z.dps * 0.5, { kind: 'acid', knock: 0, from: { x: z.x, y: z.y }, quiet: true, dir: 0 });
        }
      }
    }
  },
  vapor(z, g, dt) {
    z.tick -= dt;
    const hit = z.tick <= 0;
    if (hit) z.tick = 0.5;
    for (const e of g.enemies) {
      if (e.dead || e.untargetable || e.ghost) continue;
      if (z.inside(e)) {
        e.applySlow && e.applySlow(0.5, 0.6);
        if (hit) g.damageEnemy(e, z.dmg, { kind: 'vapor', knock: 0, from: { x: z.x, y: z.y }, quiet: true, dir: 0 });
      }
    }
  },
  bubble(z, g, dt) {
    for (const e of g.enemies) {
      if (e.dead || e.untargetable) continue;
      if (z.inside(e)) e.applySlow && e.applySlow(z.slow, 0.12);
    }
    for (const p of g.projectiles) {
      if (p.dead || p.team !== 'enemy') continue;
      if (Math.hypot(p.x - z.x, p.y - z.y) < z.r) p.ts = z.slow;
    }
  },
  stasis(z, g, dt) {
    for (const e of g.enemies) {
      if (e.dead || e.untargetable) continue;
      if (z.inside(e)) e.applySlow && e.applySlow(z.slow, z.slowTime);
    }
  },
  slowpulse(z, g, dt) {
    for (const e of g.enemies) {
      if (e.dead || e.untargetable) continue;
      if (z.inside(e)) e.applySlow && e.applySlow(z.slow, 0.2);
    }
    for (const p of g.projectiles) {
      if (p.dead || p.team !== 'enemy') continue;
      if (Math.hypot(p.x - z.x, p.y - z.y) < z.r) p.ts = z.slow;
    }
  },
};

const DRAW = {
  quake(ctx, z, t) {
    ctx.strokeStyle = 'rgba(160,120,70,0.8)'; ctx.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * z.r / 3.5, 2); ctx.lineTo(i * z.r / 3.5 + Math.sin(z.age * 40 + i) * 6, -10 - Math.abs(i) * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(160,120,70,0.18)'; ctx.beginPath(); ctx.ellipse(0, 0, z.r, 22, 0, 0, TAU); ctx.fill();
  },
  acid(ctx, z, t) {
    const k = Math.min(1, z.life / 0.5, z.age / 0.2);
    ctx.globalAlpha = 0.75 * k;
    ctx.fillStyle = '#7ddc3a'; ctx.beginPath(); ctx.ellipse(0, -2, z.r, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b8ff6a'; ctx.beginPath(); ctx.ellipse(-z.r * 0.2, -4, z.r * 0.5, 4, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = k;
    for (let i = 0; i < 4; i++) {
      const ph = (z.age * 1.5 + i * 0.25) % 1;
      ctx.fillStyle = 'rgba(190,255,120,0.8)'; ctx.beginPath(); ctx.arc((i - 1.5) * z.r * 0.4, -ph * 18, 2.5 * (1 - ph), 0, TAU); ctx.fill();
    }
  },
  vapor(ctx, z, t) {
    const k = Math.min(1, z.life / 0.5);
    ctx.globalAlpha = 0.55 * k;
    ctx.fillStyle = z.color || '#b8ff8a';
    ctx.beginPath(); ctx.arc(0, 0, z.r * (0.8 + 0.2 * Math.sin(z.age * 5)), 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.35 * k; ctx.beginPath(); ctx.arc(z.r * 0.3, -z.r * 0.3, z.r * 0.6, 0, TAU); ctx.fill();
  },
  bubble(ctx, z, t) {
    const k = Math.min(1, z.life / 0.25, z.age / 0.1);
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(120,180,255,0.18)'; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(170,210,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.stroke();
    // esfera de reloj
    ctx.strokeStyle = 'rgba(220,235,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, z.r * 0.5, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(z.age * -4) * z.r * 0.4, Math.sin(z.age * -4) * z.r * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(z.age * -1) * z.r * 0.28, Math.sin(z.age * -1) * z.r * 0.28); ctx.stroke();
  },
  stasis(ctx, z, t) {
    const k = Math.min(1, z.life / 0.5);
    ctx.globalAlpha = 0.8 * k;
    ctx.strokeStyle = '#6fb8ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, z.r * (0.7 + 0.3 * (1 - k)), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.2 * k; ctx.fillStyle = '#6fb8ff'; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
  },
  slowpulse(ctx, z, t) {
    const k = z.age / z.max;
    ctx.globalAlpha = 0.5 * (1 - k * 0.6);
    ctx.fillStyle = 'rgba(140,190,255,0.25)'; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#9fd0ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * z.r * 0.85, Math.sin(a) * z.r * 0.85); ctx.lineTo(Math.cos(a) * z.r, Math.sin(a) * z.r); ctx.stroke();
    }
  },
};
