// Temas visuales: paleta de tiles + fondo parallax multicapa + capa de primer plano.
import { TILE, VIEW_W, VIEW_H } from './config.js';
import { T } from './world.js';
import { hash2, TAU } from './util.js';

// ---------- helpers de capas ----------
function ridge(ctx, camX, f, baseY, amp, color, freq = 0.004, seed = 0, step = 14) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let sx = 0; sx <= VIEW_W + step; sx += step) {
    const wx = sx + camX * f + seed * 777;
    const y = baseY + (Math.sin(wx * freq) + Math.sin(wx * freq * 2.3 + 1.7) * 0.5 + Math.sin(wx * freq * 5.1) * 0.2) * amp;
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(VIEW_W + step, VIEW_H);
  ctx.closePath();
  ctx.fill();
}
/** Recorre celdas de periodo `period` visibles a factor f y llama a fn(cx, hash, screenX). */
function cells(camX, f, period, fn, seed = 0) {
  const off = camX * f;
  const i0 = Math.floor(off / period) - 1;
  const i1 = Math.floor((off + VIEW_W) / period) + 1;
  for (let i = i0; i <= i1; i++) fn(i, hash2(i, seed, 11), i * period - off);
}
function gradient(ctx, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
function tree(ctx, x, base, h, w, trunk, leaf) {
  ctx.fillStyle = trunk;
  ctx.fillRect(x - w * 0.08, base - h * 0.45, w * 0.16, h * 0.45);
  ctx.fillStyle = leaf;
  ctx.beginPath(); ctx.arc(x, base - h * 0.62, w * 0.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x - w * 0.28, base - h * 0.5, w * 0.34, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.3, base - h * 0.5, w * 0.36, 0, TAU); ctx.fill();
}

// ---------- definiciones ----------
export const THEMES = {
  lab: {
    name: 'Laboratorio',
    solid: '#2b3a4a', solidAlt: '#34475a', edge: '#6fb3c9', detail: '#1c2733',
    plat: '#8aa4b8', spike: '#c8d6e0', lava: '#ff6a2a', top: '#58c0d6',
    bg(ctx, cam, t) {
      gradient(ctx, [[0, '#0b1420'], [1, '#18283a']]);
      ctx.strokeStyle = 'rgba(80,160,190,0.07)'; ctx.lineWidth = 1;
      const gx = -((cam.x * 0.1) % 48);
      for (let x = gx; x < VIEW_W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_H); ctx.stroke(); }
      for (let y = -((cam.y * 0.1) % 48); y < VIEW_H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); ctx.stroke(); }
      cells(cam.x, 0.2, 260, (i, h, sx) => { // engranajes lejanos
        const r = 50 + h * 60, cy = 120 + h * 260 - cam.y * 0.1;
        ctx.save(); ctx.translate(sx + 100, cy); ctx.rotate(t * 0.15 * (i % 2 ? 1 : -1));
        ctx.strokeStyle = 'rgba(70,120,150,0.22)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        for (let k = 0; k < 8; k++) { ctx.rotate(TAU / 8); ctx.fillStyle = 'rgba(70,120,150,0.22)'; ctx.fillRect(r - 4, -7, 14, 14); }
        ctx.restore();
      });
      cells(cam.x, 0.4, 180, (i, h, sx) => { // tuberías verticales y luces
        ctx.fillStyle = 'rgba(40,70,92,0.8)'; ctx.fillRect(sx + h * 60, 0, 18, VIEW_H);
        ctx.fillStyle = Math.sin(t * 2 + i) > 0 ? 'rgba(90,230,200,0.9)' : 'rgba(40,120,110,0.6)';
        ctx.fillRect(sx + h * 60 + 6, 60 + h * 300 - cam.y * 0.1, 6, 6);
      }, 3);
    },
    fg(ctx, cam, t) {
      ctx.fillStyle = 'rgba(100,200,230,0.04)';
      cells(cam.x, 1.4, 340, (i, h, sx) => ctx.fillRect(sx, 0, 40, VIEW_H), 9);
    },
  },
  forest: {
    name: 'Bosque',
    solid: '#3b2a1c', solidAlt: '#46321f', edge: '#4f9b3a', detail: '#241810',
    plat: '#8a6a3c', spike: '#c9c2a0', lava: '#ff6a2a', top: '#58b043',
    bg(ctx, cam, t) {
      gradient(ctx, [[0, '#17381f'], [0.55, '#2c6a3c'], [1, '#0f2a18']]);
      ctx.fillStyle = 'rgba(255,250,200,0.07)';
      cells(cam.x, 0.15, 220, (i, h, sx) => { // rayos de luz
        ctx.beginPath(); ctx.moveTo(sx + 40, 0); ctx.lineTo(sx + 110, 0); ctx.lineTo(sx + 40 - 120, VIEW_H); ctx.lineTo(sx - 60 - 120, VIEW_H); ctx.fill();
      }, 2);
      ridge(ctx, cam.x, 0.12, 340 - cam.y * 0.05, 60, '#1b4a2b', 0.003, 1);
      cells(cam.x, 0.3, 120, (i, h, sx) => tree(ctx, sx + h * 40, 440 - cam.y * 0.1, 220 + h * 90, 120 + h * 50, '#173022', '#215c35'), 4);
      cells(cam.x, 0.55, 150, (i, h, sx) => tree(ctx, sx + h * 60, 520 - cam.y * 0.15, 330 + h * 120, 170 + h * 70, '#0f2218', '#16452a'), 5);
    },
    fg(ctx, cam, t) {
      cells(cam.x, 1.5, 300, (i, h, sx) => {
        ctx.fillStyle = 'rgba(8,30,16,0.55)';
        ctx.beginPath(); ctx.ellipse(sx + h * 100, -10, 80 + h * 50, 36 + h * 20, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sx + h * 100 + 70, VIEW_H + 6, 90, 30, 0, 0, TAU); ctx.fill();
      }, 6);
    },
  },
  volcano: {
    name: 'Volcán',
    solid: '#3a2420', solidAlt: '#452a24', edge: '#d9622b', detail: '#1f110e',
    plat: '#7a5a48', spike: '#d6c5b4', lava: '#ff5a1a', top: '#8a3a1c',
    bg(ctx, cam, t) {
      gradient(ctx, [[0, '#1a0a0a'], [0.6, '#4a1a10'], [1, '#2a0d08']]);
      ctx.fillStyle = 'rgba(255,120,40,0.1)';
      ctx.beginPath(); ctx.arc(VIEW_W * 0.5 - cam.x * 0.05, VIEW_H + 40, 360, Math.PI, 0); ctx.fill();
      ridge(ctx, cam.x, 0.1, 300 - cam.y * 0.05, 90, '#2a1210', 0.0025, 2);
      cells(cam.x, 0.12, 700, (i, h, sx) => { // cono de volcán con brillo
        ctx.fillStyle = '#220f0c'; ctx.beginPath(); ctx.moveTo(sx, VIEW_H); ctx.lineTo(sx + 260, 200 - cam.y * 0.04); ctx.lineTo(sx + 520, VIEW_H); ctx.fill();
        ctx.fillStyle = `rgba(255,${100 + Math.sin(t * 3 + i) * 30},30,0.8)`; ctx.fillRect(sx + 240, 196 - cam.y * 0.04, 40, 8);
      }, 3);
      ridge(ctx, cam.x, 0.35, 420 - cam.y * 0.1, 50, '#1a0b09', 0.005, 5);
      cells(cam.x, 0.5, 200, (i, h, sx) => { ctx.fillStyle = '#150807'; ctx.fillRect(sx + h * 80, 330 - cam.y * 0.15, 28, 400); }, 8);
    },
    fg(ctx, cam, t) {
      ctx.fillStyle = 'rgba(255,150,60,0.85)';
      for (let i = 0; i < 24; i++) { // brasas
        const x = ((hash2(i, 1) * VIEW_W * 1.4 - cam.x * 0.8 + t * 20 * hash2(i, 2)) % (VIEW_W + 20) + VIEW_W + 20) % (VIEW_W + 20);
        const y = (VIEW_H + 20 - ((t * (30 + hash2(i, 3) * 40) + hash2(i, 4) * 600) % (VIEW_H + 40)));
        ctx.globalAlpha = 0.3 + hash2(i, 5) * 0.5; ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
    },
  },
  valley: {
    name: 'Valle',
    solid: '#3b3a45', solidAlt: '#45434f', edge: '#8a9a5b', detail: '#22212a',
    plat: '#7d6a55', spike: '#bcc3cc', lava: '#ff6a2a', top: '#6e8f4c',
    bg(ctx, cam, t) {
      gradient(ctx, [[0, '#24274f'], [0.5, '#6a4f7a'], [1, '#d58f6a']]);
      ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.beginPath(); ctx.arc(760 - cam.x * 0.02, 110, 34, 0, TAU); ctx.fill();
      ridge(ctx, cam.x, 0.08, 330 - cam.y * 0.05, 80, '#3a3466', 0.003, 1);
      ridge(ctx, cam.x, 0.18, 400 - cam.y * 0.08, 55, '#2c2b4f', 0.004, 2);
      cells(cam.x, 0.32, 210, (i, h, sx) => { // casitas lejanas
        const w = 60 + h * 40, b = 470 - cam.y * 0.12;
        ctx.fillStyle = '#1e1d3a'; ctx.fillRect(sx, b - 50, w, 50);
        ctx.beginPath(); ctx.moveTo(sx - 6, b - 50); ctx.lineTo(sx + w / 2, b - 90); ctx.lineTo(sx + w + 6, b - 50); ctx.fill();
        if (h > 0.4) { ctx.fillStyle = 'rgba(255,200,100,0.8)'; ctx.fillRect(sx + w * 0.4, b - 32, 8, 10); }
      }, 4);
      ridge(ctx, cam.x, 0.5, 500 - cam.y * 0.15, 30, '#15142c', 0.006, 7);
    },
    fg(ctx, cam, t) {
      ctx.fillStyle = 'rgba(200,190,230,0.08)';
      cells(cam.x, 1.3, 260, (i, h, sx) => { ctx.beginPath(); ctx.ellipse(sx + 80, 470 + h * 40, 190, 26, 0, 0, TAU); ctx.fill(); }, 12);
    },
  },
  castle: {
    name: 'Castillo',
    solid: '#35323f', solidAlt: '#3d3a48', edge: '#8c7fb0', detail: '#1d1b25',
    plat: '#6d6680', spike: '#d4d4e0', lava: '#ff6a2a', top: '#6a6485',
    bg(ctx, cam, t) {
      gradient(ctx, [[0, '#0d0b18'], [1, '#2a2340']]);
      ctx.fillStyle = 'rgba(230,230,255,0.9)'; ctx.beginPath(); ctx.arc(150 - cam.x * 0.02, 90, 24, 0, TAU); ctx.fill();
      cells(cam.x, 0.15, 340, (i, h, sx) => { // torres lejanas
        const hh = 200 + h * 220;
        ctx.fillStyle = '#16132a'; ctx.fillRect(sx, VIEW_H - hh - cam.y * 0.05, 70, hh + 200);
        for (let k = 0; k < 4; k++) ctx.fillRect(sx + k * 20 - 2, VIEW_H - hh - 14 - cam.y * 0.05, 12, 14);
        ctx.beginPath(); ctx.moveTo(sx + 4, VIEW_H - hh - 14 - cam.y * 0.05); ctx.lineTo(sx + 35, VIEW_H - hh - 80 - cam.y * 0.05); ctx.lineTo(sx + 66, VIEW_H - hh - 14 - cam.y * 0.05); ctx.fill();
      }, 3);
      cells(cam.x, 0.4, 170, (i, h, sx) => { // arcos y columnas
        ctx.fillStyle = '#1b1830'; ctx.fillRect(sx, 0, 26, VIEW_H);
        ctx.beginPath(); ctx.arc(sx + 85, 160 - cam.y * 0.08, 60, Math.PI, 0); ctx.lineTo(sx + 145, 0); ctx.lineTo(sx + 25, 0); ctx.fill();
        if (h > 0.5) { ctx.fillStyle = '#6b2a3a'; ctx.fillRect(sx + 66, 160 - cam.y * 0.08, 40, 120); }
      }, 5);
    },
    fg(ctx, cam, t) {
      ctx.fillStyle = 'rgba(160,150,200,0.06)';
      cells(cam.x, 1.2, 300, (i, h, sx) => { ctx.beginPath(); ctx.ellipse(sx + 100, 500, 220, 40, 0, 0, TAU); ctx.fill(); }, 15);
    },
  },
  theater: {
    name: 'Teatro',
    solid: '#3a2330', solidAlt: '#442937', edge: '#c9a34a', detail: '#1f1119',
    plat: '#8a5a3c', spike: '#d6cfc4', lava: '#ff6a2a', top: '#b0343c',
    bg(ctx, cam, t) {
      gradient(ctx, [[0, '#1c0c14'], [1, '#4a1c28']]);
      cells(cam.x, 0.2, 240, (i, h, sx) => { // cortinajes
        ctx.fillStyle = '#5c1a28';
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + 120, 0);
        for (let k = 0; k <= 8; k++) ctx.lineTo(sx + 120 - k * 4 + Math.sin(k + i) * 6, 120 + k * 36);
        ctx.lineTo(sx, 420); ctx.fill();
        ctx.fillStyle = '#c9a34a'; ctx.fillRect(sx - 4, 0, 130, 10);
      }, 1);
      ctx.fillStyle = 'rgba(255,230,160,0.06)';
      cells(cam.x, 0.35, 300, (i, h, sx) => { // haces de focos
        ctx.beginPath(); ctx.moveTo(sx + 120, 0); ctx.lineTo(sx + 140, 0); ctx.lineTo(sx + 300 * (h - 0.3), VIEW_H); ctx.lineTo(sx + 60 + 300 * (h - 0.3), VIEW_H); ctx.fill();
      }, 7);
      cells(cam.x, 0.5, 200, (i, h, sx) => { // palcos
        ctx.fillStyle = '#2a0f1a'; ctx.fillRect(sx, 240 - cam.y * 0.1 + h * 40, 120, 14);
        ctx.fillStyle = '#3a1522'; ctx.fillRect(sx + 6, 254 - cam.y * 0.1 + h * 40, 108, 70);
      }, 9);
    },
    fg(ctx, cam, t) {
      ctx.fillStyle = 'rgba(120,20,40,0.55)';
      ctx.fillRect(0, 0, 26, VIEW_H); ctx.fillRect(VIEW_W - 26, 0, 26, VIEW_H);
      for (let k = 0; k < 6; k++) { ctx.fillRect(26 + k * 3, 0, 4, VIEW_H); ctx.fillRect(VIEW_W - 30 - k * 3, 0, 4, VIEW_H); }
    },
  },
};

