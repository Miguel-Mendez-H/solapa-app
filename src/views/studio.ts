import { byId, data, PRESETS, publicTexts, save, SCENES, ui, VIS, type BgMode, type Mode, type SceneKind, type Text, type Visibility } from '../store';
import { addCleanup, chip, copy, h } from '../dom';
import { hex, css, lum } from '../color';
import { backdrop, paintBackdrop } from '../backdrop';
import { applyTheme, drawFit, notify, onChange, refreshTheme, S } from '../theme';
import { go } from '../router';
import { inDays, token, uid, two } from '../util';
import { webgl } from './page';
import { FX, FX_KINDS, setFxAt, splitTitle, type FxKind } from '../score';

export function renderStudio(app: HTMLElement): void {
  const forms = h('div', { class: 'forms' });
  const side = h('aside', { class: 'side', 'aria-label': 'Vista previa' });
  app.append(h('div', { class: 'studio' }, forms, side));
  buildBookSection(forms);
  forms.append(h('section', { class: 'sec', 'aria-labelledby': 'sec-t' }, h('h2', { id: 'sec-t' }, 'Textos ', h('span', { text: '02' })),
    h('ul', { class: 'list', id: 'list' }),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', text: 'Nuevo texto', onclick: newText }), importer()),
    h('div', { id: 'editor', style: 'margin-top:24px', 'aria-label': 'Editor de texto' })));
  forms.append(h('section', { class: 'sec', 'aria-labelledby': 'sec-l' }, h('h2', { id: 'sec-l' }, 'Lectores ', h('span', { text: '03' })), h('div', { id: 'readers' })));
  buildSide(side); refreshList(); buildEditor(); refreshReaders();
}

let coverTimer = 0;
function coverSoon(): void {
  clearTimeout(coverTimer);
  coverTimer = window.setTimeout(() => {
    if (data.book.cover.kind === 'preset') refreshTheme(); else { applyTheme(); notify(); }
  }, 250);
}

