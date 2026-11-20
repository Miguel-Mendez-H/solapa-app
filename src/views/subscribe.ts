import { data, save } from '../store';
import { h } from '../dom';
import { today } from '../util';

/** Formulario de correo con consentimiento. En la demo solo guarda en localStorage. */
export function subscribeForm(origin: string, idp: string): HTMLFormElement {
  const email = h('input', { id: idp + '-email', class: 'in', type: 'email', placeholder: 'tu@correo.com', autocomplete: 'email', 'aria-label': 'Tu correo' });
  const chk = h('input', { id: idp + '-chk', type: 'checkbox' });
  const msg = h('span', { class: 'status', 'aria-live': 'polite' });
  const form = h('form', { novalidate: true }, email,
    h('label', { class: 'consent', for: idp + '-chk' }, chk, h('span', { text: 'Acepto recibir correos de ' + (data.book.author || 'la autora') + '. Puedo darme de baja cuando quiera.' })),
    h('div', { class: 'row' }, h('button', { class: 'btn solid', type: 'submit', text: 'Avísame' }), msg));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(v)) { msg.textContent = 'Revisa el correo: falta el @ o el dominio.'; email.focus(); return; }
    if (!chk.checked) { msg.textContent = 'Marca la casilla para poder anotarte.'; return; }
    if (!data.subs.some((s) => s.email === v)) data.subs.push({ email: v, at: today(), from: origin });
    save(); form.reset(); msg.textContent = 'Anotado en esta demo. No se envía a ningún sitio.';
  });
  return form;
}
