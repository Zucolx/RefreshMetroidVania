// HUD en canvas: minimapa, equipo, maná, monedas, especial y ayuda.
import { CONFIG, TILE, VIEW_W, VIEW_H } from './config.js';
import { T } from './world.js';
import { Store } from './storage.js';
import { controls } from './controls.js';
import { AMULETS } from './items.js';
import { clamp, TAU } from './util.js';

const KIT_COLORS = { swordsman: '#6fa8ff', mage: '#c79bff', artificer: '#ffb36a', alchemist: '#8dff8d', puppeteer: '#d98cff', clockmaker: '#e8c27a' };

function panel(ctx, x, y, w, h, a = 0.62) {
  ctx.fillStyle = `rgba(8,10,20,${a})`;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
}

export function drawHud(ctx, g, t) {
  const p = g.player;
  if (!p) return;
  drawMinimap(ctx, g, 10, 10, 180, 104, t);
  // monedas
  panel(ctx, 10, 120, 100, 24);
  ctx.fillStyle = '#d9e0ee'; ctx.beginPath(); ctx.arc(26, 132, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7e8aa0'; ctx.beginPath(); ctx.arc(26, 132, 3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(String(Store.data.coins), 40, 133);
  drawTeam(ctx, g, p, t);
  drawMana(ctx, p, t);
  drawSpecial(ctx, p);
  drawStatusIcons(ctx, g, p);
  drawBanners(ctx, g);
  if (!(controls.device === 'touch')) drawHelp(ctx);
}

function drawTeam(ctx, g, p, t) {
  const n = p.team.length;
  const cw = 132, gap = 6;
  const x0 = (VIEW_W - (n * cw + (n - 1) * gap)) / 2 + 40;
  p.team.forEach((m, i) => {
    const x = x0 + i * (cw + gap), y = 10;
    const act = i === p.idx;
    panel(ctx, x, y, cw, act ? 46 : 38, act ? 0.8 : 0.55);
    if (act) { ctx.strokeStyle = KIT_COLORS[m.id] || '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, cw, 46, 6); ctx.stroke(); }
    // retrato
    ctx.fillStyle = KIT_COLORS[m.id] || '#888';
    ctx.globalAlpha = m.ko ? 0.35 : 1;
    ctx.beginPath(); ctx.arc(x + 17, y + 20, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = m.kit.pal.skin; ctx.beginPath(); ctx.arc(x + 17, y + 18, 6.5, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (m.ko) {
      ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x + 8, y + 11); ctx.lineTo(x + 26, y + 29); ctx.moveTo(x + 26, y + 11); ctx.lineTo(x + 8, y + 29); ctx.stroke();
    }
    ctx.fillStyle = '#e6ecf8'; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(m.kit.name, x + 34, y + 14);
    // vida
    const bw = cw - 42;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 34, y + 19, bw, 7);
    const f = clamp(m.hp / m.maxHp, 0, 1);
    ctx.fillStyle = f > 0.5 ? '#5fd35f' : f > 0.25 ? '#e8c34a' : '#e5504a';
    ctx.fillRect(x + 34, y + 19, bw * f, 7);
    ctx.fillStyle = '#cfd6e6'; ctx.font = '10px system-ui'; ctx.fillText(`${Math.ceil(m.hp)}/${m.maxHp}`, x + 34, y + 36);
    // cooldown de cambio
    if (!act && p.switchCd > 0 && !m.ko) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, cw * (p.switchCd / CONFIG.team.switchCooldown), 38);
    }
    ctx.fillStyle = '#8b94aa'; ctx.font = '10px system-ui'; ctx.textAlign = 'right';
    ctx.fillText(String(i + 1), x + cw - 6, y + 14);
    ctx.textAlign = 'left';
  });
}

function drawMana(ctx, p, t) {
  const M = CONFIG.mana.max;
  const x = 200 + 40, y = 62, w = Math.min(320, M * 16), h = 12;
  panel(ctx, x - 6, y - 6, w + 12, h + 12);
  const flash = p.manaFlash > 0 && Math.floor(t * 14) % 2 === 0;
  ctx.fillStyle = flash ? '#ff3a3a' : 'rgba(30,40,80,0.9)';
  ctx.fillRect(x, y, w, h);
  const f = clamp(p.mana / M, 0, 1);
  const gr = ctx.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, '#4a7bff'); gr.addColorStop(1, '#a98bff');
  ctx.fillStyle = flash ? '#ff7a7a' : gr; ctx.fillRect(x, y, w * f, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
  for (let i = 1; i < M; i++) { ctx.beginPath(); ctx.moveTo(x + (w / M) * i, y); ctx.lineTo(x + (w / M) * i, y + h); ctx.stroke(); }
  ctx.fillStyle = '#dfe6ff'; ctx.font = '10px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`Maná ${p.mana.toFixed(1)}`, x + w + 10, y + 10);
  if (p.meditating) { ctx.fillStyle = '#9fe8c8'; ctx.fillText('● meditando', x + w + 10, y + 24); }
}

function drawSpecial(ctx, p) {
  const info = p.kit.specialInfo(p);
  const x = VIEW_W - 190, y = 10, w = 180;
  panel(ctx, x, y, w, 40);
  ctx.fillStyle = '#e6ecf8'; ctx.font = '600 11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${controls.glyph('special')} · ${info.name}`, x + 8, y + 15);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 8, y + 22, w - 16, 8);
  ctx.fillStyle = info.frac >= 1 ? '#8dffb0' : '#e8c34a'; ctx.fillRect(x + 8, y + 22, (w - 16) * clamp(info.frac, 0, 1), 8);
  ctx.fillStyle = '#9aa4bc'; ctx.font = '10px system-ui'; ctx.fillText(info.state || '', x + 8, y + 38);
}

