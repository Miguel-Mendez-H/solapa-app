/**
 * Estado compartido de la lectura. El poema escribe aquí (scroll, estrofa actual) y las escenas
 * lo leen en cada fotograma, así el fondo responde al texto sin que se conozcan entre sí.
 */
import { clamp } from './util';
import type { FxKind } from './score';

export const reading = {
  /** 0 arriba del poema, 1 al final. */
  progress: 0,
  /** Calor suavizado que usan las escenas (0 frío, 1 al rojo). */
  heat: 0.12,
  /** Si la estrofa actual fuerza un calor, aquí va; null = sigue el avance del poema. */
  override: null as number | null,
};

export function heatFor(fx: FxKind | null): number | null {
  if (fx === 'fuego') return 1;
  if (fx === 'quieto') return 0.04;
  return null;
}

/** Avanza el calor hacia su objetivo. Lo llama la escena en cada fotograma. */
export function stepReading(dt: number): number {
  const target = reading.override ?? 0.12 + 0.35 * reading.progress;
  reading.heat += (target - reading.heat) * Math.min(1, dt * 1.4);
  return reading.heat;
}

/** Sigue el scroll de la página. Devuelve la función que lo suelta. */
export function trackScroll(): () => void {
  const on = (): void => {
    const max = document.documentElement.scrollHeight - innerHeight;
    reading.progress = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
  };
  reading.progress = 0; reading.override = null; reading.heat = 0.12;
  window.addEventListener('scroll', on, { passive: true });
  window.addEventListener('resize', on);
  on();
  return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); reading.override = null; };
}
