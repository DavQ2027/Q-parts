import { el, money, pageURL } from './utils.js';
import { changeQuantity } from './cart-service.js';
import { session, loginURL } from './session.js';

// El navegador solo llama a nuestra API. La clave y el prompt viven en el servidor.
export function initChatClient({ input, send, messages }) {
  let pending = false;
  let history = [];
  const scroll = () => { messages.scrollTop = messages.scrollHeight; };
  const bubble = (text, type = 'bot') => el('div', `chat-bubble ${type}-bubble`, text);
  function append(node) {
    messages.append(node);
    while (messages.children.length > 40) messages.firstElementChild.remove();
    scroll();
  }
  function link(label, path) {
    const a = el('a', 'qp-chat-link', label);
    // Solo rutas internas, incluso si una respuesta inesperada intenta incluir una URL.
    const allowed = ['catalogodemarcas.html', 'carrito.html', 'perfil.html', 'Inicio de sesion.html', 'contacto.html', 'nosotros.html'];
    a.href = pageURL(allowed.includes(path) ? path : 'catalogodemarcas.html');
    return a;
  }
  function productCard(product, index) {
    const card = el('article', 'qp-chat-product');
    card.dataset.chatCode = product.code;
    const title = el('h5', '', `${index + 1}. ${product.name}`);
    const detail = el('p', 'qp-chat-detail', [product.brand, product.model, product.year].filter(Boolean).join(' · '));
    const code = el('p', 'qp-chat-detail', 'Código: ' + product.code);
    const price = el('p', 'qp-chat-price', product.price === null ? 'Precio sin informar' : money(product.price / 100) + ' USD / unidad');
    const stock = el('p', 'qp-chat-stock', product.stock === null ? 'Existencias sin informar' : product.stock === 0 ? 'Agotado' : `Existencias: ${product.stock} unidades`);
    card.append(title, detail, code, price, stock);
    if (product.reference) card.append(el('p', 'qp-chat-reference', 'Referencia de otro modelo del catálogo. Confirma compatibilidad con un asesor.'));
    if (product.quantity > 1 && product.price !== null) card.append(el('p', 'qp-chat-detail', `Subtotal de ${product.quantity}: ${money(product.price * product.quantity / 100)}. Impuesto en el PDF.`));
    const add = el('button', 'qp-chat-add', `Añadir ${product.quantity} a cotización`);
    add.type = 'button';
    add.setAttribute('aria-label', `Añadir ${product.quantity} de ${product.name} a cotización`);
    const available = product.price !== null && product.stock !== null && product.stock >= product.quantity;
    add.disabled = !available;
    if (!available) add.textContent = product.stock === 0 ? 'Sin existencias' : product.stock !== null && product.stock < product.quantity ? `No hay ${product.quantity} unidades` : 'Consulta a un asesor';
    add.addEventListener('click', async () => {
      add.disabled = true;
      add.setAttribute('aria-busy', 'true');
      add.textContent = 'Añadiendo…';
      try {
        const added = await changeQuantity(product.code, product.quantity);
        if (added) {
          const confirmation = bubble(`Añadí ${product.quantity} ${product.quantity === 1 ? 'unidad' : 'unidades'} de ${product.name} a tu cotización.`);
          confirmation.append(link('Ver cotización', 'carrito.html'));
          append(confirmation);
        } else if (session.ready && !session.user) {
          const notice = bubble('Inicia sesión para añadir este repuesto a tu cotización.');
          const signIn = link('Iniciar sesión', 'Inicio de sesion.html');
          const url = new URL(loginURL());
          url.searchParams.set('next', location.pathname + location.search + '#qbot');
          signIn.href = url.href;
          notice.append(signIn);
          append(notice);
        }
      } finally {
        add.disabled = false;
        add.removeAttribute('aria-busy');
        add.textContent = `Añadir ${product.quantity} a cotización`;
      }
    });
    card.append(add);
    return card;
  }
  function render(data) {
    const result = el('div', 'qp-chat-response');
    result.append(bubble(data.answer));
    data.products.forEach((product, index) => result.append(productCard(product, index)));
    if (data.source?.checkedAt) {
      const date = new Date(data.source.checkedAt);
      if (Number.isFinite(date.getTime())) result.append(el('small', 'qp-chat-source', 'Inventario consultado: ' + date.toLocaleString('es-SV') + '. No reserva unidades.'));
    }
    for (const item of data.links || []) result.append(link(item.label, item.path));
    append(result);
    // Mantener visible el inicio de la respuesta; las tarjetas se pueden desplazar.
    messages.scrollTop = Math.max(0, result.offsetTop - messages.offsetTop - 12);
  }
  async function request(text, retry = false) {
    if (pending) return;
    pending = true;
    messages.querySelectorAll('.qp-chat-retry').forEach(button => button.remove());
    if (!retry) append(bubble(text, 'user'));
    const loading = bubble('Consultando el catálogo…');
    loading.classList.add('qp-chat-loading');
    append(loading);
    send.disabled = true;
    input.readOnly = true;
    send.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }), signal: AbortSignal.timeout(27000)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'Q Bot no está disponible en este servidor. Puedes usar el catálogo.');
      if (typeof data?.answer !== 'string' || !Array.isArray(data.products)) throw new Error('No pude leer la respuesta. Inténtalo de nuevo.');
      loading.remove();
      render(data);
      history.push({ role: 'user', text }, { role: 'assistant', text: data.context || data.answer });
      history = history.slice(-4);
    } catch (error) {
      loading.remove();
      const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
      const textError = timeout ? 'La consulta tardó demasiado. Puedes reintentar.' : error instanceof TypeError ? 'No pude conectarme. Revisa tu conexión e inténtalo de nuevo.' : error.message;
      const failure = bubble(textError);
      failure.classList.add('qp-chat-error');
      const retryButton = el('button', 'qp-chat-retry', 'Reintentar consulta');
      retryButton.type = 'button';
      retryButton.addEventListener('click', () => request(text, true));
      failure.append(retryButton, link('Ver catálogo', 'catalogodemarcas.html'));
      append(failure);
    } finally {
      pending = false;
      send.disabled = false;
      input.readOnly = false;
      send.removeAttribute('aria-busy');
      // No robar el foco cuando el visitante haya cerrado el chat o navegado sus tarjetas.
    }
  }
  function submit() {
    const text = input.value.trim();
    if (pending) return;
    if (!text) { input.focus(); return; }
    input.value = '';
    request(text);
  }
  send.addEventListener('click', submit);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); submit(); }
  });
}