function buildBookSection(forms: HTMLElement): void {
  const b = data.book;
  function field(id: string, label: string, val: string, key: 'title' | 'author' | 'ficha', max = '80'): HTMLElement {
    const i = h('input', { id, class: 'in', type: 'text', maxlength: max }); i.value = val;
    i.addEventListener('input', () => { b[key] = i.value; save(); coverSoon(); });
    return h('div', { class: 'field' }, h('label', { for: id, text: label }), i);
  }
  const presets = h('div', { class: 'presets', role: 'group', 'aria-label': 'Portadas de ejemplo' });
  function paintPresets(): void {
    presets.replaceChildren();
    Object.keys(PRESETS).forEach((k) => {
      const p = PRESETS[k], on = b.cover.kind === 'preset' && b.cover.preset === k;
      presets.append(h('button', {
        class: 'preset', type: 'button', 'aria-pressed': on ? 'true' : 'false', style: 'background:' + css(p.bg) + ';color:' + css(p.fg),
        onclick: () => { b.cover = { kind: 'preset', preset: k, img: '' }; S.coverImg = null; save(); refreshTheme(); paintPresets(); },
      }, 'Aa', h('small', { text: p.name })));
    });
  }
  paintPresets();

  // Subida de portada: se reduce a 600x900 y se guarda como JPEG para no llenar localStorage.
  const fileMsg = h('span', { class: 'status', 'aria-live': 'polite' });
  const file = h('input', { id: 'f-cover', class: 'file', type: 'file', accept: 'image/*' });
  file.addEventListener('change', () => {
    const f = file.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = 600; c.height = 900; drawFit(c.getContext('2d')!, im, 600, 900);
        b.cover = { kind: 'image', preset: b.cover.preset, img: c.toDataURL('image/jpeg', 0.86) };
        S.coverImg = c; save(); refreshTheme(); paintPresets(); fileMsg.textContent = 'Portada cargada. Los colores de la página se recalcularon.';
      };
      im.onerror = () => { fileMsg.textContent = 'No se pudo leer esa imagen. Prueba con un JPG o PNG.'; };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(f);
  });
  const upload = h('label', { class: 'btn', for: 'f-cover', text: 'Subir portada' });

  // Fondo detrás del libro: liso, la propia portada difuminada o una imagen aparte.
  const bgMsg = h('span', { class: 'status', 'aria-live': 'polite' });
  const bgFile = h('input', { id: 'f-bg', class: 'file', type: 'file', accept: 'image/*' });
  const bgUp = h('label', { class: 'btn', for: 'f-bg', text: 'Subir imagen' });
  const bgSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Fondo del libro' });
  const bgNow = (): string => b.bg ?? (b.cover.kind === 'image' ? 'cover' : 'none');
  const bgPaint = (): void => { bgUp.style.display = bgNow() === 'image' ? '' : 'none'; notify(); };
  ([['none', 'Liso'], ['cover', 'Portada'], ['image', 'Imagen']] as Array<[BgMode, string]>).forEach(([val, label]) => {
    const r = h('input', { type: 'radio', name: 'bgmode', value: val }); r.checked = bgNow() === val;
    r.addEventListener('change', () => {
      b.bg = val; save(); bgPaint();
      bgMsg.textContent = val === 'image' && !b.bgImg ? 'Sube una imagen para usarla de fondo.' : '';
    });
    bgSeg.append(h('label', null, r, label));
  });
  bgFile.addEventListener('change', () => {
    const f = bgFile.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const sc = Math.min(1, 1200 / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
        const prev = [b.bgImg, b.bg] as const; b.bgImg = c.toDataURL('image/jpeg', 0.8); b.bg = 'image';
        try { localStorage.setItem('solapa-v2', JSON.stringify(data)); } catch { b.bgImg = prev[0]; b.bg = prev[1]; bgMsg.textContent = 'La imagen es demasiado pesada para guardarse. Prueba con una más pequeña.'; return; }
        bgPaint(); bgMsg.textContent = 'Fondo cargado.';
        bgSeg.querySelectorAll<HTMLInputElement>('input').forEach((i) => { i.checked = i.value === 'image'; });
      };
      im.onerror = () => { bgMsg.textContent = 'No se pudo leer esa imagen. Prueba con un JPG o PNG.'; };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(f);
  });
  bgPaint();

  const modeSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Fondo de la página' });
  ([['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']] as Array<[Mode, string]>).forEach(([val, label]) => {
    const r = h('input', { type: 'radio', name: 'mode', value: val }); r.checked = b.mode === val;
    r.addEventListener('change', () => { b.mode = val; save(); refreshTheme(); });
    modeSeg.append(h('label', null, r, label));
  });

  forms.append(h('section', { class: 'sec', style: 'border-top:0;padding-top:0', 'aria-labelledby': 'sec-b' },
    h('h2', { id: 'sec-b' }, 'Libro ', h('span', { text: '01' })),
    field('f-title-b', 'Título', b.title, 'title'), field('f-author', 'Autoría', b.author, 'author'), field('f-ficha', 'Ficha (género, año…)', b.ficha, 'ficha', '60'),
    h('div', { class: 'field' }, h('span', { class: 'mono muted', text: 'Portada' }), presets, h('div', { class: 'row' }, file, upload, fileMsg),
      h('span', { class: 'hint', text: 'Sube la imagen frontal del libro. El libro 3D, el fondo y el color de acento salen de ella.' })),
    h('div', { class: 'field' }, h('span', { class: 'mono muted', text: 'Fondo del libro' }), bgSeg, h('div', { class: 'row' }, bgFile, bgUp, bgMsg),
      h('span', { class: 'hint', text: 'Portada: usa la imagen de la portada difuminada. Imagen: una foto o textura tuya, detrás del libro.' })),
    h('div', { class: 'field' }, h('span', { class: 'mono muted', text: 'Fondo de la página' }), modeSeg)));
}

function buildSide(side: HTMLElement): void {
  const pv = h('div', { class: 'pv' });
  const bd = backdrop(); pv.append(bd); addCleanup(onChange(() => paintBackdrop(bd)));
  const fallback = (): HTMLElement => h('div', { class: 'book2d', text: data.book.title });
  if (webgl) {
    const cv = h('canvas', { tabindex: '0', role: 'button', 'aria-label': 'Vista previa del libro en 3D' }); pv.append(cv);
    let dead = false, bk: { dispose(): void } | null = null;
    addCleanup(() => { dead = true; bk?.dispose(); });
    import('../book').then(({ createBook }) => { if (!dead) bk = createBook(cv); }).catch(() => { cv.remove(); pv.append(fallback()); });
  } else pv.append(fallback());

  const sw = h('div', { class: 'swatches', id: 'swatches', 'aria-label': 'Colores derivados de la portada' });
  function paintSw(): void {
    sw.replaceChildren();
    const th = S.theme;
    const onDom = lum(th.dom) > 0.4 ? ([20, 20, 20] as const) : ([244, 240, 232] as const);
    ([['Fondo', th.ground, th.ink], ['Tinta', th.ink, th.ground], ['Acento', th.accent, th.onAccent], ['Portada', th.dom, onDom]] as const).forEach(([name, bg, fg]) => {
      sw.append(h('div', { class: 'sw', style: 'background:' + css(bg) + ';color:' + css([...fg] as [number, number, number]) }, name, h('span', { text: hex(bg) })));
    });
  }
  paintSw(); addCleanup(onChange(paintSw));
  side.append(h('p', { class: 'mono muted', style: 'margin-bottom:10px', text: 'Vista previa · pulsa para abrir' }), pv,
    h('p', { class: 'mono muted', style: 'margin:18px 0 10px', text: 'Colores leídos de la portada' }), sw,
    h('div', { class: 'row', style: 'margin-top:18px' }, h('button', { class: 'btn solid', type: 'button', text: 'Ver mi página', onclick: () => go('pagina') })));
}

