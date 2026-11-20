import { ui } from './store';

let renderer: () => void = () => {};
export function setRenderer(fn: () => void): void { renderer = fn; }

/** Navega a una ruta (#estudio | #pagina). `opts` viaja en `ui.next` hasta que el render lo aplica. */
export function go(route: string, opts?: UINext): void {
  ui.next = opts ?? null;
  if (location.hash === '#' + route) { applyNext(); renderer(); } else location.hash = '#' + route;
}
type UINext = NonNullable<typeof ui.next>;

export function applyNext(): void {
  const n = ui.next; ui.next = null;
  ui.open = n?.open ?? null; ui.asLink = !!n?.asLink; ui.preview = !!n?.preview;
}
