import { getBackend } from './backend.js';
import { requireUser, observeSession, session } from './session.js';
import { normalizeCart, updateCart, cartItems } from './cart-model.js';
import { notify } from './ui.js';
import { errorMessage } from './utils.js';
let items = [], stop, api, watchVersion = 0;
const listeners = new Set();
export function observeCart(callback) { listeners.add(callback); callback(items); return () => listeners.delete(callback); }
function publish(value) { items = cartItems(value); listeners.forEach(callback => callback(items)); }
export function quantityFor(code) { return items.find(item => item.codigo === String(code))?.cantidad || 0; }
export function startCart() {
  observeSession(async user => {
    const version = ++watchVersion; stop?.(); publish(null);
    if (!user) return;
    try {
      api = await getBackend(); if (version !== watchVersion) return;
      const reference = api.ref(api.db, `carrito/${user.uid}`);
      stop = api.onValue(reference, snapshot => publish(snapshot.val()), error => notify(errorMessage(error), 'error'));
      // Consolida registros de versiones anteriores de forma atómica.
      const snapshot = await api.get(reference);
      if (version !== watchVersion) return;
      if (snapshot.exists() && JSON.stringify(snapshot.val()) !== JSON.stringify(normalizeCart(snapshot.val()))) {
        await api.runTransaction(reference, raw => raw ? normalizeCart(raw) : raw, { applyLocally: false });
      }
    } catch (error) { notify(errorMessage(error), 'error'); }
  });
}
export async function changeQuantity(code, delta = 1, remove = false) {
  const user = requireUser(); if (!user) return false;
  try {
    const api = await getBackend();
    let product;
    if (delta > 0 && !remove) {
      const snapshot = await api.get(api.ref(api.db, `Repuestos/${code}`));
      if (!snapshot.exists()) { notify('Este repuesto ya no está disponible.', 'error'); return false; }
      product = snapshot.val();
    }
    if (session.user?.uid !== user.uid) return false;
    const result = await api.runTransaction(api.ref(api.db, `carrito/${user.uid}`), raw => updateCart(raw, code, delta, product, remove), { applyLocally: false });
    if (!result.committed) { notify('No se puede añadir: revisa las existencias disponibles.', 'error'); return false; }
    publish(result.snapshot.val()); return true;
  } catch (error) { notify(errorMessage(error), 'error'); return false; }
}
export async function clearCart(quotedItems = null, ownerId = session.user?.uid) {
  const user = requireUser(); if (!user || user.uid !== ownerId) return false;
  const api = await getBackend();
  if (session.user?.uid !== ownerId) return false;
  // No borra productos añadidos o cambiados en otra pestaña durante la exportación.
  const signature = value => JSON.stringify(value.map(item => [String(item.codigo), item.cantidad, Number(item.precio)]).sort((a, b) => a[0].localeCompare(b[0])));
  const expected = quotedItems && signature(quotedItems);
  const result = await api.runTransaction(api.ref(api.db, `carrito/${user.uid}`), raw => {
    if (expected && signature(cartItems(raw)) !== expected) return undefined;
    return null;
  }, { applyLocally: false });
  if (result.committed && session.user?.uid === ownerId) publish(result.snapshot.val());
  return result.committed;
}
