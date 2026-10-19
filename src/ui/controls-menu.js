// Pantalla de controles: teclado (hasta 3 teclas por acción), mandos (perfil por defecto + perfil propio) y táctil.
import { h } from './dom.js';
import { ACTIONS, ACTION_LABELS, controls, keyLabel, padFamily, padLabel, FAMILY_NAMES } from '../controls.js';
import { Store } from '../storage.js';
import { platform } from '../platform.js';
import { audio } from '../audio.js';

export function controlsScreen(menus) {
  const app = menus.app;
  const input = app.input;
  let tab = controls.device === 'gamepad' ? 'pad' : controls.device === 'touch' ? 'touch' : 'keys';
  let padSel = 'default';
  let listening = null; // {action, slot}
  let raf = 0;

  const body = h('div', { class: 'scroll', style: { maxWidth: '620px', minHeight: '300px' } });
  const tabs = h('div', { class: 'tabs' });
  const el = h('div', { class: 'screen solid' },
    h('h2', null, 'Controles'),
    tabs, body,
    h('div', { class: 'row', style: { marginTop: '10px' } },
      h('button', { class: 'back', onClick: () => { cancel(); stop(); menus.pop(); } }, '← Volver')));

  const stop = () => cancelAnimationFrame(raf);
  const cancel = () => { input.capture = null; listening = null; };

  function render() {
    tabs.innerHTML = '';
    for (const [id, l] of [['keys', '⌨ Teclado'], ['pad', '🎮 Mando'], ['touch', '👆 Táctil']]) {
      tabs.append(h('button', { class: tab === id ? 'active' : '', onClick: () => { cancel(); tab = id; render(); } }, l));
    }
    body.innerHTML = '';
    if (tab === 'keys') renderKeys();
    else if (tab === 'pad') renderPad();
    else renderTouch();
  }

  // ---------- teclado ----------
  function renderKeys() {
    body.append(h('p', { class: 'sub' }, 'Clic en una casilla y pulsa una tecla · Esc cancela · Supr / clic derecho borra · si la tecla ya tenía acción, se mueve.'));
    for (const a of ACTIONS) {
      const row = h('div', { class: 'bindrow' + (listening && listening.action === a ? ' listening' : '') }, h('span', null, ACTION_LABELS[a]));
      const slots = h('div', { class: 'slots' });
      for (let s = 0; s < 3; s++) {
        const code = controls.keys[a][s];
        const listen = listening && listening.action === a && listening.slot === s;
        const b = h('div', { class: 'slot' + (code ? '' : ' empty') + (listen ? ' listen' : ''), tabindex: 0,
          onClick: () => beginKey(a, s),
          onContextmenu: (e) => { e.preventDefault(); if (code) { controls.clearKey(a, s); render(); } } },
        listen ? 'pulsa tecla…' : code ? keyLabel(code) : '—');
        slots.append(b);
      }
      row.append(slots);
      body.append(row);
    }
    body.append(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } }, h('button', { class: 'small', onClick: () => { controls.resetKeys(); render(); } }, 'Restaurar teclado')));
  }
  function beginKey(action, slot) {
    cancel();
    listening = { action, slot };
    input.capture = (ev) => {
      listening = null;
      if (ev.type === 'key') {
        if (ev.code === 'Escape') { render(); return; }
        if (ev.code === 'Delete' || ev.code === 'Backspace') { controls.clearKey(action, slot); render(); return; }
        controls.setKey(action, ev.code, slot < controls.keys[action].length ? slot : -1);
        audio.sfx('ok');
      }
      render();
    };
    render();
  }

  // ---------- mandos ----------
  function renderPad() {
    const pads = platform.getGamepads();
    body.append(h('p', { class: 'sub' }, pads.length ? `${pads.length} mando(s) conectado(s): todos controlan al personaje a la vez.` : 'Pulsa un botón de tu mando para detectarlo.'));
    const sel = h('select', { onChange: (e) => { cancel(); padSel = e.target.value; render(); } },
      h('option', { value: 'default' }, 'Perfil por defecto'),
      pads.map((p) => h('option', { value: p.id }, `${FAMILY_NAMES[padFamily(p.id)]} · ${p.id.slice(0, 34)}`)));
    sel.value = padSel;
    body.append(h('label', { class: 'opt' }, 'Perfil a editar', sel));
    const fam = padSel === 'default' ? padFamily(pads[0] ? pads[0].id : '') : padFamily(padSel);
    const prof = padSel === 'default' ? controls.pad.default : controls.padProfile(padSel);
    body.append(h('p', { class: 'sub' }, `Iconos de: ${FAMILY_NAMES[fam]}. ${padSel !== 'default' && !controls.pad.byId[padSel] ? 'Al reasignar se crea un perfil propio para este mando.' : ''}`));
    for (const a of ACTIONS) {
      const b = (prof[a] || []);
      const lis = listening && listening.action === a;
      const row = h('div', { class: 'bindrow' + (lis ? ' listening' : '') }, h('span', null, ACTION_LABELS[a]),
        h('div', { class: 'slots' },
          h('div', { class: 'slot' + (b.length ? '' : ' empty') + (lis ? ' listen' : ''), tabindex: 0, onClick: () => beginPad(a) }, lis ? 'pulsa botón / mueve stick…' : b.length ? b.map((x) => padLabel(fam, x)).join(' · ') : '—')));
      body.append(row);
    }
    body.append(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } },
      h('button', { class: 'small', onClick: () => { controls.resetPad(padSel === 'default' ? '' : padSel); render(); } }, 'Restaurar perfil'),
      h('button', { class: 'small', onClick: () => input.rumble(300, 0.8, 0.8) }, 'Probar vibración')));
    body.append(h('div', { class: 'status', id: 'padlive', style: { marginTop: '8px', color: '#8b94aa', fontSize: '12px', textAlign: 'center' } }, '—'));
  }
  function beginPad(action) {
    cancel();
    listening = { action };
    input.capture = (ev) => {
      listening = null;
      if (ev.type === 'pad') {
        const useId = padSel === 'default' ? '' : padSel;
        controls.setPad(useId || ev.id, action, ev.binding, padSel !== 'default');
        audio.sfx('ok');
      } else if (ev.type === 'key' && ev.code !== 'Escape') { /* ignora teclas */ }
      render();
    };
    render();
  }

  // ---------- táctil ----------
  function renderTouch() {
    const S = Store.data.settings;
    const sel = h('select', { onChange: (e) => { S.touch = e.target.value; Store.save(); } },
      h('option', { value: 'auto' }, 'Automático'), h('option', { value: 'always' }, 'Siempre'), h('option', { value: 'never' }, 'Nunca'));
    sel.value = S.touch;
    const sz = h('input', { type: 'range', min: 0.7, max: 1.4, step: 0.05, value: S.touchSize, onInput: (e) => { S.touchSize = Number(e.target.value); Store.save(); } });
    const op = h('input', { type: 'range', min: 0.2, max: 1, step: 0.05, value: S.touchOpacity, onInput: (e) => { S.touchOpacity = Number(e.target.value); Store.save(); } });
    body.append(
      h('p', { class: 'sub' }, 'Joystick flotante en la mitad izquierda · botones a la derecha · multitáctil. ESCUDO y EXPLOSIÓN son atajos ↓/↑ + MAGIA; ESPECIAL usa la habilidad del personaje.'),
      h('label', { class: 'opt' }, 'Mostrar controles táctiles', sel),
      h('label', { class: 'opt' }, 'Tamaño de botones', sz),
      h('label', { class: 'opt' }, 'Opacidad', op),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } }, h('button', { onClick: () => platform.toggleFullscreen(document.getElementById('stage')) }, '⛶ Pantalla completa (bloquea horizontal)')));
  }

  // actualización en vivo del probador de mando
  function live() {
    raf = requestAnimationFrame(live);
    const n = document.getElementById('padlive');
    if (!n) return;
    const pads = input.rawPads || [];
    if (!pads.length) { n.textContent = 'Sin mandos detectados'; return; }
    n.textContent = pads.map((p, i) => {
      const fam = padFamily(p.id);
      const on = [];
      p.buttons.forEach((b, k) => { if (b.pressed) on.push(padLabel(fam, k)); });
      p.axes.slice(0, 4).forEach((v, k) => { if (Math.abs(v) > 0.5) on.push(padLabel(fam, `a${k}${v > 0 ? '+' : '-'}`)); });
      return `Mando ${i + 1} (${FAMILY_NAMES[fam]}): ${on.join(' ') || '—'}`;
    }).join('   |   ');
  }
  live();
  render();
  const obs = new MutationObserver(() => { if (!el.isConnected) { stop(); cancel(); obs.disconnect(); } });
  obs.observe(document.getElementById('ui'), { childList: true });
  return el;
}
