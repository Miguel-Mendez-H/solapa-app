import { data } from './store';
import type { BgMode } from './store';
import { S } from './theme';

/** Modo efectivo: si la autora no eligió, una portada subida se usa de fondo y los ejemplos quedan lisos. */
export function bgMode(): BgMode {
  const b = data.book;
  const m = b.bg ?? (b.cover.kind === 'image' ? 'cover' : 'none');
  return m === 'image' && !b.bgImg ? 'none' : m;
}

/** Capa detrás del libro 3D. `cover` = la portada reducida y ampliada (queda desenfocada sin usar filtros). */
export function paintBackdrop(el: HTMLElement): void {
  const m = bgMode();
  el.dataset.mode = m;
  el.style.backgroundImage = '';
  if (m === 'image') el.style.backgroundImage = `url("${data.book.bgImg}")`;
  else if (m === 'cover' && S.cover) {
    const c = document.createElement('canvas'); c.width = 36; c.height = 54;
    const x = c.getContext('2d');
    if (x) { x.imageSmoothingQuality = 'high'; x.drawImage(S.cover, 0, 0, 36, 54); el.style.backgroundImage = `url("${c.toDataURL()}")`; }
  }
}

export function backdrop(): HTMLElement {
  const el = document.createElement('div'); el.className = 'backdrop'; el.setAttribute('aria-hidden', 'true');
  paintBackdrop(el); return el;
}
