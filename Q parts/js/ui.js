import { el, button, icons } from './utils.js';

export function notify(message, type = 'info') {
  let stack = document.querySelector('#qp-notifications');
  if (!stack) { stack = el('div', 'qp-notifications'); stack.id = 'qp-notifications'; document.body.append(stack); }
  const item = el('div', `qp-toast qp-${type}`);
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');
  item.append(el('span', '', message));
  const close = button('Cerrar aviso', 'x', 'qp-icon-button');
  close.title = 'Cerrar aviso'; close.onclick = () => item.remove(); item.append(close);
  stack.append(item); icons(); setTimeout(() => item.remove(), 6500);
}

// <dialog> usa la capa superior del navegador: nunca queda detrás del menú.
export function confirmDialog(title, message, accept = 'Confirmar', cancel = 'Cancelar') {
  return new Promise(resolve => {
    const previous = document.activeElement;
    const dialog = el('dialog', 'qp-dialog');
    const heading = el('h2', '', title); heading.id = 'qp-dialog-title';
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.append(heading, el('p', '', message));
    const actions = el('div', 'qp-dialog-actions');
    const no = button(cancel, null, 'qp-button qp-secondary');
    const yes = button(accept, null, 'qp-button');
    actions.append(no, yes); dialog.append(actions); document.body.append(dialog);
    const finish = value => { dialog.close(); dialog.remove(); previous?.focus(); resolve(value); };
    no.onclick = () => finish(false); yes.onclick = () => finish(true);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    dialog.showModal(); no.focus();
  });
}
export async function busy(control, action) {
  if (control.disabled) return;
  control.disabled = true; control.setAttribute('aria-busy', 'true');
  try { return await action(); }
  finally { control.disabled = false; control.removeAttribute('aria-busy'); }
}
