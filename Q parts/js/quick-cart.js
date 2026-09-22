import { el, button, pageURL, icons } from './utils.js';
import { changeQuantity, quantityFor } from './cart-service.js';
import { busy } from './ui.js';
let panel, timer, activeCode;
export function showQuickCart(product, trigger) {
  clearTimeout(timer); panel?.remove(); activeCode = product.codigo;
  const current = el('aside', 'qp-quick-cart'); panel = current;
  current.setAttribute('aria-label', 'Ajustar producto añadido');
  const title = el('div', 'qp-quick-title');
  const status = el('strong', '', 'Añadido a tu cotización'); status.setAttribute('role', 'status');
  const close = button('Cerrar', 'x', 'qp-icon-button');
  close.onclick = hide; title.append(status, close);
  current.append(title, el('p', '', product.nombre));
  const controls = el('div', 'qp-quantity-controls');
  const less = button('Restar una unidad', 'minus', 'qp-icon-button');
  const amount = el('output', 'qp-quantity', String(quantityFor(activeCode))); amount.setAttribute('aria-label', 'Cantidad');
  const more = button('Sumar una unidad', 'plus', 'qp-icon-button');
  const remove = button('Eliminar', 'trash-2', 'qp-button qp-secondary');
  controls.append(less, amount, more, remove); current.append(controls);
  const link = el('a', 'qp-text-link', 'Ver mi cotización'); link.href = pageURL('carrito.html'); current.append(link);
  current.append(el('small', 'qp-muted', 'Se cierra tras 2 segundos sin actividad.'));
  document.body.append(current); icons();
  for (const [control, delta, erase] of [[less, -1, false], [more, 1, false], [remove, 0, true]]) {
    control.onclick = () => busy(control, async () => {
      clearTimeout(timer);
      await changeQuantity(product.codigo, delta, erase);
      if (panel !== current) return;
      amount.value = String(quantityFor(product.codigo)); amount.textContent = amount.value;
      if (!quantityFor(product.codigo)) hide(); else restart();
    });
  }
  function hide() {
    clearTimeout(timer);
    if (current.contains(document.activeElement)) trigger?.focus();
    current.remove(); if (panel === current) panel = null;
  }
  function restart() {
    clearTimeout(timer);
    // Mantener controles disponibles cuando se usan con teclado.
    if (current.querySelector(':focus-visible') || current.querySelector('[aria-busy="true"]')) return;
    timer = setTimeout(hide, 2000);
  }
  ['pointermove', 'pointerdown', 'keydown', 'focusin', 'pointerleave'].forEach(event => current.addEventListener(event, restart));
  current.addEventListener('focusout', () => setTimeout(restart, 0));
  current.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  restart();
}
