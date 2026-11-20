import { byId, data, publicTexts, save, SCENES, stateOf, ui, VIS } from '../store';
import { addCleanup, copy, h } from '../dom';
import { go } from '../router';
import { reduceMotion, two, pad } from '../util';
import { subscribeForm } from './subscribe';
import { webgl } from './page';
import { FX_KINDS, parseScore, type FxKind } from '../score';
import { heatFor, reading, trackScroll } from '../reading';
import { deliverCard, verseCard } from '../card';

export function renderPoem(app: HTMLElement, rerender: () => void): void {
  const t = byId(ui.open);
  const st = t ? stateOf(t) : null;
  // Privado y programado nunca se muestran al lector; "por enlace" solo con el enlace; la vista previa es solo de la autora.
  const allowed = !!t && (st === 'public' || (st === 'link' && ui.asLink) || ui.preview);
  const wrap = h('div', { class: 'reader' });
  if (!t || !st || !allowed) {
    wrap.append(h('div', { class: 'poemcol', style: 'grid-column:1/13' },
      h('h1', { text: 'Texto no disponible' }),
      h('p', { class: 'muted', text: 'Puede ser privado, estar programado para otra fecha o tener un enlace que ya no funciona.' }),
      h('div', { class: 'nav2' }, h('button', { class: 'btn', type: 'button', text: 'Volver al índice', onclick: () => { ui.open = null; rerender(); } }))));
    app.append(wrap);
    return;
  }

  const useGL = webgl && !data.lite && !reduceMotion;
  if (useGL) {
    const cv = h('canvas', { class: 'bg', 'aria-hidden': 'true' });
    wrap.append(cv);
    const plain2d = (): void => { cv.remove(); wrap.classList.add('s2d'); };
    let dead = false, stop: (() => void) | null = null;
    addCleanup(() => { dead = true; stop?.(); });
    import('../scenes').then(({ startScene }) => { if (!dead) stop = startScene(cv, t.scene); }).catch(plain2d);
  } else wrap.classList.add('s2d');

  if (ui.preview) wrap.append(h('div', { class: 'banner', text: 'Vista previa de la autora · lo ves aunque esté como ' + VIS[st].name.toLowerCase() }));
  else if (st === 'link') wrap.append(h('div', { class: 'banner', text: 'Abierto con su enlace privado · no aparece en el índice' }));

  const pub = publicTexts(), idx = pub.indexOf(t);
  const msg = h('span', { class: 'status', 'aria-live': 'polite' });
  const back = (): void => { if (ui.preview) go('estudio'); else { ui.open = null; rerender(); } };
  const meta = h('aside', { class: 'meta' },
    h('p', { class: 'mono muted', text: idx >= 0 ? 'N.º ' + two(idx) + ' de ' + pad(pub.length) : 'Fuera del índice' }),
    h('p', { class: 'mono', text: SCENES[t.scene] }),
    h('p', { class: 'muted', style: 'font-size:15px', text: data.book.title + ' · ' + data.book.author }),
    h('div', { class: 'nav2' },
      h('button', { class: 'btn small', type: 'button', text: '← Volver', onclick: back }),
      h('button', { class: 'btn small', type: 'button', text: 'Compartir', onclick: () => copy('solapa.example/' + (t.token || t.id), msg, 'Enlace de ejemplo copiado') }),
      h('button', { class: 'btn small', type: 'button', 'aria-pressed': data.lite ? 'true' : 'false', text: data.lite ? 'Versión ligera: sí' : 'Versión ligera', onclick: () => { data.lite = !data.lite; save(); rerender(); } })),
    msg);

  // Poema palabra por palabra. El sangrado colgante vive en .line y se anula en .w (ver styles.css).
  // Cada estrofa trae su efecto (score.ts). La copia visual va oculta a lectores de pantalla y lleva
  // aparte el texto completo, para que no lean palabra a palabra.
  const col = h('article', { class: 'poemcol' }, h('h1', { text: t.title || 'Sin título' }));
  const stanzas = parseScore(t.body || '');
  if (!stanzas.length) col.append(h('p', { class: 'muted', text: 'Este texto todavía está vacío.' }));
  stanzas.forEach((s, k) => {
    const vis = h('div', { class: 'vis', 'aria-hidden': 'true' });
    let n = 0;
    s.lines.forEach((line, li) => {
      const l = h('span', { class: 'line' });
      line.split(/(\s+)/).forEach((w) => {
        if (w) l.append(h('span', { class: 'w', style: '--i:' + (/\s/.test(w) ? n : n++), text: w }));
      });
      if (s.fx === 'hueco' && li === s.lines.length - 1 && li > 0) l.classList.add('after-gap');
      vis.append(l);
      if (s.fx === 'grieta' && s.lines.length > 1 && li === Math.floor(s.lines.length / 2) - 1) vis.append(crack(k));
    });
    const sr = h('p', { class: 'sr' });
    s.lines.forEach((line, i) => { if (i) sr.append(h('br')); sr.append(line); });
    col.append(h('div', { class: 'stanza' + (s.fx ? ' fx-' + s.fx : ''), 'data-k': String(k) }, sr, vis,
      h('button', {
        class: 'vcard', type: 'button', 'aria-label': 'Guardar la estrofa ' + (k + 1) + ' como imagen', text: '↓ Imagen',
        onclick: () => {
          verseCard(s.lines, t.title, data.book.title, data.book.author, k + 1)
            .then((cv) => deliverCard(cv, slug(t.title) + '-' + (k + 1)))
            .then((r) => { msg.textContent = r === 'saved' ? 'Imagen guardada.' : 'Lista para compartir.'; })
            .catch(() => { msg.textContent = 'No se pudo crear la imagen.'; });
        },
      })));
  });
  wrap.append(meta, col);

  const after = h('div', { class: 'after' });
  const nav = h('div', { class: 'nav2' });
  if (idx > 0) { const p = pub[idx - 1]; nav.append(h('button', { class: 'btn', type: 'button', text: '← ' + p.title, onclick: () => go('pagina', { open: p.id }) })); }
  if (idx >= 0 && idx < pub.length - 1) { const p = pub[idx + 1]; nav.append(h('button', { class: 'btn', type: 'button', text: p.title + ' →', onclick: () => go('pagina', { open: p.id }) })); }
  after.append(nav, h('p', { class: 'mono muted', text: '¿Quieres el próximo?' }), subscribeForm(t.id, 'poem'));
  wrap.append(after);
  app.append(wrap);

  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') back(); };
  document.addEventListener('keydown', onKey);
  addCleanup(() => document.removeEventListener('keydown', onKey));
  addCleanup(trackScroll());
  addCleanup(stage(col));
}