function refreshReaders(): void {
  const box = document.getElementById('readers'); if (!box) return;
  const msg = h('span', { class: 'status', 'aria-live': 'polite' });
  box.replaceChildren(
    h('div', { class: 'stats' },
      h('div', null, h('b', { text: String(data.subs.length) }), h('span', { class: 'mono', text: 'Suscriptores (demo)' })),
      h('div', null, h('b', { text: String(publicTexts().length) }), h('span', { class: 'mono', text: 'Poemas públicos' }))),
    h('div', { class: 'row' }, h('button', {
      class: 'btn small', type: 'button', text: 'Copiar CSV',
      onclick: () => copy(['email,fecha,origen'].concat(data.subs.map((x) => [x.email, x.at, x.from || ''].join(','))).join('\n'), msg, 'CSV copiado'),
    }), msg));
}

function refreshList(): void {
  const ul = document.getElementById('list'); if (!ul) return; ul.replaceChildren();
  data.texts.forEach((t, i) => {
    const on = t.id === ui.sel;
    ul.append(h('li', null, h('button', { class: 'item', type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: () => { ui.sel = t.id; refreshList(); buildEditor(); } },
      h('span', { class: 'n', text: two(i) }), h('span', { class: 'it', text: t.title || 'Sin título' }), chip(t))));
  });
}

/** Importa un .md o .txt: el título sale de `# Título` o de la primera línea seguida de dos en blanco. */
function importer(): HTMLElement {
  const msg = h('span', { class: 'status', 'aria-live': 'polite' });
  const file = h('input', { id: 'f-import', class: 'file', type: 'file', accept: '.md,.txt,text/plain,text/markdown' });
  file.addEventListener('change', () => {
    const f = file.files?.[0]; if (!f) return;
    f.text().then((raw) => {
      const { title, body } = splitTitle(raw, f.name.replace(/\.[^.]+$/, ''));
      const t: Text = { id: uid(), title, body, scene: 'brasas', visibility: 'private', publishAt: '', token: '' };
      data.texts.unshift(t); ui.sel = t.id; save(); refreshList(); refreshReaders(); buildEditor();
      msg.textContent = 'Importado como privado: «' + title + '».';
    }, () => { msg.textContent = 'No se pudo leer ese archivo.'; });
    file.value = '';
  });
  return h('span', { class: 'row' }, file, h('label', { class: 'btn', for: 'f-import', text: 'Importar .md' }), msg);
}

function newText(): void {
  const t: Text = { id: uid(), title: 'Sin título', body: '', scene: 'brasas', visibility: 'private', publishAt: '', token: '' };
  data.texts.unshift(t); ui.sel = t.id; save(); refreshList(); refreshReaders(); buildEditor();
  const f = document.getElementById('f-title') as HTMLInputElement | null; f?.focus(); f?.select();
}

