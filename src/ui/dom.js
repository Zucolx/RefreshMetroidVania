// Ayudantes mínimos para construir DOM sin dependencias.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export function toast(msg, ms = 1800) {
  const t = h('div', { class: 'toast' }, msg);
  (document.getElementById('frame') || document.body).append(t);
  setTimeout(() => t.remove(), ms);
}
export function download(name, text, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function pickFile(accept = '.json') {
  return new Promise((res) => {
    const i = h('input', { type: 'file', accept });
    i.onchange = () => {
      const f = i.files[0];
      if (!f) return res(null);
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsText(f);
    };
    i.click();
  });
}
