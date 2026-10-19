// Render híbrido: cada elemento se dibuja en SLOTS con nombre (legs, torso, arm, head, weapon, fx, …).
// Cada slot tiene un fallback procedural (formas 2D) y un sprite opcional definido en un atlas JSON.
// Las mecánicas calculan la pose igual con o sin sprite: aquí solo se decide QUÉ se pinta.
import { CONFIG } from '../config.js';

const hasDOM = typeof Image !== 'undefined' && typeof fetch !== 'undefined' && typeof location !== 'undefined';

/*
Formato del atlas (assets/sprites/atlas.json, o varios listados en assets/sprites/index.json):
{
  "image": "swordsman.png",
  "sprites": [
    { "owner": "swordsman", "slot": "torso", "anim": "idle",      // anim es opcional ("*" = cualquiera)
      "frames": [[x,y,w,h], [x,y,w,h]], "anchor": [0.5, 0.9],    // anclaje normalizado dentro del frame
      "fps": 8, "loop": true, "offset": [0,0], "rot": 0, "scale": 1, "z": 0 } ]
}
Claves de búsqueda: owner.slot.anim → owner.slot → *.slot.anim → *.slot
*/

export class SpriteSystem {
  constructor() {
    this.defs = new Map();
    this.images = new Map();
    this.loaded = 0;
    this.base = 'assets/sprites/';
    this.status = 'sin cargar';
    this.slotMode = {}; // 'owner.slot' -> 'shape' | 'sprite' (fuerza por slot); vacío = automático
  }
  get mode() { return CONFIG.render.mode; }

  async reload() {
    this.defs.clear(); this.images.clear(); this.loaded = 0;
    if (!hasDOM) { this.status = 'sin DOM'; return 0; }
    let files = [];
    try {
      const r = await fetch(this.base + 'index.json', { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); files = j.atlases || j; }
    } catch (e) { /* sin índice */ }
    if (!files.length) {
      try {
        const r = await fetch(this.base + 'atlas.json', { cache: 'no-store' });
        if (r.ok) files = ['atlas.json'];
      } catch (e) { /* sin atlas */ }
    }
    for (const f of files) {
      try { await this.loadAtlas(f); } catch (e) { console.warn('Atlas no válido', f, e); }
    }
    this.status = this.loaded ? `${this.loaded} sprites` : 'sin sprites';
    return this.loaded;
  }

  async loadAtlas(file, json) {
    json = json || (await (await fetch(this.base + file, { cache: 'no-store' })).json());
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('imagen ' + json.image));
      i.src = (json.image.startsWith('data:') || json.image.startsWith('http') ? '' : this.base) + json.image;
    });
    for (const s of json.sprites || []) {
      const key = [s.owner || '*', s.slot, s.anim || ''].filter((x, i) => i < 2 || x).join('.');
      this.defs.set(key, { ...s, img, scale: s.scale ?? 1, anchor: s.anchor || [0.5, 0.5], fps: s.fps ?? 8, loop: s.loop !== false, offset: s.offset || [0, 0], rot: s.rot || 0, z: s.z ?? 0 });
      this.loaded++;
    }
  }

  find(owner, slot, anim) {
    if (!this.defs.size) return null;
    return (anim && this.defs.get(`${owner}.${slot}.${anim}`)) || this.defs.get(`${owner}.${slot}`) ||
      (anim && this.defs.get(`*.${slot}.${anim}`)) || this.defs.get(`*.${slot}`) || null;
  }
  has(owner, slot, anim) { return !!this.find(owner, slot, anim); }

  /**
   * Dibuja un slot. xf = { x, y, rot, sx, sy, alpha }. fallback(ctx) dibuja la forma procedural en
   * coordenadas locales del slot. Devuelve true si se usó sprite.
   */
  slot(ctx, owner, slot, anim, time, xf, fallback) {
    const mode = this.mode;
    const forced = this.slotMode[`${owner}.${slot}`];
    const def = mode === 'shapes' && forced !== 'sprite' ? null : forced === 'shape' ? null : this.find(owner, slot, anim);
    ctx.save();
    ctx.translate(xf.x || 0, xf.y || 0);
    if (xf.rot) ctx.rotate(xf.rot);
    if (xf.sx !== undefined || xf.sy !== undefined) ctx.scale(xf.sx ?? 1, xf.sy ?? 1);
    if (xf.alpha !== undefined) ctx.globalAlpha *= xf.alpha;
    if (!def) {
      fallback && fallback(ctx);
    } else {
      if (mode === 'mixed' && fallback) {
        ctx.save(); ctx.globalAlpha *= 0.35; fallback(ctx); ctx.restore();
      }
      this.drawDef(ctx, def, time);
    }
    ctx.restore();
    return !!def;
  }

  drawDef(ctx, def, time) {
    const n = def.frames.length;
    let i = Math.floor(time * def.fps);
    i = def.loop ? i % n : Math.min(n - 1, i);
    const [fx, fy, fw, fh] = def.frames[Math.max(0, i)];
    ctx.save();
    ctx.translate(def.offset[0], def.offset[1]);
    if (def.rot) ctx.rotate(def.rot);
    ctx.scale(def.scale, def.scale);
    ctx.imageSmoothingEnabled = def.smooth !== false ? true : false;
    ctx.drawImage(def.img, fx, fy, fw, fh, -fw * def.anchor[0], -fh * def.anchor[1], fw, fh);
    ctx.restore();
  }

  /** Dibuja una lista de slots ordenada por z (el z del sprite, si existe, sustituye al del slot). */
  slots(ctx, owner, anim, time, list) {
    const ordered = list.map((s, i) => {
      const d = this.mode !== 'shapes' ? this.find(owner, s.slot, anim) : null;
      return { s, z: (d && d.z !== undefined && d.z !== 0 ? d.z : s.z ?? i) };
    }).sort((a, b) => a.z - b.z);
    for (const { s } of ordered) this.slot(ctx, owner, s.slot, anim, time, s.xf || {}, s.fb);
  }

  describe() {
    return { mode: this.mode, sprites: this.loaded, status: this.status };
  }
}

export const sprites = new SpriteSystem();
