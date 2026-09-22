import { observeCart, changeQuantity, clearCart } from './cart-service.js';
import { observeSession, session, loginURL } from './session.js';
import { cartTotal } from './cart-model.js';
import { el, button, money, icons, productImage, pageURL, errorMessage } from './utils.js';
import { busy, confirmDialog, notify } from './ui.js';
import { getBackend } from './backend.js';
import { createQuotePDF } from './quote-pdf.js';

export function initCartPage() {
  const list = document.querySelector('#listaCarrito'); if (!list) return;
  const total = document.querySelector('#total');
  const pdf = document.querySelector('#generarPDF'), empty = document.querySelector('#vaciarCarrito');
  let items = [], exporting = false;
  function render() {
    list.replaceChildren(); total.textContent = money(cartTotal(items));
    pdf.disabled = empty.disabled = exporting || !session.user || !items.length;
    if (!session.ready) { list.append(el('p', 'qp-empty', 'Conectando con tu cotización…')); return; }
    if (!session.user || !items.length) {
      const box = el('div', 'qp-empty');
      box.append(el('h2', '', session.user ? 'Tu cotización está vacía' : 'Inicia sesión para ver tu cotización'), el('p', '', session.user ? 'Explora las marcas y añade los repuestos que necesitas.' : 'Tus productos se guardan en tu cuenta.'));
      const link = el('a', 'qp-button', session.user ? 'Explorar catálogo' : 'Iniciar sesión'); link.href = session.user ? pageURL('catalogodemarcas.html') : loginURL(); box.append(link); list.append(box); return;
    }
    for (const item of items) {
      const row = el('article', 'qp-cart-item');
      const img = el('img'); img.src = productImage(item.imagen); img.alt = item.nombre || 'Repuesto'; img.loading = 'lazy';
      img.onerror = () => { img.onerror = null; img.src = pageURL('img/logoicon.png'); };
      const detail = el('div'); detail.append(el('h3', '', item.nombre), el('p', 'qp-muted', `Código: ${item.codigo} · ${item.auto || ''} ${item.modelo || ''}`), el('p', '', `${money(item.precio)} por unidad`));
      const controls = el('div', 'qp-quantity-controls');
      const less = button(`Restar una unidad de ${item.nombre}`, 'minus', 'qp-icon-button');
      const more = button(`Sumar una unidad de ${item.nombre}`, 'plus', 'qp-icon-button');
      const remove = button(`Eliminar ${item.nombre}`, 'trash-2', 'qp-icon-button qp-danger');
      const amount = el('output', 'qp-quantity', item.cantidad); amount.setAttribute('aria-label', 'Cantidad');
      controls.append(less, amount, more, remove); detail.append(controls);
      for (const [control, delta, erase] of [[less,-1,false],[more,1,false],[remove,0,true]]) {
        control.disabled = exporting;
        control.onclick = () => busy(control, async () => {
          const byKeyboard = control.matches(':focus-visible');
          await changeQuantity(item.codigo, delta, erase);
          if (byKeyboard) (list.querySelector(`[data-focus-key="${control.dataset.focusKey}"]`) || empty).focus();
        });
        control.dataset.focusKey = `${items.indexOf(item)}-${delta}-${erase}`;
      }
      row.append(img, detail, el('strong', 'qp-price', money(Math.round(Number(item.precio) * 100) * item.cantidad / 100))); list.append(row);
    }
    icons();
  }
  observeCart(value => { items = value; render(); }); observeSession(render);
  empty.addEventListener('click', async () => {
    if (!await confirmDialog('Vaciar cotización', 'Se quitarán todos los productos de tu cotización. ¿Deseas continuar?', 'Vaciar')) return;
    await busy(empty, async () => { try { await clearCart(); notify('Cotización vaciada.', 'success'); } catch(error) { notify(errorMessage(error), 'error'); } });
    render();
  });
  pdf.addEventListener('click', async () => {
    if (exporting || pdf.disabled) return;
    await busy(pdf, async () => {
      exporting = true; render();
      let saved = false;
      try {
        const user = session.user;
        if (!user || !items.length) return;
        const quotedItems = items.map(item => ({ ...item }));
        const api = await getBackend();
        const data = (await api.get(api.ref(api.db, `usuarios/${user.uid}`))).val() || {};
        if (!data.nombre || !data.dui || !data.telefono || !data.direccion) { notify('Completa nombre, DUI, teléfono y dirección en Mi perfil antes de generar el PDF.', 'info'); return; }
        if (!window.jspdf?.jsPDF || !window.jspdf.jsPDF.API.autoTable) { notify('No se pudo cargar el generador de PDF. Revisa la conexión y recarga la página.', 'error'); return; }
        const date = new Date(), reference = 'QP-' + date.toISOString().replace(/\D/g, '').slice(0, 14);
        const doc = await createQuotePDF(data, quotedItems, reference, date);
        if (session.user?.uid !== user.uid) { notify('La sesión cambió. Inicia sesión de nuevo para generar tu cotización.', 'info'); return; }
        await doc.save(`${reference}.pdf`, { returnPromise: true });
        saved = true;
        const cleared = await clearCart(quotedItems, user.uid);
        notify(cleared ? 'PDF generado. Tu cotización se ha vaciado.' : 'PDF generado. El carrito cambió durante la descarga y se conserva para no perder productos.', cleared ? 'success' : 'info');
      } catch (error) {
        notify(saved ? 'El PDF se generó, pero no se pudo vaciar el carrito. Puedes usar Vaciar Cotizador para reintentarlo.' : errorMessage(error), 'error');
      } finally { exporting = false; }
    });
    render();
  });
}
