import * as THREE from 'three';
import { data, publicTexts } from './store';
import { css, lum, mix } from './color';
import { S, onChange } from './theme';
import { reduceMotion, two } from './util';

type Ctx2 = CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string };

function canvasTex(cv: HTMLCanvasElement, maxA: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxA; return t;
}

function stripes(vertical: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = vertical ? 256 : 64; c.height = vertical ? 64 : 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#EFEADD'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 256; i += 2) {
    x.fillStyle = `rgba(120,108,84,${0.12 + Math.random() * 0.16})`;
    if (vertical) x.fillRect(i, 0, 1, 64); else x.fillRect(0, i, 64, 1);
  }
  return c;
}

function spineCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 200; c.height = 1150;
  const x = c.getContext('2d') as Ctx2;
  x.fillStyle = css(S.theme.dom); x.fillRect(0, 0, 200, 1150);
  x.fillStyle = lum(S.theme.dom) > 0.4 ? css([20, 20, 20]) : css([244, 240, 232]);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.save(); x.translate(100, 575); x.rotate(Math.PI / 2);
  const t = (data.book.title || '').toUpperCase();
  let size = 74;
  x.font = `800 ${size}px Archivo, Impact, sans-serif`;
  try { x.fontStretch = 'expanded'; } catch { /* no soportado */ }
  const m = x.measureText(t).width;
  if (m > 800) { size = Math.floor((size * 800) / m); x.font = `800 ${size}px Archivo, Impact, sans-serif`; }
  x.fillText(t, 0, -8);
  x.font = '500 26px "Azeret Mono", ui-monospace, monospace';
  try { x.letterSpacing = '3px'; } catch { /* no soportado */ }
  x.fillText((data.book.author || '').toUpperCase(), 0, 52);
  x.restore();
  return c;
}

/** Página de índice que se ve al abrir el libro: lista solo los textos públicos. */
const ROW0 = 168, ROWH = 62, MAXROWS = 9;
/** Renglón del índice que cae en la coordenada (x, y) de la textura de la página, o -1. */
function rowAt(x: number, y: number, n: number): number {
  if (x < 52 || x > 460) return -1;
  const i = Math.round((y - (ROW0 - 8)) / ROWH);
  return i >= 0 && i < n && Math.abs(y - (ROW0 - 8 + i * ROWH)) < 28 ? i : -1;
}

function pageCanvas(hover = -1): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 512; c.height = 720;
  const x = c.getContext('2d') as Ctx2;
  x.fillStyle = '#F3EFE6'; x.fillRect(0, 0, 512, 720);
  const g = x.createLinearGradient(0, 0, 60, 0); g.addColorStop(0, 'rgba(0,0,0,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 60, 720);
  x.fillStyle = '#141414'; x.textBaseline = 'alphabetic';
  x.font = '500 20px "Azeret Mono", ui-monospace, monospace';
  try { x.letterSpacing = '4px'; } catch { /* no soportado */ }
  x.fillText('ÍNDICE', 64, 90);
  try { x.letterSpacing = '0px'; } catch { /* no soportado */ }
  x.fillRect(64, 108, 384, 2);
  const list = publicTexts().slice(0, MAXROWS);
  let y = ROW0;
  if (hover >= 0 && hover < list.length) {
    const hy = ROW0 - 8 + hover * ROWH;
    x.fillStyle = css(S.theme.accent, 0.2); x.fillRect(52, hy - 28, 408, 54);
    x.fillStyle = css(S.theme.accent); x.fillRect(52, hy + 26, 408, 2);
  }
  list.forEach((t, i) => {
    x.font = '400 27px Literata, Georgia, serif';
    let title = t.title || 'Sin título';
    while (x.measureText(title).width > 270 && title.length > 4) title = title.slice(0, -2) + '…';
    x.fillStyle = '#141414'; x.fillText(title, 64, y);
    const tw = x.measureText(title).width;
    x.fillStyle = 'rgba(20,20,20,.35)';
    for (let k = 64 + tw + 12; k < 410; k += 8) x.fillRect(k, y - 4, 2, 2);
    x.fillStyle = '#141414'; x.font = '500 18px "Azeret Mono", ui-monospace, monospace'; x.fillText(two(i), 420, y);
    y += 62;
  });
  if (!list.length) { x.font = 'italic 24px Literata, Georgia, serif'; x.fillStyle = 'rgba(20,20,20,.5)'; x.fillText('Aún sin poemas públicos', 64, 170); }
  return c;
}

function endpaperCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 256; c.height = 360;
  const x = c.getContext('2d')!;
  x.fillStyle = css(S.theme.accent); x.fillRect(0, 0, 256, 360);
  x.strokeStyle = css(S.theme.onAccent, 0.13); x.lineWidth = 2;
  for (let i = -360; i < 256; i += 14) { x.beginPath(); x.moveTo(i, 360); x.lineTo(i + 360, 0); x.stroke(); }
  return c;
}

function shadowCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return c;
}

export interface BookOptions { open?: boolean; onToggle?: (open: boolean) => void; onPick?: (id: string) => void }
export interface BookHandle { toggle(): void; isOpen(): boolean; dispose(): void }

export function createBook(canvas: HTMLCanvasElement, opt: BookOptions = {}): BookHandle {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  // Desde r155 las luces son físicas: multiplicar por PI da el mismo brillo que el modo antiguo.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8378, 0.8 * Math.PI));
  const key = new THREE.DirectionalLight(0xffffff, 0.8 * Math.PI); key.position.set(3, 5, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25 * Math.PI); fill.position.set(-4, 1, 3); scene.add(fill);
  const maxA = r.capabilities.getMaxAnisotropy();

  const W = 1.6, H = 2.3, D = 0.42, B = 0.04;
  const root = new THREE.Group(); scene.add(root);
  const book = new THREE.Group(); root.add(book);
  const made: THREE.Material[] = [];
  const std = (o: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => { const m = new THREE.MeshStandardMaterial(o); made.push(m); return m; };

  const mCover = std({ roughness: 0.55 }), mEnd = std({ roughness: 0.8 }), mPage = std({ roughness: 0.9 }), mSpine = std({ roughness: 0.6 });
  const mEdge = std({ roughness: 0.7 }), mBack = std({ roughness: 0.6 });
  const sv = canvasTex(stripes(true), maxA), sh = canvasTex(stripes(false), maxA);
  const mFore = std({ map: sv, roughness: 0.95 }), mTop = std({ map: sh, roughness: 0.95 }), mPlain = std({ color: 0xefeadd, roughness: 0.95 });

  // Orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z
  const geoBoard = new THREE.BoxGeometry(W, H, B);
  const back = new THREE.Mesh(geoBoard, [mEdge, mEdge, mEdge, mEdge, mEnd, mBack]); back.position.z = -(D / 2 - B / 2); book.add(back);
  const geoPages = new THREE.BoxGeometry(W - 0.08, H - 0.08, D - 2 * B - 0.02);
  const pages = new THREE.Mesh(geoPages, [mFore, mPlain, mTop, mTop, mPage, mPlain]); pages.position.x = 0.02; book.add(pages);
  const geoSpine = new THREE.BoxGeometry(B, H, D);
  const spine = new THREE.Mesh(geoSpine, [mEdge, mSpine, mEdge, mEdge, mEdge, mEdge]); spine.position.x = -W / 2 + B / 2; book.add(spine);
  // La tapa gira sobre un pivote situado en el lomo.
  const front = new THREE.Group(); front.position.set(-W / 2, 0, D / 2 - B / 2); book.add(front);
  const fb = new THREE.Mesh(geoBoard, [mEdge, mEdge, mEdge, mEdge, mCover, mEnd]); fb.position.x = W / 2; front.add(fb);

  const shTex = new THREE.CanvasTexture(shadowCanvas());
  const shGeo = new THREE.PlaneGeometry(3.6, 1.7);
  const shMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(shGeo, shMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -H / 2 - 0.02; root.add(shadow);

  let dyn: THREE.Texture[] = [], pageTex: THREE.Texture | null = null, hover = -1;
  function paintPage(): void {
    pageTex?.dispose(); pageTex = canvasTex(pageCanvas(hover), maxA); mPage.map = pageTex; mPage.needsUpdate = true;
  }
  function refresh(): void {
    dyn.forEach((t) => t.dispose()); dyn = [];
    const ct = (c: HTMLCanvasElement): THREE.CanvasTexture => { const t = canvasTex(c, maxA); dyn.push(t); return t; };
    mCover.map = ct(S.cover); mSpine.map = ct(spineCanvas()); paintPage(); mEnd.map = ct(endpaperCanvas());
    mEdge.color.set(css(mix(S.theme.dom, [0, 0, 0], 0.25))); mBack.color.set(css(mix(S.theme.dom, [0, 0, 0], 0.1)));
    made.forEach((m) => { m.needsUpdate = true; });
  }
  refresh();
  const off = onChange(refresh);

  let open = !!opt.open, openT = open ? 1 : 0, t = 0, last = performance.now(), raf = 0;
  const ptr = { x: 0, y: 0 };
  let drag = false, moved = 0, lx = 0, ry = 0, vy = 0, dist = 8.3;

  function size(): void {
    const w = canvas.clientWidth || 300, hh = canvas.clientHeight || 400;
    r.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix();
    dist = 8.3 / Math.min(1, (w / hh) * (open ? 1.05 : 1.45));
  }
  size();
  window.addEventListener('resize', size);

  // Índice clicable: se busca qué renglón de la página abierta queda bajo el puntero.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function rowUnder(cx: number, cy: number): number {
    if (!opt.onPick || !open || openT < 0.9) return -1;
    const b = canvas.getBoundingClientRect();
    ndc.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects([pages, fb], false)[0];
    if (!hit || hit.object !== pages || !hit.uv || !hit.face || hit.face.normal.z < 0.5) return -1;
    return rowAt(hit.uv.x * 512, (1 - hit.uv.y) * 720, Math.min(publicTexts().length, MAXROWS));
  }
  function setHover(i: number): void {
    if (i === hover) return;
    hover = i; paintPage(); canvas.style.cursor = i >= 0 ? 'pointer' : '';
  }

  function toggle(): void { open = !open; size(); opt.onToggle?.(open); }
  const onMove = (e: PointerEvent): void => {
    const b = canvas.getBoundingClientRect();
    ptr.x = ((e.clientX - b.left) / b.width - 0.5) * 2; ptr.y = ((e.clientY - b.top) / b.height - 0.5) * 2;
    if (!drag && !(e.pointerType === 'touch')) setHover(rowUnder(e.clientX, e.clientY));
    if (drag) { const dx = e.clientX - lx; moved += Math.abs(dx); vy = dx * 0.01; ry += vy; lx = e.clientX; }
  };
  const down = (e: PointerEvent): void => { drag = true; moved = 0; lx = e.clientX; try { canvas.setPointerCapture(e.pointerId); } catch { /* ignorar */ } };
  const up = (e: PointerEvent): void => {
    const was = drag; drag = false;
    if (!was || moved >= 6) return;
    const row = rowUnder(e.clientX, e.clientY);
    if (row >= 0) { const t = publicTexts()[row]; if (t) { opt.onPick?.(t.id); return; } }
    toggle();
  };
  const leave = (): void => { ptr.x = 0; ptr.y = 0; setHover(-1); };
  const keyd = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    if (e.key === 'ArrowLeft') ry -= 0.25;
    if (e.key === 'ArrowRight') ry += 0.25;
  };
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', () => { drag = false; });
  canvas.addEventListener('pointerleave', leave); canvas.addEventListener('keydown', keyd);

  function loop(now: number): void {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
    openT += ((open ? 1 : 0) - openT) * (reduceMotion ? 1 : Math.min(1, dt * 3.4));
    if (!drag) { vy *= 0.93; ry += vy; ry *= 0.985; }
    const sway = reduceMotion ? 0 : Math.sin(t * 0.6) * 0.12;
    const baseY = (-0.55 + sway) * (1 - openT * 0.85);
    book.rotation.y += (baseY + ry + ptr.x * 0.3 * (1 - openT) - book.rotation.y) * Math.min(1, dt * 6);
    book.rotation.x += ((0.1 + ptr.y * 0.12) * (1 - openT * 0.7) - book.rotation.x) * Math.min(1, dt * 6);
    front.rotation.y = -openT * 2.78;
    book.position.x = openT * 0.8;
    book.position.y = reduceMotion ? 0 : Math.sin(t * 1.1) * 0.035;
    shadow.scale.set(1 + openT * 0.9, 1, 1); shadow.position.x = openT * 0.8;
    shMat.opacity = 0.85 - (reduceMotion ? 0 : Math.sin(t * 1.1) * 0.08);
    cam.position.set(0, 0.55, dist - openT * 1.3); cam.lookAt(0, -0.05, 0);
    r.render(scene, cam);
  }
  raf = requestAnimationFrame(loop);

  return {
    toggle,
    isOpen: () => open,
    dispose() {
      cancelAnimationFrame(raf); off(); window.removeEventListener('resize', size);
      made.forEach((m) => m.dispose()); dyn.concat([sv, sh], pageTex ? [pageTex] : []).forEach((x) => x.dispose());
      [geoBoard, geoPages, geoSpine, shGeo].forEach((g) => g.dispose()); shTex.dispose(); shMat.dispose();
      r.dispose(); try { r.forceContextLoss(); } catch { /* ignorar */ }
    },
  };
}