export function themeOf(id) { return THEMES[id] || THEMES.lab; }
export const THEME_IDS = Object.keys(THEMES);

// ---------- dibujo de tiles ----------
export function drawTiles(ctx, world, cam, t) {
  const th = themeOf(world.theme);
  const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(world.w - 1, Math.floor((cam.x + VIEW_W) / TILE));
  const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(world.h - 1, Math.floor((cam.y + VIEW_H) / TILE));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const tl = world.tiles[ty * world.w + tx];
      if (!tl) continue;
      const px = tx * TILE - cam.x, py = ty * TILE - cam.y;
      if (tl === T.SOLID) {
        const h = hash2(tx, ty);
        const above = ty > 0 ? world.tiles[(ty - 1) * world.w + tx] : 1;
        ctx.fillStyle = h > 0.5 ? th.solid : th.solidAlt;
        ctx.fillRect(px, py, TILE, TILE);
        // grietas / detalles
        ctx.fillStyle = th.detail;
        if (h < 0.3) ctx.fillRect(px + h * 60, py + 8, 10, 3);
        else if (h > 0.8) ctx.fillRect(px + 6, py + 18 + (h - 0.8) * 30, 3, 8);
        // borde superior si hay aire encima
        if (above !== T.SOLID) {
          ctx.fillStyle = th.top; ctx.fillRect(px, py, TILE, 6);
          ctx.fillStyle = th.edge; ctx.fillRect(px, py, TILE, 2);
        }
        const left = tx > 0 ? world.tiles[ty * world.w + tx - 1] : 1;
        if (left !== T.SOLID) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(px, py, 2, TILE); }
        if (ty < world.h - 1 && world.tiles[(ty + 1) * world.w + tx] !== T.SOLID) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px, py + TILE - 4, TILE, 4); }
      } else if (tl === T.PLAT) {
        ctx.fillStyle = th.plat; ctx.fillRect(px, py, TILE, 9);
        ctx.fillStyle = th.edge; ctx.fillRect(px, py, TILE, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px, py + 9, TILE, 2);
        ctx.fillStyle = th.plat; ctx.globalAlpha = 0.5; ctx.fillRect(px + 4, py + 11, 3, 6); ctx.fillRect(px + TILE - 7, py + 11, 3, 6); ctx.globalAlpha = 1;
      } else if (tl === T.SPIKE) {
        ctx.fillStyle = th.spike;
        for (let k = 0; k < 4; k++) {
          const bx = px + k * 8;
          ctx.beginPath(); ctx.moveTo(bx, py + TILE); ctx.lineTo(bx + 4, py + 12); ctx.lineTo(bx + 8, py + TILE); ctx.fill();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px, py + TILE - 4, TILE, 4);
      } else if (tl === T.LAVA) {
        const above = ty > 0 ? world.tiles[(ty - 1) * world.w + tx] : 0;
        const wob = above === T.LAVA ? 0 : Math.sin(t * 3 + tx * 0.9) * 2;
        ctx.fillStyle = '#c4300c'; ctx.fillRect(px, py + (above === T.LAVA ? 0 : 6) + wob, TILE, TILE);
        ctx.fillStyle = th.lava; ctx.fillRect(px, py + (above === T.LAVA ? 0 : 6) + wob, TILE, above === T.LAVA ? TILE : 6);
        if (above !== T.LAVA) { ctx.fillStyle = '#ffd36a'; ctx.fillRect(px + 4 + ((t * 20 + tx * 7) % 20), py + 6 + wob, 6, 2); }
      }
    }
  }
}

export function drawBackground(ctx, world, cam, t) {
  themeOf(world.theme).bg(ctx, cam, t);
}
export function drawForeground(ctx, world, cam, t) {
  const th = themeOf(world.theme);
  th.fg && th.fg(ctx, cam, t);
}
