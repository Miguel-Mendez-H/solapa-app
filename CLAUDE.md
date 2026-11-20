# Solapa: contexto para Claude Code

## Qué es
Producto genérico para que cualquier autor independiente tenga una página de libro con efectos visuales. No es una página a medida de un libro. Caso de validación: el poemario *Espada un filo* (Giselle S. Vargas B.), publicación en unas 6 semanas.

## Reglas de identidad (importan: la primera versión se veía "hecha con IA")
- El color no es fijo: fondo, tinta y acento salen de la portada (`theme.ts`: `derivePalette` y `applyTheme`). Si la dominante tiene luminosidad HSL < 0.30, el tema es oscuro.
- El acento se corrige para cumplir contraste: 3:1 como relleno y 4.5:1 como texto (`ensure` en `color.ts`).
- Lenguaje visual de imprenta: esquinas rectas, filetes de 1px, etiquetas en mayúsculas monoespaciadas, marcas de corte, cartela con esquina doblada (clase `.fold`). Evitar tarjetas redondeadas, degradados morados o azul noche con ámbar.
- Tipografía: Archivo (ancha, 800, mayúsculas) para títulos, Literata para texto, Azeret Mono para etiquetas.

## Decisiones técnicas
- Three.js 0.187 (antes fijado en 0.128). Texturas con `colorSpace = SRGBColorSpace`; las luces del libro llevan `* Math.PI` porque desde r155 son físicas. Las escenas de fondo usan `outputColorSpace = LinearSRGBColorSpace` porque sus shaders escriben el color tal cual. Three se carga con `import()` dinámico (book y scenes), así que el bundle inicial es ~37 KB y `hasWebGL` vive en `util.ts` para no arrastrarlo.
- Partitura (`score.ts`): una línea `::efecto` al inicio de una estrofa (`fuego`, `grieta`, `revela`, `hueco`, `quieto`) da un efecto a esa estrofa y no se muestra. Una directiva desconocida queda como texto visible a propósito. `setFxAt` la pone/cambia/quita según el cursor del editor; `splitTitle` separa el título al importar `.md`.
- `reading.ts` conecta texto y fondo: el poema escribe scroll y estrofa actual (`override`), las escenas leen `heat`. `brasas` lo usa; el calor sube con el avance, `fuego` lo lleva a 1 y `quieto` lo apaga.
- Estrofa = `.sr` (texto completo para lectores de pantalla) + `.vis` con `aria-hidden` (palabras animadas). Las estrofas aparecen al entrar en pantalla (`.on` por IntersectionObserver), no al cargar. `revela` mueve `--o` por palabra: la luz es el puntero si se movió hace poco y, si no, la mitad de la pantalla (sirve con dedo y teclado). Con `prefers-reduced-motion` todo se ve completo y sin animar.
- `card.ts` genera la tarjeta 4:5 de una estrofa (canvas, paleta de la portada). En móvil usa el menú de compartir; en escritorio descarga el PNG.
- Migración (`upgradeSeed` en `store.ts`): si el poema de ejemplo guardado coincide con el original sin partitura, se reemplaza por la versión con efectos. Si la autora lo editó, no se toca.
- Visibilidad (`store.ts`): `public`, `link`, `private`, `scheduled`. `stateOf()` calcula el estado efectivo por fecha. Privado y programado nunca llegan al lector; "por enlace" solo con token y no entra en índice ni buscadores. La vista previa es solo de la autora.
- Portada subida: se reduce a 600x900 y se guarda como JPEG dataURL (cabe en localStorage).
- Accesibilidad: respeta `prefers-reduced-motion`, hay versión ligera sin WebGL, el libro se maneja con teclado (Enter/Espacio, flechas).
- El sangrado colgante de los versos está en `.line`; `.w` lo anula con `text-indent:0`. Sin eso las palabras se montan unas sobre otras.
- Cada vista registra su limpieza con `addCleanup` (libera WebGL y listeners). Mantener ese patrón.

## Verificado (Playwright + Chromium, 2026-11-20)
- Lomo: el texto se lee de arriba abajo y no sale espejado.
- Escenas `brasas`, `ondas` y `polvo` con portada clara y oscura (papel, bermellón, carbón, bosque).
- Aparición por estrofa, los cinco efectos, movimiento reducido, móvil táctil y la migración del poema de ejemplo.

## Pendiente de verificar a ojo
- Rendimiento real en móviles de gama baja (las capturas usaron render por software).
- Contraste mínimo de `revela` (`--o` mínimo 0.14): es intencional, pero conviene revisarlo con lectores reales.
- Si los botones "↓ Imagen" en cada estrofa estorban en móvil (siempre visibles allí).

## Próximos pasos propuestos
1. Probar con la portada plana real de *Espada un filo* (no foto con perspectiva).
1b. Audio de la autora leyendo, con resaltado palabra a palabra (marcas de tiempo con Whisper), opcional y sin sonido por defecto.
1c. Más efectos de la partitura (`oxido`, `temple`) y que el estudio los previsualice sin salir del editor.
2. Backend: Supabase (Postgres, auth, storage) para multiusuario, portadas y suscriptores reales. Páginas públicas por URL (`/@autor/libro`) con SSR o SSG para indexar.
3. Enlaces privados reales con token; la fecha programada debe evaluarse en el servidor.
4. Captura de correos con doble confirmación y baja.
5. RA opcional con `<model-viewer>` (GLB + USDZ), solo si el autor lo pide: no hay evidencia de que suba ventas.
6. Decidir si se migra a Next.js cuando haya backend.

## Comandos
`npm run dev`, `npm run build` (tipos + Vite), `npm run typecheck`.
