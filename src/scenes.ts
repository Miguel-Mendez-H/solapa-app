import * as THREE from 'three';
import type { SceneKind } from './store';
import { S } from './theme';
import { reading, stepReading } from './reading';

const VERT = 'varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.0,1.0);}';
const NOISE = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}`;

const FRAG_HUMO = `precision mediump float; varying vec2 vUv; uniform float uTime; uniform float uAsp; uniform vec2 uMouse; uniform vec3 uG; uniform vec3 uA; uniform vec3 uI;
${NOISE}
void main(){ vec2 p=vUv*vec2(uAsp,1.0)*2.4+uMouse*0.12; float t=uTime*0.045;
 vec2 q=vec2(fbm(p+t),fbm(p+vec2(5.2,1.3)-t)); float n=fbm(p+2.2*q+vec2(0.0,t));
 vec3 col=mix(uG,uA,smoothstep(0.3,0.95,n)*0.42); col=mix(col,uI,smoothstep(0.55,0.0,n)*0.05);
 float v=smoothstep(1.2,0.25,length(vUv-0.5)*1.5); col=mix(uG,col,0.55+0.45*v); gl_FragColor=vec4(col,1.0);}`;

const FRAG_ONDAS = `precision mediump float; varying vec2 vUv; uniform float uTime; uniform float uAsp; uniform vec3 uG; uniform vec3 uA; uniform vec3 uD[8];
${NOISE}
void main(){ float acc=0.0; for(int i=0;i<8;i++){ vec2 dp=vUv-uD[i].xy; dp.x*=uAsp; float age=uTime-uD[i].z;
 if(age>0.0 && age<7.0){ float rr=length(dp); float rad=age*0.16; float w=0.004+age*0.0016;
 float ring=smoothstep(w,0.0,abs(rr-rad)); ring+=0.5*smoothstep(w,0.0,abs(rr-rad*0.72)); acc+=ring*exp(-age*0.5);} }
 float n=fbm(vUv*vec2(uAsp,1.0)*3.0+uTime*0.02); vec3 col=mix(uG,uA,clamp(acc,0.0,1.0)*0.5+n*0.05); gl_FragColor=vec4(col,1.0);}`;

// Brasas: un resplandor de forja que sube desde abajo y chispas que se elevan. El calor lo manda la lectura.
const FRAG_FORJA = `precision mediump float; varying vec2 vUv; uniform float uTime; uniform float uAsp; uniform float uHeat; uniform vec3 uG; uniform vec3 uA;
${NOISE}
void main(){ float d=length((vUv-vec2(0.5,-0.12))*vec2(uAsp*0.55,1.0));
 float n=fbm(vUv*vec2(uAsp,1.0)*2.0+vec2(0.0,-uTime*0.05));
 float glow=pow(smoothstep(1.0,0.0,d),1.6)*(0.06+0.5*uHeat)*(0.75+0.5*n);
 gl_FragColor=vec4(mix(uG,uA,clamp(glow,0.0,1.0)),1.0);}`;
const VERT_CHISPA = `attribute vec4 aSeed; uniform float uTime; uniform float uHeat; uniform float uPx; varying float vA; varying float vH;
void main(){ float speed=aSeed.x*(0.5+1.6*uHeat);
 float y=mod(position.y+5.0+uTime*speed,10.0)-5.0; float life=(y+5.0)/10.0;
 float x=position.x+sin(uTime*0.6+aSeed.y*6.28)*0.35+life*0.3*sin(aSeed.y*12.0);
 float vis=step(aSeed.w,0.1+0.9*uHeat);
 float flick=0.7+0.3*sin(uTime*(3.0+aSeed.y*5.0)+aSeed.y*40.0);
 vA=vis*flick*(1.0-smoothstep(0.55,1.0,life))*smoothstep(0.0,0.08,life); vH=1.0-life;
 vec4 mv=modelViewMatrix*vec4(x,y,position.z,1.0);
 gl_PointSize=aSeed.z*uPx*(0.6+0.8*uHeat+0.4*vH)*(7.0/-mv.z); gl_Position=projectionMatrix*mv;}`;
const FRAG_CHISPA = `precision mediump float; uniform vec3 uA; uniform vec3 uHot; varying float vA; varying float vH;
void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.0,d); a*=a;
 gl_FragColor=vec4(mix(uA,uHot,vH*vH),a*vA);}`;

type Disposable = { dispose(): void };

/** Fondo animado del lector. Devuelve la función que lo libera. */
export function startScene(canvas: HTMLCanvasElement, kind: SceneKind): () => void {
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  // Los fondos de ruido son suaves: a menos resolución se ven igual y pesan mucho menos en móviles.
  const smooth = kind !== 'polvo';
  let quality = smooth ? 0.6 : 1;
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality));
  // Los colores ya vienen en sRGB y los shaders los escriben tal cual: salida lineal para no aclararlos.
  r.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100); cam.position.z = 6;
  const th = S.theme;
  const G = th.ground.map((v) => v / 255), A = th.accent.map((v) => v / 255), I = th.ink.map((v) => v / 255);
  const mouse = { x: 0, y: 0 };
  const disposables: Disposable[] = [];
  const track = <T extends Disposable>(o: T): T => { disposables.push(o); return o; };
  const onMove = (e: PointerEvent): void => { mouse.x = e.clientX / innerWidth; mouse.y = 1 - e.clientY / innerHeight; };
  window.addEventListener('pointermove', onMove);
  const v3 = (a: number[]): THREE.Vector3 => new THREE.Vector3(a[0], a[1], a[2]);

  let tick: ((t: number, dt: number) => void) | null = null;
  let px: { value: number } | null = null;
  let uAsp: { value: number } | null = null;

  if (kind === 'brasas') {
    const N = 520, pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 17; pos[i * 3 + 1] = Math.random() * 10 - 5; pos[i * 3 + 2] = Math.random() * 7 - 4;
      seed[i * 4] = 0.25 + Math.random() * 0.65; seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = 8 + Math.random() * 20; seed[i * 4 + 3] = Math.random();
    }
    const hot = th.dark ? [A[0] + (1 - A[0]) * 0.6, A[1] + (0.93 - A[1]) * 0.6, A[2] + (0.75 - A[2]) * 0.6] : A.map((v) => v * 0.7);
    const uni: Record<string, THREE.IUniform> = {
      uTime: { value: 0 }, uAsp: { value: 1 }, uHeat: { value: reading.heat }, uG: { value: v3(G) }, uA: { value: v3(A) },
      uHot: { value: v3(hot) }, uPx: { value: quality },
    };
    const pg = track(new THREE.PlaneGeometry(2, 2));
    const pm = track(new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG_FORJA, depthTest: false, depthWrite: false }));
    const plane = new THREE.Mesh(pg, pm); plane.frustumCulled = false; plane.renderOrder = -1; scene.add(plane);
    const g = track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = track(new THREE.ShaderMaterial({
      uniforms: uni, vertexShader: VERT_CHISPA, fragmentShader: FRAG_CHISPA, transparent: true, depthTest: false, depthWrite: false,
      blending: th.dark ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 1; scene.add(pts);
    uAsp = uni.uAsp; px = uni.uPx;
    tick = (t, dt) => { uni.uTime.value = t; uni.uHeat.value = stepReading(dt); };
  } else if (kind === 'polvo') {
    const N = 520, pos = new Float32Array(N * 3), spd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16; pos[i * 3 + 1] = (Math.random() - 0.5) * 10; pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      spd[i] = 0.05 + Math.random() * 0.16;
    }
    const g = track(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sc = document.createElement('canvas'); sc.width = sc.height = 64;
    const sx = sc.getContext('2d')!, sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 64, 64);
    const sp = track(new THREE.CanvasTexture(sc));
    const m = track(new THREE.PointsMaterial({
      size: 0.24, map: sp, transparent: true, opacity: th.dark ? 0.7 : 0.55, depthWrite: false,
      color: new THREE.Color(A[0], A[1], A[2]), blending: th.dark ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    scene.add(new THREE.Points(g, m));
    r.setClearColor(new THREE.Color(G[0], G[1], G[2]), 1);
    tick = (t, dt) => {
      for (let k = 0; k < N; k++) {
        pos[k * 3 + 1] += spd[k] * dt; pos[k * 3] += Math.sin(t * 0.3 + k) * 0.0018;
        if (pos[k * 3 + 1] > 5) pos[k * 3 + 1] = -5;
      }
      (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    };
  } else {
    const drops: THREE.Vector3[] = [];
    for (let d = 0; d < 8; d++) drops.push(new THREE.Vector3(0.5, 0.5, -99));
    const uni: Record<string, THREE.IUniform> = {
      uTime: { value: 0 }, uAsp: { value: 1 }, uMouse: { value: new THREE.Vector2(0, 0) },
      uG: { value: v3(G) }, uA: { value: v3(A) }, uI: { value: v3(I) },
    };
    if (kind === 'ondas') uni.uD = { value: drops };
    uAsp = uni.uAsp;
    const pg = track(new THREE.PlaneGeometry(2, 2));
    const pm = track(new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: kind === 'ondas' ? FRAG_ONDAS : FRAG_HUMO, depthTest: false, depthWrite: false }));
    const plane = new THREE.Mesh(pg, pm); plane.frustumCulled = false; scene.add(plane);
    let di = 0, lastDrop = -9, lx = -1, ly = -1;
    const spawn = (x: number, y: number, t: number): void => { drops[di].set(x, y, t); di = (di + 1) % 8; lastDrop = t; };
    tick = (t) => {
      uni.uTime.value = t; (uni.uMouse.value as THREE.Vector2).set(mouse.x - 0.5, mouse.y - 0.5);
      if (kind === 'ondas') {
        const moved = Math.hypot(mouse.x - lx, mouse.y - ly);
        if (moved > 0.06 && t - lastDrop > 0.35 && lx >= 0) spawn(mouse.x, mouse.y, t);
        if (lx < 0 || moved > 0.06) { lx = mouse.x; ly = mouse.y; }
        if (t - lastDrop > 2.8) spawn(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6, t);
      }
    };
  }

  function size(): void {
    const w = canvas.clientWidth || innerWidth, hh = canvas.clientHeight || innerHeight;
    r.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix();
    if (uAsp) uAsp.value = w / hh;
  }
  size();
  window.addEventListener('resize', size);

  let raf = 0, last = performance.now(), t = 0, slow = 0;
  function loop(now: number): void {
    raf = requestAnimationFrame(loop);
    // El fondo se dibuja a ~30 cuadros: no se nota y deja libre la GPU para el texto y el scroll.
    if (now - last < 30) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    // Si aun así va lento, baja la resolución del fondo (hasta 0.35) en vez de robar fps al resto.
    if (dt > 0.045 && quality > 0.35 && ++slow > 20) { slow = 0; quality = Math.max(0.35, quality * 0.8); r.setPixelRatio(quality); if (px) px.value = quality; size(); }
    last = now; t += dt;
    cam.position.x += ((mouse.x - 0.5) * 1.2 - cam.position.x) * 0.03;
    cam.position.y += ((mouse.y - 0.5) * 0.8 - cam.position.y) * 0.03;
    cam.lookAt(0, 0, 0);
    tick?.(t, dt);
    r.render(scene, cam);
  }
  raf = requestAnimationFrame(loop);
  // Pestaña oculta: se detiene el dibujo y se retoma sin salto al volver.
  const onVis = (): void => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    cancelAnimationFrame(raf); raf = 0; document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pointermove', onMove); window.removeEventListener('resize', size);
    disposables.forEach((o) => { try { o.dispose(); } catch { /* ignorar */ } });
    r.dispose(); try { r.forceContextLoss(); } catch { /* ignorar */ }
  };
}
