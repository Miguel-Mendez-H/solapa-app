# Solapa

Páginas de libro para autores independientes: un libro 3D que se abre, colores que salen de la portada, textos públicos o privados y captura de correos. Primer caso: *Espada un filo*, de Giselle S. Vargas B.

## Empezar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # comprueba tipos y genera dist/
npm run preview    # sirve dist/
```

Requiere Node 18 o superior.

## Rutas

- `#pagina`: lo que ve el lector (portada con libro 3D, índice, correo, lector de poemas).
- `#estudio`: panel de la autora (libro, textos con visibilidad, lectores).

## Estructura

```
src/
  store.ts        tipos, datos de ejemplo, guardado en localStorage, visibilidad efectiva
  color.ts        conversiones de color y contraste (WCAG)
  theme.ts        portada, paleta derivada, variables CSS, bus de cambios
  book.ts         libro 3D (Three.js)
  scenes.ts       fondos del lector: brasas, humo, ondas, polvo
  score.ts        partitura: efectos por estrofa (::fuego, ::grieta, ::revela, ::hueco, ::quieto)
  reading.ts      scroll y calor compartidos entre el poema y el fondo
  card.ts         tarjeta de una estrofa para compartir como imagen
  router.ts       navegación por hash
  dom.ts          helper h() y limpieza de vistas
  views/          page, poem, studio, subscribe
  styles.css      sistema visual
```

## Efectos por estrofa

En el estudio, pon el cursor en una estrofa y elige su efecto, o escribe a mano una línea `::efecto` al inicio de la estrofa. Esa línea no se muestra al lector.

| Efecto | Qué hace |
|---|---|
| `::fuego` | Las palabras se encienden y se enfrían; el fondo sube de calor. |
| `::grieta` | Una fractura de luz se abre en mitad de la estrofa. |
| `::revela` | Cámara oscura: el texto aparece donde pasa la luz (ratón, dedo o la mitad de la pantalla). |
| `::hueco` | Ritmo lento y un silencio antes del último verso. |
| `::quieto` | Sin movimiento; el fondo se calma. |

También puedes importar un `.md` desde el estudio: el título sale de `# Título` o de la primera línea seguida de dos líneas en blanco.

## Estado

Es un prototipo: los datos viven en `localStorage` y el formulario de correo no envía nada. Ver `CLAUDE.md` para decisiones y próximos pasos.
