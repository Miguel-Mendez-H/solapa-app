import { data, publicTexts, SCENES } from '../store';
import { addCleanup, h } from '../dom';
import { go } from '../router';
import { hasWebGL, reduceMotion, two } from '../util';
import { subscribeForm } from './subscribe';
import { backdrop } from '../backdrop';

const GL = hasWebGL();
export const webgl = GL;

function bookStage(cartela: boolean): HTMLElement {
  const art = h('div', { class: 'art' });
  art.append(backdrop());
  const fig = h('span', { class: 'mono muted fig', text: 'Fig. 1 · Toca el libro para abrirlo' });
  art.append(h('i', { class: 'crop a' }), h('i', { class: 'crop b' }), h('i', { class: 'crop c' }), h('i', { class: 'crop d' }));
  const fallback = (): HTMLElement => h('div', { class: 'book2d', text: data.book.title });
  if (GL) {
    const cv = h('canvas', { tabindex: '0', role: 'button', 'aria-label': 'Libro en 3D. Pulsa Enter para abrirlo o cerrarlo.' });
    art.append(cv);
    // Three.js pesa mucho: se descarga aparte para que el texto de la página aparezca antes.
    let dead = false, bk: { dispose(): void } | null = null;
    addCleanup(() => { dead = true; bk?.dispose(); });
    import('../book').then(({ createBook }) => {
      if (dead) return;
      bk = createBook(cv, { onPick: (id) => go('pagina', { open: id }), onToggle: (o) => { fig.textContent = o ? 'Fig. 1 · Toca un título para leerlo' : 'Fig. 1 · Toca el libro para abrirlo'; } });
    }).catch(() => { cv.remove(); art.append(fallback()); });
  } else art.append(fallback());
  art.append(fig);
  if (cartela) art.append(h('div', { class: 'cartela fold' }, h('b', { text: data.book.title }), h('span', { text: data.book.author }), h('div', { class: 'mono', text: data.book.ficha })));
  return art;
}

export function renderPage(app: HTMLElement): void {
  const pub = publicTexts();
  const hero = h('section', { class: 'hero' },
    h('div', { class: 'copy' },
      h('div', null,
        h('p', { class: 'mono muted', text: data.book.ficha }),
        h('h1', { text: data.book.title }),
        h('p', { class: 'by', text: data.book.author })),
      h('div', { class: 'row' },
        h('button', { class: 'btn solid', type: 'button', text: 'Leer un poema', onclick: () => document.getElementById('indice')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }) }))),
    bookStage(true));

  const list = h('ol', { class: 'toc' });
  pub.forEach((t, i) => {
    list.append(h('li', null, h('button', { type: 'button', onclick: () => go('pagina', { open: t.id }) },
      h('span', { class: 'n', text: two(i) }), h('span', { class: 't', text: t.title || 'Sin título' }), h('span', { class: 'lead', 'aria-hidden': 'true' }), h('span', { class: 's', text: SCENES[t.scene] }))));
  });
  if (!pub.length) list.append(h('li', { class: 'muted', style: 'padding:18px 0', text: 'Todavía no hay poemas públicos. Publica uno desde el estudio.' }));

  app.append(hero,
    h('section', { class: 'index', id: 'indice', 'aria-labelledby': 'ind-h' }, h('h2', { id: 'ind-h', class: 'mono muted', text: 'Índice' }), list),
    h('section', { class: 'join', 'aria-labelledby': 'join-h' },
      h('div', { class: 'q' }, h('h2', { id: 'join-h', text: 'Que no se te pase el siguiente.' })),
      subscribeForm('pagina', 'pg')),
    h('p', { class: 'mono foot', text: data.book.title + ' · ' + data.book.author }));
}
