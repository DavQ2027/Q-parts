import { el, button } from './utils.js';

// Recupera el aviso animado de bienvenida y la acción Continuar del login original.
export function welcomeDialog(message = 'Has iniciado sesión correctamente.') {
  return new Promise(resolve => {
    const dialog = el('dialog', 'qp-dialog qp-auth-success');
    dialog.setAttribute('aria-labelledby', 'qp-welcome-title');
    dialog.setAttribute('aria-describedby', 'qp-welcome-message');
    const mark = el('div', 'qp-success-mark'); mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28"/><path d="m18 32 9 9 19-20"/></svg>';
    const heading = el('h2', '', '¡Bienvenido de nuevo!'); heading.id = 'qp-welcome-title';
    const description = el('p', '', message); description.id = 'qp-welcome-message';
    const next = button('Continuar');
    const finish = () => { dialog.close(); dialog.remove(); resolve(); };
    next.onclick = finish;
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
    dialog.append(mark, heading, description, next); document.body.append(dialog);
    dialog.showModal(); next.focus();
  });
}
