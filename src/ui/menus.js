// Pantallas DOM: menú principal, selección de nivel, equipo, ajustes, pausa, inventario, resultados y ayuda.
import { h, $ } from './dom.js';
import { CONFIG } from '../config.js';
import { Store } from '../storage.js';
import { controls, ACTIONS, ACTION_LABELS } from '../controls.js';
import { KIT_ORDER, KITS, createKit } from '../characters/index.js';
import { AMULETS, AMULET_IDS } from '../items.js';
import { LEVELS } from '../levels/index.js';
import { audio } from '../audio.js';
import { platform } from '../platform.js';
import { sprites } from '../render/hybrid.js';
import { fmtTime } from '../util.js';
import { controlsScreen } from './controls-menu.js';

export class Menus {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui');
    this.stack = [];
  }
  get active() { return !!this.root.querySelector('.screen'); }
  clear() { this.root.innerHTML = ''; this.stack = []; }
  show(el) {
    this.root.innerHTML = '';
    this.root.append(el);
    audio.sfx('menu');
    return el;
  }
  /** Superpone una pantalla sin borrar la anterior (la anterior se oculta). */
  push(el) {
    const prev = this.root.querySelector('.screen:not(.hidden)');
    if (prev) { prev.classList.add('hidden'); this.stack.push(prev); }
    this.root.append(el);
    audio.sfx('menu');
    return el;
  }
  pop() {
    const top = this.root.querySelector('.screen:not(.hidden)');
    if (top) top.remove();
    const prev = this.stack.pop();
    if (prev) { prev.classList.remove('hidden'); }
    return prev;
  }
  back(label = '← Volver') { return h('button', { class: 'back', onClick: () => this.pop() }, label); }

  // ------------------------------------------------------------------
  main() {
    const a = this.app;
    const done = Store.data.completed.length;
    const el = h('div', { class: 'screen solid' },
      h('h1', null, 'Laboratorio de mecánicas', h('br'), 'Metroidvania'),
      h('p', { class: 'sub' }, `Banco de pruebas jugable · ${platform.label} · ${done}/${LEVELS.length} niveles · ${Store.data.coins} monedas de plata`),
      h('div', { class: 'stack' },
        h('button', { class: 'primary', onClick: () => this.select() }, '▶ Jugar'),
        h('button', { onClick: () => this.team() }, '⚔ Equipo'),
        h('button', { onClick: () => a.openEditor() }, '✎ Editor de niveles'),
        h('button', { onClick: () => a.startLab() }, '🧪 Laboratorio'),
        h('button', { onClick: () => this.pushControls() }, '🎮 Controles'),
        h('button', { onClick: () => this.settings() }, '⚙ Ajustes'),
        h('button', { class: 'danger', onClick: () => this.confirmReset() }, 'Borrar progreso'),
      ),
      h('div', { class: 'footer' }, 'Teclado, mando (varios a la vez) y táctil · ', h('span', { class: 'kbd' }, controls.glyph('help')), ' ayuda'),
    );
    return this.show(el);
  }

  select() {
    const a = this.app;
    const cards = LEVELS.map((lv) => h('div', { class: 'card' + (Store.data.completed.includes(lv.id) ? ' done' : ''), tabindex: 0, onClick: () => a.startLevel(lv.id) },
      h('h3', null, lv.name), h('small', null, lv.blurb), h('small', { style: { color: AMULETS[lv.amulet]?.color || '#888', marginTop: '3px' } }, lv.amulet ? `Amuleto: ${AMULETS[lv.amulet].short}` : 'Sin amuleto')));
    const custom = Object.keys(Store.data.customLevels || {});
    const customCards = custom.map((id) => h('div', { class: 'card', tabindex: 0, onClick: () => a.startCustom(id) },
      h('h3', null, Store.data.customLevels[id].name || id), h('small', null, 'Tu nivel · tema ' + Store.data.customLevels[id].theme),
      h('button', { class: 'small danger', style: { marginTop: '6px' }, onClick: (e) => { e.stopPropagation(); delete Store.data.customLevels[id]; Store.save(); this.select(); } }, 'Borrar')));
    const el = h('div', { class: 'screen solid' },
      h('h2', null, 'Elige nivel'),
      h('div', { class: 'scroll' },
        h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } }, cards),
        custom.length ? h('h2', { style: { marginTop: '14px' } }, 'Tus niveles') : null,
        custom.length ? h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } }, customCards) : null,
      ),
      h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'back', onClick: () => this.main() }, '← Menú'),
        h('button', { onClick: () => this.team() }, `⚔ Equipo (${Store.data.team.map((id) => KIT_NAMES[id]).join(' · ')})`)),
    );
    return this.show(el);
  }

  team(after) {
    const sel = Store.data.team.slice();
    const render = () => {
      grid.innerHTML = '';
      KIT_ORDER.forEach((id) => {
        const kit = createKit(id);
        const idx = sel.indexOf(id);
        grid.append(h('div', { class: 'card' + (idx >= 0 ? ' sel' : ''), tabindex: 0, onClick: () => {
          const i = sel.indexOf(id);
          if (i >= 0) { if (sel.length > 1) sel.splice(i, 1); } else if (sel.length < 3) sel.push(id); else { sel.shift(); sel.push(id); }
          Store.data.team = sel.slice(); Store.save(); render();
          audio.sfx('ok');
        } },
        idx >= 0 ? h('div', { class: 'badge' }, idx + 1) : null,
        h('h3', { style: { color: kit.pal.accent } }, kit.name), h('small', null, `${kit.maxHp} HP`), h('small', null, kit.desc)));
      });
      info.textContent = `Equipo: ${sel.map((id) => KIT_NAMES[id]).join(' → ')}`;
    };
    const grid = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } });
    const info = h('p', { class: 'sub' });
    const el = h('div', { class: 'screen solid' },
      h('h2', null, 'Equipo (hasta 3, por orden de pulsación)'), info, h('div', { class: 'scroll' }, grid),
      h('p', { class: 'footer' }, `Cambio en nivel: ${controls.glyph('prev')} / ${controls.glyph('next')} (cooldown ${CONFIG.team.switchCooldown} s) · el maná es común`),
      h('button', { class: 'back', onClick: () => (after ? after() : this.main()) }, '← Volver'));
    render();
    return this.show(el);
  }

  pushControls() {
    return this.push(controlsScreen(this));
  }

  settings(fromPause) {
    const S = Store.data.settings;
    const save = () => Store.save();
    const range = (label, get, set, min, max, step) => {
      const out = h('span', { style: { width: '38px', textAlign: 'right', color: '#ffd25a' } }, String(get()));
      const i = h('input', { type: 'range', min, max, step, value: get(), onInput: () => { set(Number(i.value)); out.textContent = i.value; save(); } });
      return h('label', { class: 'opt' }, label, h('span', { class: 'row' }, i, out));
    };
    const toggle = (label, get, set) => {
      const c = h('input', { type: 'checkbox', onChange: () => { set(c.checked); save(); } });
      c.checked = !!get();
      return h('label', { class: 'opt' }, label, c);
    };
    const select = (label, opts, get, set) => {
      const s = h('select', { onChange: () => { set(s.value); save(); } }, opts.map(([v, l]) => h('option', { value: v }, l)));
      s.value = get();
      return h('label', { class: 'opt' }, label, s);
    };
    const el = h('div', { class: 'screen solid' },
      h('h2', null, 'Ajustes'),
      h('div', { class: 'scroll', style: { maxWidth: '520px' } },
        range('Volumen', () => S.volume, (v) => { S.volume = v; audio.setVolume(v); }, 0, 1, 0.05),
        toggle('Vibración (mando / móvil)', () => S.vibration, (v) => (S.vibration = v)),
        toggle('Meditación', () => CONFIG.meditationEnabled, (v) => (CONFIG.meditationEnabled = v)),
        select('Dibujo de personajes', [['shapes', 'Formas'], ['sprites', 'Sprites'], ['mixed', 'Mixto']], () => CONFIG.render.mode, (v) => (CONFIG.render.mode = v)),
        h('div', { class: 'row', style: { justifyContent: 'flex-end', padding: '2px' } },
          h('span', { class: 'sub', style: { margin: 0, flex: 1 } }, 'Sprites: ' + sprites.status),
          h('button', { class: 'small', onClick: async (e) => { e.target.textContent = 'Cargando…'; const n = await sprites.reload(); e.target.textContent = `Recargar sprites (${n})`; } }, 'Recargar sprites')),
        select('Controles táctiles', [['auto', 'Automático'], ['always', 'Siempre'], ['never', 'Nunca']], () => S.touch, (v) => (S.touch = v)),
        range('Tamaño táctil', () => S.touchSize, (v) => (S.touchSize = v), 0.7, 1.4, 0.05),
        range('Opacidad táctil', () => S.touchOpacity, (v) => (S.touchOpacity = v), 0.2, 1, 0.05),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } },
          h('button', { onClick: () => platform.toggleFullscreen(document.getElementById('stage')) }, '⛶ Pantalla completa'),
          h('button', { onClick: () => this.pushControls() }, '🎮 Controles')),
      ),
      h('button', { class: 'back', style: { marginTop: '10px' }, onClick: () => (fromPause ? this.app.pauseMenu() : this.main()) }, '← Volver'));
    return this.show(el);
  }

  confirmReset() {
    const el = h('div', { class: 'screen' },
      h('h2', null, '¿Borrar todo el progreso?'),
      h('p', { class: 'sub' }, 'Se pierden amuletos, niveles completados y monedas. Los controles y tus niveles se conservan.'),
      h('div', { class: 'row' },
        h('button', { class: 'danger', onClick: () => { Store.resetProgress(); this.main(); } }, 'Sí, borrar'),
        h('button', { onClick: () => this.main() }, 'Cancelar')));
    return this.show(el);
  }

  pauseMenu() {
    const a = this.app;
    const el = h('div', { class: 'screen' },
      h('h2', null, 'Pausa'),
      h('div', { class: 'stack' },
        h('button', { class: 'primary', onClick: () => a.resume() }, '▶ Continuar'),
        h('button', { onClick: () => a.inventory() }, `🎒 Inventario (${controls.glyph('inventory')})`),
        h('button', { onClick: () => this.pushControls() }, '🎮 Controles'),
        h('button', { onClick: () => this.settings(true) }, '⚙ Ajustes'),
        h('button', { onClick: () => { a.resume(); a.toggleLab(true); } }, '🧪 Laboratorio'),
        h('button', { onClick: () => a.restart() }, '↺ Reintentar nivel'),
        a.fromEditor ? h('button', { onClick: () => a.backToEditor() }, '✎ Volver al editor') : null,
        h('button', { class: 'danger', onClick: () => a.toMenu() }, 'Salir al menú')));
    return this.show(el);
  }

  inventory() {
    const a = this.app;
    const p = a.game.player;
    const render = () => {
      list.innerHTML = '';
      AMULET_IDS.forEach((id) => {
        const am = AMULETS[id];
        const own = Store.has(id), eq = Store.equipped(id);
        list.append(h('div', { class: 'card' + (eq ? ' sel' : ''), style: { opacity: own ? 1 : 0.45, cursor: own ? 'pointer' : 'default' }, tabindex: 0, onClick: () => { if (own) { Store.toggleEquip(id); audio.sfx('ok'); render(); } } },
          h('h3', { style: { color: am.color } }, `${am.icon} ${own ? am.name : '???'}`),
          h('small', null, own ? am.desc : `Se consigue en: ${am.biome}`),
          own ? h('small', { style: { color: eq ? '#6fdc8c' : '#8b94aa', marginTop: '3px' } }, eq ? 'Equipado · clic para quitar' : 'Sin equipar · clic para equipar') : null));
      });
    };
    const list = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(2, 1fr)' } });
    const team = h('div', { class: 'row wrap' }, p.team.map((m) => h('span', { class: 'kbd' }, `${m.ko ? '✖ ' : ''}${m.kit.name} ${Math.ceil(m.hp)}/${m.maxHp}`)));
    const el = h('div', { class: 'screen' },
      h('h2', null, `🎒 Inventario · ${Store.data.coins} monedas de plata`), team,
      h('div', { class: 'scroll', style: { marginTop: '8px' } }, list),
      h('button', { class: 'back primary', style: { marginTop: '10px' }, onClick: () => a.resume() }, 'Cerrar'));
    render();
    return this.show(el);
  }

  complete(info) {
    const a = this.app;
    const el = h('div', { class: 'screen' },
      h('h1', null, '¡Nivel completado!'),
      h('p', { class: 'sub' }, info.name),
      h('div', { class: 'row wrap' },
        h('span', { class: 'kbd' }, `Tiempo ${fmtTime(info.time)}`), h('span', { class: 'kbd' }, `Monedas +${info.coins}`), h('span', { class: 'kbd' }, `Enemigos ${info.kills}`)),
      h('div', { class: 'stack', style: { marginTop: '16px' } },
        info.next ? h('button', { class: 'primary', onClick: () => a.startLevel(info.next) }, '▶ Siguiente nivel') : null,
        h('button', { onClick: () => a.restart() }, '↺ Repetir'),
        h('button', { onClick: () => (a.fromEditor ? a.backToEditor() : this.select()) }, a.fromEditor ? '✎ Volver al editor' : 'Elegir nivel'),
        h('button', { onClick: () => a.toMenu() }, 'Menú')));
    return this.show(el);
  }

  help() {
    const rows = ACTIONS.filter((x) => !['left', 'right', 'up', 'down'].includes(x)).map((ac) => h('div', { class: 'bindrow' }, h('span', null, ACTION_LABELS[ac]), h('span', { class: 'kbd' }, controls.glyph(ac))));
    const el = h('div', { class: 'screen' },
      h('h2', null, 'Ayuda'),
      h('p', { class: 'sub' }, `Dispositivo activo: ${controls.device === 'touch' ? 'táctil' : controls.device === 'gamepad' ? 'mando' : 'teclado'}`),
      h('div', { class: 'scroll', style: { maxWidth: '460px' } }, rows,
        h('p', { class: 'sub', style: { textAlign: 'left', marginTop: '8px' } },
          '↑ + mantener salto: salto alto (1 s / 2 s). ↓ + salto: bajar de plataformas. ↓ + magia: escudo. ↑ + magia: explosión. Quieto 3 s: meditación.')),
      h('button', { class: 'back primary', style: { marginTop: '10px' }, onClick: () => this.app.resume() }, 'Cerrar'));
    return this.show(el);
  }
}

export const KIT_NAMES = {};
for (const id of KIT_ORDER) KIT_NAMES[id] = createKit(id).name;
void KITS; void $;
