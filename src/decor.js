// Decorado no interactivo (árboles, casas, farolas…) dibujado con formas procedurales.
import { TILE, VIEW_W, VIEW_H } from './config.js';
import { hash2, TAU } from './util.js';

// h = altura libre necesaria en tiles; w = ancho en tiles
export const DECOR = {
  tree: { name: 'Árbol', w: 3, h: 7, draw(c, h, t) {
    c.fillStyle = '#4a3220'; c.fillRect(-7, -150, 14, 150);
    c.fillStyle = '#2f6b34'; for (const [x, y, r] of [[0, -170, 52], [-34, -140, 36], [34, -140, 38], [0, -120, 40]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.fillStyle = '#3f8a42'; c.beginPath(); c.arc(-10, -180, 26, 0, TAU); c.fill();
  } },
  bush: { name: 'Arbusto', w: 2, h: 2, draw(c, h) {
    c.fillStyle = '#2f6b34'; for (const [x, r] of [[-14, 14], [0, 18], [14, 13]]) { c.beginPath(); c.arc(x, -r + 2, r, 0, TAU); c.fill(); }
    c.fillStyle = h > 0.5 ? '#d9534f' : '#e8c34a'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-12 + i * 12, -14 - (i % 2) * 6, 2.2, 0, TAU); c.fill(); }
  } },
  mushroom: { name: 'Hongo', w: 1, h: 2, draw(c, h) {
    c.fillStyle = '#e8dcc0'; c.fillRect(-3, -14, 6, 14);
    c.fillStyle = h > 0.5 ? '#c9473d' : '#7a5bc0'; c.beginPath(); c.ellipse(0, -15, 13, 9, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-5, -19, 2, 0, TAU); c.arc(4, -17, 1.6, 0, TAU); c.fill();
  } },
  crystal: { name: 'Cristal', w: 1, h: 3, draw(c, h, t) {
    const col = h > 0.5 ? '#8fe3ff' : '#d79bff';
    c.fillStyle = col; c.globalAlpha = 0.85;
    c.beginPath(); c.moveTo(-6, 0); c.lineTo(-3, -34); c.lineTo(2, -44); c.lineTo(7, -30); c.lineTo(8, 0); c.fill();
    c.fillStyle = '#fff'; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(-1, -4); c.lineTo(1, -36); c.lineTo(3, -30); c.lineTo(2, -4); c.fill();
    c.globalAlpha = 0.12 + 0.08 * Math.sin(t * 2 + h * 10); c.fillStyle = col; c.beginPath(); c.arc(0, -24, 28, 0, TAU); c.fill();
  } },
  house: { name: 'Casa', w: 5, h: 5, draw(c, h) {
    c.fillStyle = '#7a5a40'; c.fillRect(-62, -78, 124, 78);
    c.fillStyle = '#9a3d34'; c.beginPath(); c.moveTo(-74, -78); c.lineTo(0, -128); c.lineTo(74, -78); c.fill();
    c.fillStyle = '#3a2418'; c.fillRect(-12, -42, 24, 42);
    c.fillStyle = '#ffd98a'; c.fillRect(-48, -62, 22, 20); c.fillRect(26, -62, 22, 20);
    c.strokeStyle = '#3a2418'; c.lineWidth = 2; c.strokeRect(-48, -62, 22, 20); c.strokeRect(26, -62, 22, 20);
    c.fillStyle = '#5a3a28'; c.fillRect(34, -142, 14, 30);
  } },
  fence: { name: 'Valla', w: 3, h: 1, draw(c) {
    c.fillStyle = '#7a5a40';
    for (let i = -1; i <= 1; i++) c.fillRect(i * 28 - 4, -30, 8, 30);
    c.fillRect(-48, -24, 96, 5); c.fillRect(-48, -12, 96, 5);
  } },
  lamp: { name: 'Farol', w: 1, h: 4, draw(c, h, t) {
    c.fillStyle = '#2a2a34'; c.fillRect(-2, -92, 4, 92); c.fillRect(-8, -96, 16, 6);
    c.fillStyle = `rgba(255,220,130,${0.9 - 0.1 * Math.sin(t * 7 + h * 9)})`; c.beginPath(); c.arc(0, -104, 8, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,220,130,0.14)'; c.beginPath(); c.arc(0, -104, 46, 0, TAU); c.fill();
  } },
  well: { name: 'Pozo', w: 3, h: 3, draw(c) {
    c.fillStyle = '#8a8a94'; c.fillRect(-26, -30, 52, 30);
    c.fillStyle = '#5a5a64'; for (let i = 0; i < 4; i++) c.fillRect(-26 + i * 13, -30, 1.5, 30);
    c.fillStyle = '#6b4a2c'; c.fillRect(-28, -70, 5, 40); c.fillRect(23, -70, 5, 40); c.fillRect(-32, -74, 64, 6);
    c.strokeStyle = '#d8c8a0'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -68); c.lineTo(0, -46); c.stroke();
    c.fillStyle = '#5a3a28'; c.fillRect(-5, -46, 10, 8);
  } },
  tombstone: { name: 'Lápida', w: 1, h: 2, draw(c, h) {
    c.fillStyle = '#9a9aa6'; c.beginPath(); c.moveTo(-11, 0); c.lineTo(-11, -28); c.arc(0, -28, 11, Math.PI, 0); c.lineTo(11, 0); c.fill();
    c.strokeStyle = '#5a5a66'; c.lineWidth = 2;
    if (h > 0.5) { c.beginPath(); c.moveTo(0, -34); c.lineTo(0, -16); c.moveTo(-6, -28); c.lineTo(6, -28); c.stroke(); }
    else { c.beginPath(); c.moveTo(-5, -22); c.lineTo(5, -22); c.moveTo(-5, -16); c.lineTo(5, -16); c.stroke(); }
  } },
  vent: { name: 'Fumarola', w: 1, h: 4, draw(c, h, t) {
    c.fillStyle = '#4a2a20'; c.beginPath(); c.moveTo(-14, 0); c.lineTo(-7, -14); c.lineTo(7, -14); c.lineTo(14, 0); c.fill();
    for (let i = 0; i < 5; i++) {
      const ph = ((t * 0.7 + i * 0.2 + h) % 1);
      c.fillStyle = `rgba(150,130,120,${0.5 * (1 - ph)})`;
      c.beginPath(); c.arc(Math.sin(ph * 6 + i) * 8, -16 - ph * 70, 6 + ph * 14, 0, TAU); c.fill();
    }
    c.fillStyle = 'rgba(255,120,40,0.7)'; c.fillRect(-4, -15, 8, 3);
  } },
  pillar: { name: 'Columna', w: 1, h: 5, draw(c) {
    c.fillStyle = '#5a5470'; c.fillRect(-9, -120, 18, 120);
    c.fillStyle = '#6d6688'; c.fillRect(-13, -126, 26, 10); c.fillRect(-13, -10, 26, 10);
  } },
  banner: { name: 'Estandarte', w: 1, h: 4, draw(c, h, t) {
    c.fillStyle = '#4a4458'; c.fillRect(-14, -100, 28, 4);
    c.fillStyle = '#8a2a3a'; c.beginPath(); c.moveTo(-11, -96); c.lineTo(11, -96); c.lineTo(11 + Math.sin(t * 2) * 2, -52); c.lineTo(0, -60); c.lineTo(-11 + Math.sin(t * 2) * 2, -52); c.fill();
    c.fillStyle = '#ffd25a'; c.beginPath(); c.arc(0, -82, 5, 0, TAU); c.fill();
  } },
  barrel: { name: 'Barril', w: 1, h: 2, draw(c) {
    c.fillStyle = '#7a5030'; c.beginPath(); c.roundRect(-12, -26, 24, 26, 5); c.fill();
    c.fillStyle = '#4a3020'; c.fillRect(-12, -20, 24, 3); c.fillRect(-12, -8, 24, 3);
  } },
  chair: { name: 'Butaca', w: 1, h: 2, draw(c) {
    c.fillStyle = '#7a1f2e'; c.fillRect(-12, -22, 24, 22); c.fillRect(-12, -40, 24, 20);
    c.fillStyle = '#c9a34a'; c.fillRect(-12, -42, 24, 3);
  } },
};

export const DECOR_IDS = Object.keys(DECOR);
const FRONT = new Set(['bush']);

export function drawDecor(ctx, world, cam, t, layer) {
  const list = world.decor;
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    const def = DECOR[d.type];
    if (!def) continue;
    const front = FRONT.has(d.type) && hash2(d.x, d.y) > 0.5;
    if ((layer === 'front') !== front) continue;
    const x = d.x * TILE + TILE / 2 - cam.x, y = (d.y + 1) * TILE - cam.y;
    if (x < -150 || x > VIEW_W + 150 || y < -40 || y > VIEW_H + 260) continue;
    ctx.save();
    ctx.translate(x, y);
    def.draw(ctx, hash2(d.x, d.y, 3), t);
    ctx.restore();
  }
}
