import { stateOf, VIS, type Text } from './store';
import { fmt } from './util';

type Attrs = Record<string, string | boolean | number | null | undefined | ((e: Event) => void)>;
type Kid = Node | string | null | undefined | false | Kid[];

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = String(v);
      else if (k === 'text') e.textContent = String(v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, String(v));
    }
  }
  const add = (kid: Kid): void => {
    if (Array.isArray(kid)) kid.forEach(add);
    else if (kid != null && kid !== false) e.append(kid);
  };
  kids.forEach(add);
  return e;
}

export function copy(text: string, el: HTMLElement, ok: string): void {
  const bad = 'No se pudo copiar aquí. Selecciona el texto y cópialo a mano.';
  try {
    navigator.clipboard.writeText(text).then(() => { el.textContent = ok; }, () => { el.textContent = bad; });
  } catch { el.textContent = bad; }
}

export function chip(t: Text): HTMLSpanElement {
  const st = stateOf(t);
  return h('span', { class: 'chip ' + st, text: VIS[st].name + (st === 'scheduled' ? ' · ' + fmt(t.publishAt) : '') });
}

/** Limpieza de lo que crea cada vista (WebGL, listeners). */
let cleanup: (() => void) | null = null;
export function setCleanup(fn: (() => void) | null): void {
  if (cleanup) { try { cleanup(); } catch { /* ignorar */ } }
  cleanup = fn;
}
export function addCleanup(fn: () => void): void {
  const prev = cleanup;
  cleanup = () => { fn(); if (prev) prev(); };
}