function drawStatusIcons(ctx, g, p) {
  const icons = [];
  const eq = Store.data.equipped;
  for (const a of eq) icons.push({ c: AMULETS[a].color, l: AMULETS[a].icon });
  if (p.shieldT > 0) icons.push({ c: '#9fd0ff', l: `🛡${p.shieldT.toFixed(0)}` });
  if (p.webbed > 0) icons.push({ c: '#eee', l: '🕸' });
  if (p.sprint.on) icons.push({ c: '#ffe27a', l: p.sprint.charges ? `»${p.sprint.charges}` : '»' });
  icons.forEach((ic, i) => {
    const x = 120 + i * 30, y = 120;
    panel(ctx, x, y, 26, 24, 0.55);
    ctx.fillStyle = ic.c; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ic.l, x + 13, y + 13);
  });
  ctx.textAlign = 'left';
}

function drawBanners(ctx, g) {
  g.banners.forEach((b, i) => {
    const a = clamp(Math.min(b.t, b.max - b.t + 0.2) * 3, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(b.text, VIEW_W / 2, 120 + i * 30);
    ctx.fillStyle = b.color; ctx.fillText(b.text, VIEW_W / 2, 120 + i * 30);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawHelp(ctx) {
  const items = [['move', ''], ['jump', 'Salto'], ['attack', 'Ataque'], ['dash', 'Dash'], ['magic', 'Magia'], ['special', 'Especial'], ['prev', 'Pers.'], ['inventory', 'Inventario'], ['lab', 'Lab']];
  let s = '';
  for (const [a, l] of items) { if (a === 'move') continue; s += `${controls.glyph(a)} ${l}   `; }
  ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(s).width + 20;
  panel(ctx, (VIEW_W - w) / 2, VIEW_H - 24, w, 18, 0.45);
  ctx.fillStyle = '#c9d2e6'; ctx.fillText(s, VIEW_W / 2, VIEW_H - 11);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------------
//  Minimapa: ventana que sigue al jugador y se revela al explorar
// ---------------------------------------------------------------------
function drawMinimap(ctx, g, x, y, w, h, t) {
  const world = g.world, p = g.player;
  panel(ctx, x, y, w, h, 0.7);
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 2, y + 2, w - 4, h - 4); ctx.clip();
  const cs = 3; // px por celda (2×2 tiles)
  const pcx = p.cx / TILE / 2, pcy = p.cy / TILE / 2;
  const ox = x + w / 2 - pcx * cs, oy = y + h / 2 - pcy * cs;
  const cols = Math.ceil(world.w / 2), rows = Math.ceil(world.h / 2);
  const c0 = Math.max(0, Math.floor(pcx - w / cs / 2) - 1), c1 = Math.min(cols - 1, Math.ceil(pcx + w / cs / 2) + 1);
  const r0 = Math.max(0, Math.floor(pcy - h / cs / 2) - 1), r1 = Math.min(rows - 1, Math.ceil(pcy + h / cs / 2) + 1);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!g.explored[r * g.exploredW + c]) continue;
      // tipo dominante de la celda
      let solid = 0, plat = 0, haz = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const tl = world.get(c * 2 + dx, r * 2 + dy);
        if (tl === T.SOLID) solid++; else if (tl === T.PLAT) plat++; else if (tl === T.SPIKE || tl === T.LAVA) haz++;
      }
      let col = 'rgba(40,60,100,0.5)';
      if (solid >= 2) col = '#7d8bb0'; else if (haz) col = '#e5604a'; else if (plat) col = '#a8b4d0';
      ctx.fillStyle = col;
      ctx.fillRect(ox + c * cs, oy + r * cs, cs, cs);
    }
  }
  const seen = (tx, ty) => g.explored[Math.floor(ty / 2) * g.exploredW + Math.floor(tx / 2)];
  for (const cp of g.checkpoints) {
    if (!seen(cp.tx, cp.ty)) continue;
    ctx.fillStyle = cp.active ? '#ffe27a' : '#c9b050';
    ctx.fillRect(ox + (cp.tx / 2) * cs - 1, oy + (cp.ty / 2) * cs - 2, 4, 5);
  }
  for (const k of g.pickups) {
    if (k.taken) continue;
    const tx = k.x / TILE, ty = k.y / TILE;
    if (!seen(tx, ty)) continue;
    ctx.fillStyle = AMULETS[k.type].color;
    ctx.save(); ctx.translate(ox + (tx / 2) * cs, oy + (ty / 2) * cs - 2); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
  }
  if (g.exitObj) {
    const tx = g.exitObj.x / TILE, ty = g.exitObj.y / TILE;
    if (seen(tx, ty)) { ctx.fillStyle = '#c79bff'; ctx.beginPath(); ctx.arc(ox + (tx / 2) * cs, oy + (ty / 2) * cs - 2, 3.4, 0, TAU); ctx.fill(); }
  }
  ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ffffff' : '#6fff9f';
  ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 2.8, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.stroke();
  if (g.world.name) { ctx.fillStyle = 'rgba(220,228,245,0.7)'; ctx.font = '9px system-ui'; ctx.textAlign = 'left'; ctx.fillText(g.world.name, x + 6, y + h - 5); }
}
