import { css } from './color';
import { S } from './theme';
import { two } from './util';

type Ctx2 = CanvasRenderingContext2D & { letterSpacing?: string };

const W = 1080, H = 1350, M = 112;

/** Parte un verso en tantas líneas como haga falta para el ancho dado. */
function wrap(x: CanvasRenderingContext2D, line: string, max: number): string[] {
  const words = line.split(/\s+/).filter(Boolean), out: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (cur && x.measureText(test).width > max) { out.push(cur); cur = w; } else cur = test;
  }
  if (cur) out.push(cur);
  return out;
}

/** Tarjeta 4:5 de una estrofa, con los colores de la portada y el lenguaje de imprenta. */
export async function verseCard(lines: string[], title: string, book: string, author: string, n: number): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load('400 40px Literata'), document.fonts.load('800 40px Archivo'), document.fonts.load('500 20px "Azeret Mono"')]);
  } catch { /* se dibuja con las fuentes de respaldo */ }
  const th = S.theme;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d') as Ctx2;
  x.fillStyle = css(th.ground); x.fillRect(0, 0, W, H);
  x.fillStyle = css(th.accent); x.fillRect(0, 0, W, 14);

  // Marcas de corte en las cuatro esquinas.
  x.strokeStyle = css(th.ink, 0.55); x.lineWidth = 2;
  const crop = (cx: number, cy: number, sx: number, sy: number): void => {
    x.beginPath(); x.moveTo(cx, cy + sy * 34); x.lineTo(cx, cy); x.lineTo(cx + sx * 34, cy); x.stroke();
  };
  crop(48, 62, 1, 1); crop(W - 48, 62, -1, 1); crop(48, H - 48, 1, -1); crop(W - 48, H - 48, -1, -1);

  x.fillStyle = css(th.ink); x.textBaseline = 'alphabetic';
  x.font = '500 22px "Azeret Mono", ui-monospace, monospace';
  try { x.letterSpacing = '4px'; } catch { /* no soportado */ }
  x.fillText((title || 'Sin título').toUpperCase() + ' · N.º ' + two(n - 1), M, 150);
  try { x.letterSpacing = '0px'; } catch { /* no soportado */ }
  x.fillStyle = css(th.ink, 0.28); x.fillRect(M, 176, W - 2 * M, 1);

  // El tamaño baja hasta que la estrofa entera cabe en el recuadro.
  const top = 250, bottom = H - 250, maxW = W - 2 * M;
  // Primero se busca el tamaño en que cada verso cabe en una sola línea; solo si no existe se parten los versos largos.
  let size = 60, rows: Array<{ t: string; cont: boolean }> = [], lh = 0;
  const layout = (s: number, allowWrap: boolean): boolean => {
    x.font = `400 ${s}px Literata, Georgia, serif`;
    lh = s * 1.5; rows = [];
    for (const l of lines) {
      if (!l.trim()) continue;
      if (!allowWrap) {
        if (x.measureText(l).width > maxW) return false;
        rows.push({ t: l, cont: false });
        continue;
      }
      wrap(x, l, maxW - s * 1.4).forEach((t, i) => rows.push({ t, cont: i > 0 }));
    }
    return rows.length * lh <= bottom - top;
  };
  let fit = false;
  for (size = 60; size >= 30 && !fit; size -= 2) fit = layout(size, false);
  if (fit) size += 2; else for (size = 60; size >= 22; size -= 2) if (layout(size, true)) break;
  x.font = `400 ${size}px Literata, Georgia, serif`;
  x.fillStyle = css(th.ink);
  // El bloque se centra en el recuadro, pero sin bajar de un tercio para que no flote.
  let y = top + size + Math.min(Math.max(0, (bottom - top - rows.length * lh) / 2), (bottom - top) / 3);
  rows.forEach((r) => { x.fillText(r.t, M + (r.cont ? size * 1.4 : 0), y); y += lh; });

  // Pie: filete de acento, título del libro y autoría.
  x.fillStyle = css(th.accent); x.fillRect(M, H - 206, 96, 6);
  x.fillStyle = css(th.ink);
  x.font = '800 40px Archivo, Impact, sans-serif';
  x.fillText((book || '').toUpperCase(), M, H - 140);
  x.font = '500 22px "Azeret Mono", ui-monospace, monospace';
  try { x.letterSpacing = '4px'; } catch { /* no soportado */ }
  x.fillText((author || '').toUpperCase(), M, H - 98);
  return c;
}

/** En móvil abre el menú de compartir; en escritorio descarga la imagen. */
export async function deliverCard(cv: HTMLCanvasElement, name: string): Promise<'shared' | 'saved'> {
  const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
  if (!blob) throw new Error('No se pudo generar la imagen');
  const file = new File([blob], name + '.png', { type: 'image/png' });
  const coarse = (() => { try { return matchMedia('(pointer:coarse)').matches; } catch { return false; } })();
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch (e) { if ((e as DOMException).name === 'AbortError') return 'shared'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name + '.png'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}
