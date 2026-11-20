import './styles.css';
import { data, ui } from './store';
import { setCleanup } from './dom';
import { applyNext, setRenderer } from './router';
import { makeNoise, refreshTheme, setCoverImgFromData } from './theme';
import { renderPage } from './views/page';
import { renderPoem } from './views/poem';
import { renderStudio } from './views/studio';

const app = document.getElementById('app')!;

function render(): void {
  const route = location.hash === '#estudio' ? 'estudio' : 'pagina';
  document.getElementById('nav-estudio')!.setAttribute('aria-current', route === 'estudio' ? 'page' : 'false');
  document.getElementById('nav-pagina')!.setAttribute('aria-current', route === 'pagina' ? 'page' : 'false');
  setCleanup(null);
  app.replaceChildren();
  window.scrollTo(0, 0);
  if (route === 'estudio') renderStudio(app);
  else if (ui.open) renderPoem(app, render);
  else renderPage(app);
}

setRenderer(render);
window.addEventListener('hashchange', () => { applyNext(); render(); });

try { document.documentElement.style.setProperty('--grain', `url(${makeNoise()})`); } catch { /* sin canvas */ }
refreshTheme();
setCoverImgFromData();
// Las fuentes llegan tarde: al cargarlas se vuelve a dibujar la portada con la tipografía real.
document.fonts?.ready.then(() => { if (!(data.book.cover.kind === 'image' && data.book.cover.img)) refreshTheme(); });
render();
