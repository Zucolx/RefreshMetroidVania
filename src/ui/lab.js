// Panel del laboratorio (Tab): deslizadores de física, salto, salto alto, dash, espada, magia y enemigos,
// toggles (invencible, maná infinito, hitboxes, congelar, reaparición, monedas, meditación, formas/sprites/mixto),
// generar/matar/revivir enemigos, teletransporte, amuletos y copiar/descargar el JSON de configuración.
import { h } from './dom.js';
import { CONFIG, TUNABLES, TOGGLES, getConfig, setConfig, configOverrides, applyOverrides, resetConfig, DEFAULTS } from '../config.js';
import { getPath } from '../util.js';
import { Store } from '../storage.js';
import { ENEMY_META } from '../enemies/index.js';
import { AMULETS, AMULET_IDS } from '../items.js';
import { KIT_ORDER, createKit } from '../characters/index.js';
import { sprites } from '../render/hybrid.js';
import { controls } from '../controls.js';
import { audio } from '../audio.js';
import { download, pickFile, toast } from './dom.js';
import { TILE } from '../config.js';

export class LabPanel {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('lab');
    this.visible = false;
    this.built = false;
    this.timer = 0;
    this.saveT = 0;
  }
  get game() { return this.app.game; }

  toggle(force) {
    const show = force === undefined ? !this.visible : !!force;
    if (show === this.visible) return;
    this.visible = show;
    if (show) { this.build(); this.el.classList.remove('hidden'); this.timer = setInterval(() => this.tick(), 200); this.tick(); }
    else this.hide();
    this.app.input.clear();
  }
  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
    clearInterval(this.timer);
  }

  persist() {
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => Store.save(), 250);
  }

  build() {
    const el = this.el;
    el.innerHTML = '';
    const mk = (...k) => h('div', { class: 'grp' }, ...k);
    const section = (t) => h('h3', null, t);
    // estado en vivo
    this.live = h('div', { class: 'status', style: { fontFamily: 'ui-monospace, monospace', fontSize: '11px' } });
    el.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h2', null, '🧪 Laboratorio'), h('button', { class: 'small', onClick: () => this.app.toggleLab(false) }, '✕ Cerrar')));
    el.append(this.live);

    // ---- render híbrido ----
    el.append(section('Dibujo (formas / sprites)'));
    const sel = h('select', { onChange: () => { CONFIG.render.mode = sel.value; this.persist(); } },
      h('option', { value: 'shapes' }, 'Formas'), h('option', { value: 'sprites' }, 'Sprites'), h('option', { value: 'mixed' }, 'Mixto'));
    sel.value = CONFIG.render.mode;
    this.spriteInfo = h('span', { class: 'status' }, sprites.status);
    el.append(mk(h('div', { class: 'row' }, sel, h('button', { class: 'small', onClick: async () => { this.spriteInfo.textContent = 'cargando…'; const n = await sprites.reload(); this.spriteInfo.textContent = n ? `${n} sprites` : 'sin sprites (assets/sprites/)'; toast(n ? `Sprites recargados: ${n}` : 'No hay sprites en assets/sprites/'); } }, '↻ Recargar sprites'), this.spriteInfo)));

    // ---- toggles ----
    el.append(section('Interruptores'));
    for (const tg of TOGGLES) {
      const c = h('input', { type: 'checkbox', onChange: () => { setConfig(tg.path, c.checked); this.persist(); } });
      c.checked = !!getConfig(tg.path);
      el.append(h('label', { class: 'opt', style: { padding: '1px 0', fontSize: '12px' } }, tg.label, c));
    }

    // ---- deslizadores ----
    const groups = new Map();
    for (const t of TUNABLES) { if (!groups.has(t.group)) groups.set(t.group, []); groups.get(t.group).push(t); }
    this.sliders = [];
    for (const [g, list] of groups) {
      el.append(section(g));
      for (const t of list) {
        const val = getConfig(t.path);
        const out = h('output', null, String(val));
        const inp = h('input', { type: 'range', min: t.min, max: t.max, step: t.step, value: val,
          onInput: () => { const v = Number(inp.value); setConfig(t.path, v); out.textContent = String(v); this.persist(); },
          onChange: () => inp.blur(), onPointerup: () => inp.blur() });
        const reset = h('button', { class: 'small', title: 'Valor por defecto', style: { padding: '0 4px' }, onClick: () => { const d = getPath(DEFAULTS, t.path); setConfig(t.path, d); inp.value = d; out.textContent = String(d); this.persist(); } }, '↺');
        el.append(h('div', { class: 'trow', title: t.path }, h('span', null, t.label), inp, h('span', { class: 'row', style: { gap: '2px' } }, out, reset)));
        this.sliders.push({ t, inp, out });
      }
    }

    // ---- personajes ----
    el.append(section('Equipo'));
    const team = h('div', { class: 'btns' });
    for (const id of KIT_ORDER) {
      team.append(h('button', { onClick: () => this.makeLead(id) }, createKit(id).name));
    }
    el.append(mk(team));
    el.append(mk(h('div', { class: 'btns' },
      h('button', { onClick: () => { const p = this.game.player; p.team.forEach((m) => { m.hp = m.maxHp; m.ko = false; }); p.mana = CONFIG.mana.max; } }, '❤ Curar todo'),
      h('button', { onClick: () => { this.game.player.mana = CONFIG.mana.max; } }, '💧 Maná'),
      h('button', { onClick: () => { this.game.player.switchCd = 0; Object.values(this.game.player.team).forEach((m) => { m.kit.cd = {}; }); } }, '⏱ Reiniciar cooldowns'))));

    // ---- enemigos ----
    el.append(section('Enemigos'));
    const biomes = new Map();
    for (const [id, m] of Object.entries(ENEMY_META)) { if (!biomes.has(m.biome)) biomes.set(m.biome, []); biomes.get(m.biome).push([id, m]); }
    const sp = h('select', null, [...biomes].map(([b, list]) => h('optgroup', { label: b }, list.map(([id, m]) => h('option', { value: id }, m.label)))));
    this.spawnSel = sp;
    el.append(mk(h('div', { class: 'btns' }, sp, h('button', { onClick: () => this.spawn(sp.value) }, '＋ Generar'), h('button', { onClick: () => this.spawnAll() }, '＋ Uno de cada'))));
    el.append(mk(h('div', { class: 'btns' },
      h('button', { onClick: () => this.killAll() }, '☠ Matar (sin monedas)'),
      h('button', { onClick: () => this.reviveAll() }, '↺ Revivir todos'),
      h('button', { onClick: () => { this.game.enemies = this.game.enemies.filter((e) => !e.temp); } }, 'Quitar invocados'))));

    // ---- teletransporte ----
    el.append(section('Teletransporte'));
    this.tpBox = h('div', { class: 'btns' });
    el.append(mk(this.tpBox));
    this.refreshTp();

    // ---- amuletos ----
    el.append(section('Amuletos'));
    this.amuBox = h('div');
    el.append(this.amuBox);
    this.refreshAmu();
    el.append(mk(h('div', { class: 'btns' },
      h('button', { onClick: () => { AMULET_IDS.forEach((a) => Store.give(a)); this.refreshAmu(); } }, 'Dar todos'),
      h('button', { onClick: () => { AMULET_IDS.forEach((a) => Store.remove(a)); this.refreshAmu(); } }, 'Quitar todos'),
      h('button', { class: 'danger', onClick: () => { Store.resetProgress(); this.refreshAmu(); toast('Progreso reiniciado'); } }, 'Reiniciar progreso'))));

    // ---- JSON ----
    el.append(section('Configuración (JSON)'));
    el.append(mk(h('div', { class: 'btns' },
      h('button', { onClick: async () => { const j = JSON.stringify(configOverrides(), null, 2); try { await navigator.clipboard.writeText(j); toast('JSON copiado'); } catch (e) { window.prompt('Copia el JSON:', j); } } }, 'Copiar JSON'),
      h('button', { onClick: () => download('lab-config.json', JSON.stringify({ config: configOverrides(), render: CONFIG.render.mode }, null, 2)) }, 'Descargar JSON'),
      h('button', { onClick: async () => { const t = await pickFile('.json'); if (!t) return; try { const j = JSON.parse(t); applyOverrides(j.config || j); Store.save(); this.build(); toast('Configuración cargada'); } catch (e) { toast('JSON no válido'); } } }, 'Cargar JSON'),
      h('button', { class: 'danger', onClick: () => { resetConfig(); Store.save(); this.build(); toast('Valores por defecto'); } }, 'Restaurar todo'))));
    el.append(h('p', { class: 'status' }, `Tab abre/cierra · dispositivo: ${controls.device}`));
  }

  refreshTp() {
    if (!this.tpBox) return;
    this.tpBox.innerHTML = '';
    const g = this.game, w = g.world;
    if (!w) return;
    const go = (x, y) => { const p = g.player; p.tpTo(x, y); p.snap(); g.cam.x = x - 480; g.cam.y = y - 300; };
    this.tpBox.append(h('button', { onClick: () => go(g.spawn.x, g.spawn.y) }, 'Último guardado'));
    this.tpBox.append(h('button', { onClick: () => go(w.start.x * TILE + 16, (w.start.y + 1) * TILE) }, 'Inicio'));
    g.checkpoints.forEach((c, i) => this.tpBox.append(h('button', { onClick: () => go(c.x, c.y) }, `CP ${i + 1}`)));
    if (g.exitObj) this.tpBox.append(h('button', { onClick: () => go(g.exitObj.x - 60, g.exitObj.y) }, 'Salida'));
    g.pickups.forEach((k) => { if (!k.taken) this.tpBox.append(h('button', { onClick: () => go(k.x, k.y) }, AMULETS[k.type].icon + ' ' + AMULETS[k.type].short)); });
  }
  refreshAmu() {
    if (!this.amuBox) return;
    this.amuBox.innerHTML = '';
    for (const id of AMULET_IDS) {
      const a = AMULETS[id];
      const own = Store.has(id), eq = Store.equipped(id);
      this.amuBox.append(h('div', { class: 'row', style: { justifyContent: 'space-between', margin: '2px 0' } },
        h('span', { style: { color: a.color } }, `${a.icon} ${a.short}`),
        h('span', { class: 'btns' },
          h('button', { class: own ? 'on' : '', onClick: () => { own ? Store.remove(id) : Store.give(id); this.refreshAmu(); } }, own ? 'Poseído' : 'Dar'),
          h('button', { class: eq ? 'on' : '', disabled: !own, onClick: () => { Store.toggleEquip(id); this.refreshAmu(); } }, eq ? 'Equipado' : 'Equipar'))));
    }
  }

  // ---------- acciones ----------
  makeLead(id) {
    const p = this.game.player;
    const i = p.team.findIndex((m) => m.id === id);
    if (i >= 0) { p.team[i].ko = false; if (p.team[i].hp <= 0) p.team[i].hp = p.team[i].maxHp; if (i !== p.idx) p.switchTo(i, false, false); }
    else {
      // sustituye al activo por el personaje pedido
      const team = p.team.map((m) => m.id);
      team[p.idx] = id;
      const pos = { x: p.cx, y: p.feetY };
      p.setTeam(team); p.idx = team.indexOf(id);
      p.resetState(); p.tpTo(pos.x, pos.y);
      Store.data.team = team.slice(); Store.save();
    }
    toast(`Activo: ${p.kit.name}`);
  }
  spawn(type) {
    const g = this.game, p = g.player;
    const meta = ENEMY_META[type] || {};
    const tx = Math.floor((p.cx + p.facing * 110) / TILE);
    let ty = Math.floor(p.cy / TILE);
    if (meta.ceil) { const c = g.world.ceilingAbove(tx * TILE + 16, p.cy, 600); ty = c === null ? ty - 5 : Math.floor(c / TILE); }
    else if (meta.fly) ty = Math.floor((p.y - 90) / TILE);
    else { const f = g.world.floorBelow(tx * TILE + 16, p.cy - 40, 600); ty = f === null ? ty : Math.floor(f / TILE) - 1; }
    const e = g.spawnEnemy({ type, x: tx, y: ty });
    if (e) { e.noRespawn = false; e.spec.lab = true; }
  }
  spawnAll() {
    const ids = Object.keys(ENEMY_META);
    const g = this.game, p = g.player;
    ids.forEach((id, i) => {
      const meta = ENEMY_META[id] || {};
      const tx = Math.floor((p.cx + (60 + i * 52) * p.facing) / TILE);
      let ty = Math.floor(p.cy / TILE);
      if (meta.ceil) { const c = g.world.ceilingAbove(tx * TILE + 16, p.cy, 600); ty = c === null ? ty - 5 : Math.floor(c / TILE); }
      else if (meta.fly) ty = Math.floor((p.y - 90) / TILE);
      else { const f = g.world.floorBelow(tx * TILE + 16, p.cy - 40, 600); ty = f === null ? ty : Math.floor(f / TILE) - 1; }
      g.spawnEnemy({ type: id, x: tx, y: ty });
    });
  }
  killAll() {
    const g = this.game;
    for (const e of g.enemies) {
      if (e.dead) continue;
      e.noCoins = true; // los eliminados con herramientas del laboratorio no sueltan monedas
      e.dying = 0; e.hp = 0; e.dead = true; e.respawnT = CONFIG.enemies.respawnTime;
      g.fx.burst(e.cx, e.cy, 8, '#ffffff', 160, 0.4, 3);
    }
    g.projectiles = g.projectiles.filter((p) => p.team !== 'enemy');
  }
  reviveAll() {
    for (const e of this.game.enemies) if (e.dead) e.respawn(this.game);
  }

  // ---------- estado en vivo ----------
  tick() {
    if (!this.visible || !this.game.player) return;
    const g = this.game, p = g.player;
    const alive = g.enemies.filter((e) => !e.dead).length;
    this.live.innerHTML = '';
    const rows = [
      `${p.kit.name} · HP ${Math.ceil(p.hp)}/${p.maxHp} · maná ${p.mana.toFixed(1)}`,
      `vel (${p.vx.toFixed(0)}, ${p.vy.toFixed(0)}) · suelo ${p.onGround ? 'sí' : 'no'} · sprint ${p.sprint.on ? '×' + p.sprintMul().toFixed(2) + (p.sprint.charges ? ' c' + p.sprint.charges : '') : '—'}`,
      `reposo: ${p.idleState || '—'}${p.idle.kind && p.idleState === 'flavor' ? ' (' + p.idle.kind + ')' : ''} · meditando: ${p.meditating ? 'sí' : 'no'} · quieto ${p.stillT.toFixed(1)} s`,
      `enemigos ${alive}/${g.enemies.length} · proyectiles ${g.projectiles.length} · monedas ${Store.data.coins}`,
      `entrada: ${controls.device} · sprites: ${sprites.status} · modo: ${CONFIG.render.mode}`,
    ];
    rows.forEach((r) => this.live.append(h('div', null, r)));
    // sincroniza deslizadores que puedan haber cambiado por JSON
    for (const s of this.sliders || []) {
      const v = getConfig(s.t.path);
      if (String(s.inp.value) !== String(v) && document.activeElement !== s.inp) { s.inp.value = v; s.out.textContent = String(v); }
    }
  }
}
void audio; void ENEMY_META;