function buildEditor(): void {
  const ed = document.getElementById('editor'); if (!ed) return; ed.replaceChildren();
  const t = byId(ui.sel);
  if (!t) { ed.append(h('p', { class: 'muted', text: 'Crea o elige un texto para editarlo.' })); return; }
  const status = h('span', { class: 'status', 'aria-live': 'polite', text: 'Guardado en este navegador' });
  const touch = (m?: string): void => { save(); refreshList(); refreshReaders(); status.textContent = m || 'Guardado en este navegador'; };

  const title = h('input', { id: 'f-title', class: 'in', type: 'text', maxlength: '80' }); title.value = t.title;
  title.addEventListener('input', () => { t.title = title.value; touch(); });
  const body = h('textarea', { id: 'f-body', class: 'in', rows: '12' }); body.value = t.body;
  body.addEventListener('input', () => { t.body = body.value; touch(); });
  // Efecto de la estrofa donde está el cursor: se escribe como una línea ::efecto al inicio de la estrofa.
  const fxRow = h('div', { class: 'fxrow', role: 'group', 'aria-label': 'Efecto de la estrofa donde está el cursor' });
  const fxNow = (): FxKind | null => {
    const r = setFxAt(body.value, body.selectionStart, null), had = r.body !== body.value;
    if (!had) return null;
    return FX_KINDS.find((k) => setFxAt(body.value, body.selectionStart, k).body === body.value) ?? null;
  };
  const paintFx = (): void => {
    const cur = fxNow();
    fxRow.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.fx || '') === (cur ?? ''))));
  };
  const applyFx = (fx: FxKind | null): void => {
    const r = setFxAt(body.value, body.selectionStart, fx);
    body.value = r.body; t.body = r.body; body.focus(); body.setSelectionRange(r.caret, r.caret); touch(); paintFx();
  };
  fxRow.append(h('button', { class: 'btn small', type: 'button', 'data-fx': '', text: 'Sin efecto', onclick: () => applyFx(null) }));
  FX_KINDS.forEach((k) => fxRow.append(h('button', { class: 'btn small', type: 'button', 'data-fx': k, title: FX[k].desc, text: FX[k].name, onclick: () => applyFx(k) })));
  ['keyup', 'click', 'focus'].forEach((ev) => body.addEventListener(ev, paintFx));
  queueMicrotask(paintFx);
  const scene = h('select', { id: 'f-scene', class: 'in' });
  (Object.keys(SCENES) as SceneKind[]).forEach((k) => scene.append(h('option', { value: k, text: SCENES[k] }))); scene.value = t.scene;
  scene.addEventListener('change', () => { t.scene = scene.value as SceneKind; touch(); });

  const dateIn = h('input', { id: 'f-date', class: 'in', type: 'date' }); dateIn.value = t.publishAt || '';
  dateIn.addEventListener('change', () => { t.publishAt = dateIn.value; touch(); });
  const dateRow = h('div', { class: 'field' }, h('label', { for: 'f-date', text: 'Se publica el' }), dateIn, h('span', { class: 'hint', text: 'Ese día pasa a público sin que hagas nada.' }));
  dateRow.hidden = t.visibility !== 'scheduled';

  const linkIn = h('input', { id: 'f-link', class: 'in', type: 'text', readonly: true });
  const linkUrl = (): string => 'solapa.example/p/' + t.token;
  linkIn.value = linkUrl();
  const linkMsg = h('span', { class: 'status', 'aria-live': 'polite' });
  const linkRow = h('div', { class: 'field' }, h('label', { for: 'f-link', text: 'Enlace privado' }),
    h('div', { class: 'linkrow' }, linkIn,
      h('button', { class: 'btn small', type: 'button', text: 'Copiar', onclick: () => copy(linkUrl(), linkMsg, 'Enlace de ejemplo copiado') }),
      h('button', { class: 'btn small', type: 'button', text: 'Generar otro', onclick: () => { t.token = token(); linkIn.value = linkUrl(); touch(); linkMsg.textContent = 'El enlace anterior deja de funcionar.'; } }),
      h('button', { class: 'btn small', type: 'button', text: 'Abrir como lector', onclick: () => go('pagina', { open: t.id, asLink: true }) })), linkMsg);
  linkRow.hidden = t.visibility !== 'link';

  const desc = h('span', { class: 'hint', text: VIS[t.visibility].desc });
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Quién puede leerlo' });
  (Object.keys(VIS) as Visibility[]).forEach((k) => {
    const r = h('input', { type: 'radio', name: 'vis', value: k }); r.checked = t.visibility === k;
    r.addEventListener('change', () => {
      t.visibility = k; desc.textContent = VIS[k].desc;
      if (k === 'scheduled' && !t.publishAt) { t.publishAt = inDays(14); dateIn.value = t.publishAt; }
      if (k === 'link' && !t.token) { t.token = token(); linkIn.value = linkUrl(); }
      dateRow.hidden = k !== 'scheduled'; linkRow.hidden = k !== 'link'; touch();
    });
    seg.append(h('label', null, r, VIS[k].name));
  });

  // Eliminar pide una segunda pulsación en lugar de un diálogo.
  let armed = false;
  const del = h('button', { class: 'btn danger', type: 'button', text: 'Eliminar' });
  del.addEventListener('click', () => {
    if (!armed) { armed = true; del.textContent = 'Confirmar'; setTimeout(() => { armed = false; del.textContent = 'Eliminar'; }, 4000); return; }
    data.texts = data.texts.filter((x) => x.id !== t.id); ui.sel = data.texts[0]?.id ?? null;
    save(); refreshList(); refreshReaders(); buildEditor();
  });

  ed.append(
    h('div', { class: 'field' }, h('label', { for: 'f-title', text: 'Título del texto' }), title),
    h('div', { class: 'field' }, h('label', { for: 'f-body', text: 'Texto' }), body,
      h('span', { class: 'hint', text: 'Un verso por línea. Una línea en blanco separa las estrofas. Pon el cursor en una estrofa y elige su efecto:' }), fxRow),
    h('div', { class: 'field' }, h('label', { for: 'f-scene', text: 'Escena del lector' }), scene),
    h('div', { class: 'field' }, h('span', { class: 'mono muted', text: 'Quién puede leerlo' }), seg, desc),
    dateRow, linkRow,
    h('div', { class: 'row' }, h('button', { class: 'btn solid', type: 'button', text: 'Vista previa', onclick: () => go('pagina', { open: t.id, preview: true }) }), del, status));
}
