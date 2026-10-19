// Partículas y efectos visuales. Todo pasa por el slot `fx` del render híbrido (sprite opcional por tipo).
import { sprites } from './render/hybrid.js';
import { rrange, TAU } from './util.js';

export class Effects {
  constructor() {
    this.list = [];
    this.cap = 900;
  }
  clear() { this.list.length = 0; }
  add(f) {
    if (this.list.length > this.cap) this.list.shift();
    f.age = 0;
    f.max = f.life;
    this.list.push(f);
    return f;
  }
  /** Partícula suelta. */
  dot(x, y, vx, vy, life, color, size = 3, grav = 0, shape = 'sq') {
    return this.add({ k: 'dot', x, y, vx, vy, life, color, size, grav, shape });
  }
  burst(x, y, n, color, speed = 160, life = 0.5, size = 3, grav = 300, spread = TAU, dir = 0) {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.dot(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), color, size * (0.6 + Math.random() * 0.8), grav);
    }
  }
  ring(x, y, r0, r1, life, color, width = 4) {
    return this.add({ k: 'ring', x, y, r0, r1, life, color, width });
  }
  disc(x, y, r0, r1, life, color) {
    return this.add({ k: 'disc', x, y, r0, r1, life, color });
  }
  text(x, y, str, color = '#fff', life = 0.9, size = 14) {
    return this.add({ k: 'text', x, y, vy: -40, str, color, life, size });
  }
  line(x1, y1, x2, y2, life, color, width = 3) {
    return this.add({ k: 'line', x: x1, y: y1, x2, y2, life, color, width });
  }
  slash(x, y, r, a0, a1, life, color, width = 8) {
    return this.add({ k: 'slash', x, y, r, a0, a1, life, color, width });
  }
  /** Imagen fantasma (dash, estelas): fn(ctx, alpha) la dibuja en coordenadas de mundo. */
  ghost(draw, life, alpha = 0.5) {
    return this.add({ k: 'ghost', draw, life, alpha });
  }
  smoke(x, y, n, color = 'rgba(200,200,210,0.5)', size = 14) {
    for (let i = 0; i < n; i++) {
      this.add({ k: 'smoke', x: x + rrange(-10, 10), y: y + rrange(-10, 10), vx: rrange(-30, 30), vy: rrange(-50, -10), life: rrange(0.5, 0.9), color, size: size * rrange(0.6, 1.2) });
    }
  }

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const f = l[i];
      f.age += dt;
      if (f.age >= f.life) { l[i] = l[l.length - 1]; l.pop(); continue; }
      if (f.vx !== undefined) { f.x += f.vx * dt; }
      if (f.vy !== undefined) {
        f.y += f.vy * dt;
        if (f.grav) f.vy += f.grav * dt;
      }
    }
  }

  draw(ctx, cam) {
    for (const f of this.list) {
      const t = f.age / f.max;
      const sx = f.x - cam.x, sy = f.y - cam.y;
      if (f.k !== 'ghost' && (sx < -300 || sx > 1260 || sy < -300 || sy > 840)) continue;
      ctx.save();
      switch (f.k) {
        case 'dot':
          sprites.slot(ctx, 'fx', 'dot', null, f.age, { x: sx, y: sy }, (c) => {
            c.globalAlpha = 1 - t * t; c.fillStyle = f.color;
            const s = f.size * (1 - t * 0.5);
            if (f.shape === 'circ') { c.beginPath(); c.arc(0, 0, s, 0, TAU); c.fill(); } else c.fillRect(-s / 2, -s / 2, s, s);
          });
          break;
        case 'smoke':
          sprites.slot(ctx, 'fx', 'smoke', null, f.age, { x: sx, y: sy }, (c) => {
            c.globalAlpha = (1 - t) * 0.8; c.fillStyle = f.color;
            c.beginPath(); c.arc(0, 0, f.size * (0.6 + t), 0, TAU); c.fill();
          });
          break;
        case 'ring':
          sprites.slot(ctx, 'fx', 'ring', null, f.age, { x: sx, y: sy }, (c) => {
            const r = f.r0 + (f.r1 - f.r0) * (1 - (1 - t) * (1 - t));
            c.globalAlpha = 1 - t; c.strokeStyle = f.color; c.lineWidth = Math.max(1, f.width * (1 - t * 0.6));
            c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
          });
          break;
        case 'disc':
          sprites.slot(ctx, 'fx', 'disc', null, f.age, { x: sx, y: sy }, (c) => {
            const r = f.r0 + (f.r1 - f.r0) * (1 - (1 - t) * (1 - t));
            c.globalAlpha = (1 - t) * 0.7; c.fillStyle = f.color;
            c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
          });
          break;
        case 'text':
          sprites.slot(ctx, 'fx', 'text', null, f.age, { x: sx, y: sy }, (c) => {
            c.globalAlpha = Math.min(1, (1 - t) * 2);
            c.font = `bold ${f.size}px system-ui, sans-serif`; c.textAlign = 'center';
            c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText(f.str, 0, 0);
            c.fillStyle = f.color; c.fillText(f.str, 0, 0);
          });
          break;
        case 'line':
          ctx.globalAlpha = 1 - t; ctx.strokeStyle = f.color; ctx.lineWidth = f.width * (1 - t * 0.5);
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(f.x2 - cam.x, f.y2 - cam.y); ctx.stroke();
          break;
        case 'slash':
          sprites.slot(ctx, 'fx', 'slash', null, f.age, { x: sx, y: sy }, (c) => {
            c.globalAlpha = (1 - t) * 0.9; c.strokeStyle = f.color; c.lineCap = 'round';
            c.lineWidth = f.width * (1 - t * 0.5);
            c.beginPath(); c.arc(0, 0, f.r, f.a0, f.a1, f.a1 < f.a0); c.stroke();
          });
          break;
        case 'ghost':
          ctx.globalAlpha = f.alpha * (1 - t);
          ctx.translate(-cam.x, -cam.y);
          f.draw(ctx);
          break;
        default: break;
      }
      ctx.restore();
    }
  }
}
