import { data, PRESETS, type RGB } from './store';
import { css, ensure, hsl2rgb, lum, mix, rgb2hsl, contrast } from './color';

export interface Palette { dom: RGB; hsl: [number, number, number]; accent: RGB }
export interface Theme { dark: boolean; ground: RGB; ink: RGB; accent: RGB; accentText: RGB; onAccent: RGB; dom: RGB }

/** Estado vivo del tema, derivado de la portada. */
export const S = {} as { cover: HTMLCanvasElement; coverImg: CanvasImageSource | null; pal: Palette; theme: Theme };
S.coverImg = null;

let listeners: Array<() => void> = [];
export function onChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}
export function notify(): void { listeners.slice().forEach((f) => { try { f(); } catch { /* ignorar */ } }); }

export function makeNoise(): string {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const x = c.getContext('2d')!, im = x.createImageData(160, 160);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0);
  return c.toDataURL('image/png');
}

export function drawFit(x: CanvasRenderingContext2D, img: CanvasImageSource & { width: number | SVGAnimatedLength; height: number | SVGAnimatedLength }, w: number, hh: number): void {
  const el = img as unknown as { naturalWidth?: number; naturalHeight?: number; width: number; height: number };
  const iw = el.naturalWidth || el.width, ih = el.naturalHeight || el.height, s = Math.max(w / iw, hh / ih);
  x.drawImage(img, (w - iw * s) / 2, (hh - ih * s) / 2, iw * s, ih * s);
}

type Ctx2 = CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string };

function drawPreset(x: Ctx2, w: number, hh: number, p: { bg: RGB; fg: RGB }, title: string, author: string): void {
  x.fillStyle = css(p.bg); x.fillRect(0, 0, w, hh);
  for (let i = 0; i < 9000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; x.fillRect(Math.random() * w, Math.random() * hh, 1.5, 1.5); }
  x.strokeStyle = css(p.fg, 0.75); x.lineWidth = 2; x.strokeRect(34, 34, w - 68, hh - 68);
  x.fillStyle = css(p.fg); x.textBaseline = 'alphabetic';
  const words = (title || '').toUpperCase().split(/\s+/).filter(Boolean).slice(0, 4);
  let y = 96;
  words.forEach((wd) => {
    let size = 170;
    const mw = w - 128;
    x.font = `800 ${size}px Archivo, Impact, sans-serif`;
    try { x.fontStretch = 'expanded'; } catch { /* no soportado */ }
    const m = x.measureText(wd).width;
    if (m > mw) { size = Math.floor((size * mw) / m); x.font = `800 ${size}px Archivo, Impact, sans-serif`; }
    y += size * 0.88; x.fillText(wd, 64, y); y += size * 0.14;
  });
  x.font = '500 22px "Azeret Mono", ui-monospace, monospace';
  try { x.letterSpacing = '4px'; } catch { /* no soportado */ }
  x.fillText((author || '').toUpperCase(), 64, hh - 70);
  try { x.letterSpacing = '0px'; } catch { /* no soportado */ }
}

export function makeCover(): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = 600; cv.height = 900;
  const x = cv.getContext('2d') as Ctx2;
  if (data.book.cover.kind === 'image' && S.coverImg) drawFit(x, S.coverImg as HTMLCanvasElement, 600, 900);
  else drawPreset(x, 600, 900, PRESETS[data.book.cover.preset] ?? PRESETS.bermellon, data.book.title, data.book.author);
  // Surco de la bisagra, para todas las portadas.
  const g = x.createLinearGradient(0, 0, 46, 0);
  g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(0.6, 'rgba(255,255,255,.09)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 46, 900);
  return cv;
}

/** Color dominante y un acento distinto, leídos de la portada. */
export function derivePalette(cv: HTMLCanvasElement): Palette {
  const w = 40, hh = 60, c = document.createElement('canvas'); c.width = w; c.height = hh;
  const x = c.getContext('2d')!; x.drawImage(cv, 0, 0, w, hh);
  const d = x.getImageData(0, 0, w, hh).data, total = w * hh;
  const bins: Record<number, { n: number; r: number; g: number; b: number }> = {};
  for (let i = 0; i < d.length; i += 4) {
    const k = ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5);
    const b = bins[k] ?? (bins[k] = { n: 0, r: 0, g: 0, b: 0 });
    b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
  }
  const arr = Object.values(bins).map((b) => {
    const rgb: RGB = [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)];
    return { n: b.n, rgb, hsl: rgb2hsl(rgb[0], rgb[1], rgb[2]) };
  }).sort((a, b) => b.n - a.n);
  const dom = arr[0];
  let acc: (typeof arr)[number] | null = null, best = 0;
  arr.forEach((b) => {
    const s = b.hsl[1], l = b.hsl[2];
    if (b.n / total < 0.006 || s < 0.35 || l < 0.22 || l > 0.84) return;
    const near = dom.hsl[1] > 0.35 && Math.abs(b.hsl[0] - dom.hsl[0]) < 0.05 ? 0.3 : 1;
    const score = Math.pow(b.n, 0.6) * s * near;
    if (score > best) { best = score; acc = b; }
  });
  const picked = acc as (typeof arr)[number] | null;
  const accent: RGB = picked ? picked.rgb : dom.hsl[1] > 0.3 ? dom.rgb : hsl2rgb((dom.hsl[0] + 0.5) % 1, 0.6, 0.5);
  return { dom: dom.rgb, hsl: dom.hsl, accent };
}

/** Convierte la paleta en variables CSS con contraste garantizado (3:1 y 4.5:1). */
export function applyTheme(): void {
  const hsl = S.pal.hsl, mode = data.book.mode;
  let dark = mode === 'dark' || (mode === 'auto' && hsl[2] < 0.3);
  if (mode === 'light') dark = false;
  const ground = dark ? hsl2rgb(hsl[0], Math.min(hsl[1], 0.22) * 0.7, 0.075) : hsl2rgb(hsl[0], Math.min(hsl[1], 0.5) * 0.35, 0.925);
  const ink = dark ? hsl2rgb(hsl[0], 0.12, 0.92) : hsl2rgb(hsl[0], 0.15, 0.09);
  const muted = ensure(mix(ink, ground, 0.42), ground, 4.5);
  const accent = ensure(S.pal.accent, ground, 3);
  const accentText = ensure(S.pal.accent, ground, 4.5);
  const onAccent: RGB = contrast([20, 20, 20], accent) >= contrast([248, 245, 238], accent) ? [20, 20, 20] : [248, 245, 238];
  const s = document.documentElement.style;
  s.setProperty('--ground', css(ground)); s.setProperty('--ink', css(ink)); s.setProperty('--muted', css(muted));
  s.setProperty('--accent', css(accent)); s.setProperty('--accent-text', css(accentText)); s.setProperty('--on-accent', css(onAccent));
  s.setProperty('--rule', css(ink, 0.28)); s.setProperty('--wash', css(ink, 0.06));
  S.theme = { dark, ground, ink, accent, accentText, onAccent, dom: S.pal.dom };
}

export function refreshTheme(): void {
  S.cover = makeCover();
  S.pal = derivePalette(S.cover);
  applyTheme();
  notify();
}

export function setCoverImgFromData(): void {
  if (data.book.cover.kind === 'image' && data.book.cover.img) {
    const im = new Image();
    im.onload = () => { S.coverImg = im; refreshTheme(); };
    im.src = data.book.cover.img;
  } else S.coverImg = null;
}

export const isDarkCover = (c: RGB): boolean => lum(c) <= 0.4;
