export const pad = (n: number): string => String(n).padStart(2, '0');
export const two = (n: number): string => pad(n + 1);
export const iso = (d: Date): string => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = (): string => iso(new Date());
export const inDays = (n: number): string => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
export const fmt = (s: string): string => {
  if (!s) return '';
  const p = s.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('es', { day: 'numeric', month: 'short' });
};
export function token(): string {
  const c = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
export const uid = (): string => 't' + Math.random().toString(36).slice(2, 9);
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const reduceMotion: boolean = (() => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
})();
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch { return false; }
}
