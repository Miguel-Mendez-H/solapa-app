/**
 * Partitura de un texto: el cuerpo es texto plano, pero la primera línea de una estrofa puede ser
 * una directiva `::efecto` que no se muestra al lector y le da a esa estrofa un efecto propio.
 */
export type FxKind = 'fuego' | 'grieta' | 'revela' | 'hueco' | 'quieto';

export const FX: Record<FxKind, { name: string; desc: string }> = {
  fuego: { name: 'Fuego', desc: 'Las palabras se encienden y se enfrían; el fondo sube de calor.' },
  grieta: { name: 'Grieta', desc: 'Una fractura de luz se abre en mitad de la estrofa.' },
  revela: { name: 'Cámara oscura', desc: 'El texto aparece donde pasa la luz: ratón, dedo o la mitad de la pantalla al hacer scroll.' },
  hueco: { name: 'Hueco', desc: 'Ritmo lento y un silencio antes del último verso.' },
  quieto: { name: 'Quieto', desc: 'Sin movimiento; el fondo se calma.' },
};
export const FX_KINDS = Object.keys(FX) as FxKind[];

export interface Stanza { fx: FxKind | null; lines: string[] }

const DIRECTIVE = /^::\s*(\p{L}+)\s*$/u;
const isFx = (k: string): k is FxKind => Object.prototype.hasOwnProperty.call(FX, k);

/** Saltos de línea unificados y sin espacios al final de cada verso. */
export function normalize(body: string): string {
  return body.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n');
}

export function parseScore(body: string): Stanza[] {
  const out: Stanza[] = [];
  let pending: FxKind | null = null;
  const text = normalize(body).trim();
  if (!text) return out;
  for (const block of text.split(/\n[ \t]*\n/)) {
    let lines = block.split('\n').filter((l, i, a) => l.trim() || (i > 0 && i < a.length - 1));
    let fx: FxKind | null = pending; pending = null;
    const m = lines.length ? DIRECTIVE.exec(lines[0].trim()) : null;
    const key = m ? m[1].toLowerCase() : '';
    if (m && isFx(key)) { fx = key; lines = lines.slice(1); }
    // Una directiva sola en su bloque vale para la estrofa siguiente.
    if (!lines.some((l) => l.trim())) { pending = fx; continue; }
    out.push({ fx, lines });
  }
  return out;
}

/** El texto tal como lo lee quien no ve los efectos: sin directivas. */
export const plain = (body: string): string => parseScore(body).map((s) => s.lines.join('\n')).join('\n\n');

/** Pone, cambia o quita (fx = null) el efecto de la estrofa donde está el cursor. */
export function setFxAt(body: string, caret: number, fx: FxKind | null): { body: string; caret: number } {
  const text = body.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  let pos = 0, li = 0;
  for (; li < lines.length; li++) { if (caret <= pos + lines[li].length) break; pos += lines[li].length + 1; }
  li = Math.min(li, lines.length - 1);
  // Si el cursor está en una línea en blanco, se usa la estrofa siguiente (o la anterior si no hay).
  if (!lines[li].trim()) {
    let j = li; while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length) { j = li; while (j > 0 && !lines[j].trim()) j--; }
    li = j;
  }
  let start = li; while (start > 0 && lines[start - 1].trim()) start--;
  let startOff = 0; for (let i = 0; i < start; i++) startOff += lines[i].length + 1;
  const m = DIRECTIVE.exec(lines[start].trim());
  const had = !!(m && isFx(m[1].toLowerCase()));
  let delta = 0;
  if (had && fx) { const nl = '::' + fx; delta = nl.length - lines[start].length; lines[start] = nl; }
  else if (had) { delta = -(lines[start].length + 1); lines.splice(start, 1); }
  else if (fx) { const nl = '::' + fx; lines.splice(start, 0, nl); delta = nl.length + 1; }
  return { body: lines.join('\n'), caret: caret >= startOff ? Math.max(startOff, caret + delta) : caret };
}

/** Separa el título de un texto pegado o importado: `# Título` o una primera línea seguida de dos líneas en blanco. */
export function splitTitle(raw: string, fallback: string): { title: string; body: string } {
  const text = normalize(raw).trim();
  const h = /^#+[ \t]+([^\n]+)\n/.exec(text);
  if (h) return { title: h[1].trim(), body: tidy(text.slice(h[0].length)) };
  const t = /^([^\n]{1,80})\n[ \t]*\n[ \t]*\n/.exec(text);
  if (t) return { title: t[1].trim(), body: tidy(text.slice(t[0].length)) };
  return { title: fallback, body: tidy(text) };
}
const tidy = (s: string): string => s.replace(/\n([ \t]*\n){2,}/g, '\n\n').trim();