const slug = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'verso';

/** Fractura dentada y determinista: la misma estrofa dibuja siempre la misma grieta. */
function crack(seed: number): SVGElement {
  const NS = 'http://www.w3.org/2000/svg', W = 400, H = 40;
  let a = seed * 7919 + 12345;
  const rnd = (): number => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
  const pts: Array<[number, number]> = [[0, H / 2]];
  for (let x = 0; x < W;) { x = Math.min(W, x + 12 + rnd() * 30); pts.push([x, H / 2 + (rnd() - 0.5) * H * 0.8]); }
  const [bx, by] = pts[Math.floor(pts.length * 0.45)], dir = rnd() < 0.5 ? -1 : 1;
  const branch = `M${bx.toFixed(1)} ${by.toFixed(1)} l${(14 + rnd() * 18).toFixed(1)} ${(dir * (6 + rnd() * 8)).toFixed(1)} l${(10 + rnd() * 14).toFixed(1)} ${(dir * (-2 + rnd() * 8)).toFixed(1)}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'crack'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  [pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), branch].forEach((d) => {
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.append(p);
  });
  return svg;
}

/**
 * Pone en marcha lo que depende de dónde está el lector en el texto: cada estrofa aparece al llegar a
 * la pantalla, la que cruza el centro manda el calor del fondo y la cámara oscura sigue la luz.
 */
function stage(col: HTMLElement): () => void {
  const els = Array.from(col.querySelectorAll<HTMLElement>('.stanza'));
  const fxOf = (el: HTMLElement): FxKind | null => (FX_KINDS.find((k) => el.classList.contains('fx-' + k)) ?? null);
  if (typeof IntersectionObserver === 'undefined') { els.forEach((e) => e.classList.add('on')); return () => {}; }
  const done: Array<() => void> = [];

  const appear = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('on'); appear.unobserve(e.target); }
  }), { rootMargin: '0px 0px -12% 0px', threshold: 0 });
  const current = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) reading.override = heatFor(fxOf(e.target as HTMLElement));
  }), { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  els.forEach((e) => { appear.observe(e); current.observe(e); });
  done.push(() => { appear.disconnect(); current.disconnect(); });

  // Cámara oscura: cada palabra se ilumina según su distancia a la luz. La luz es el puntero si se movió hace poco;
  // si no, la mitad de la pantalla, así también funciona con el dedo, el teclado y la rueda.
  const dark = els.filter((e) => e.classList.contains('fx-revela'));
  if (dark.length && !reduceMotion) {
    const ptr = { x: 0, y: 0, t: -1e9 };
    const onMove = (e: PointerEvent): void => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); };
    document.addEventListener('pointermove', onMove, { passive: true });
    const seen = new Set<HTMLElement>();
    const light = new Map<HTMLElement, { x: number; y: number }>();
    const cache = new Map<HTMLElement, { w: number; words: HTMLElement[]; pos: number[][]; last: number[] }>();
    const vis = new IntersectionObserver((es) => es.forEach((e) => {
      const el = e.target as HTMLElement;
      if (e.isIntersecting) seen.add(el); else seen.delete(el);
      if (seen.size && !raf) raf = requestAnimationFrame(frame);
    }), { threshold: 0 });
    dark.forEach((e) => vis.observe(e));
    let raf = 0;
    let prev = 0;
    const frame = (now: number): void => {
      raf = 0;
      if (!seen.size) return;
      if (now - prev < 32) { raf = requestAnimationFrame(frame); return; }
      prev = now;
      seen.forEach((el) => {
        const r = el.getBoundingClientRect(), fs = parseFloat(getComputedStyle(el).fontSize) || 24;
        const usePtr = now - ptr.t < 2500 && ptr.x > r.left - 120 && ptr.x < r.right + 120 && ptr.y > r.top - 120 && ptr.y < r.bottom + 120;
        const tx = usePtr ? ptr.x : r.left + Math.min(r.width, fs * 20) * 0.4, ty = usePtr ? ptr.y : innerHeight * 0.5;
        const L = light.get(el) ?? { x: tx, y: ty };
        L.x += (tx - L.x) * 0.18; L.y += (ty - L.y) * 0.18; light.set(el, L);
        let c = cache.get(el);
        if (!c || c.w !== r.width) {
          // Posición de cada palabra respecto a la estrofa: se mide solo cuando cambia el ancho, no en cada cuadro.
          const words = Array.from(el.querySelectorAll<HTMLElement>('.w'));
          c = { w: r.width, words, pos: words.map((w) => { const b = w.getBoundingClientRect(); return [b.left - r.left + b.width / 2, b.top - r.top + b.height / 2]; }), last: [] };
          cache.set(el, c);
        }
        c.words.forEach((w, i) => {
          const d = Math.hypot(r.left + c!.pos[i][0] - L.x, (r.top + c!.pos[i][1] - L.y) * 1.25);
          const v = Math.round(Math.max(0.14, Math.min(1, 1 - (d - 2 * fs) / (5 * fs))) * 50) / 50;
          if (c!.last[i] !== v) { c!.last[i] = v; w.style.setProperty('--o', String(v)); }
        });
      });
      raf = requestAnimationFrame(frame);
    };
    done.push(() => { cancelAnimationFrame(raf); raf = 0; vis.disconnect(); document.removeEventListener('pointermove', onMove); });
  } else dark.forEach((e) => e.classList.add('calm'));
  return () => done.forEach((f) => f());
}
