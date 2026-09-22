// Funciones puras, compartidas por catálogo, carrito y pruebas.
export const cartKey = code => 'p_' + Array.from(new TextEncoder().encode(String(code)), n => n.toString(16).padStart(2, '0')).join('');
export function normalizeCart(raw) {
  const result = {};
  for (const [oldKey, value] of Object.entries(raw || {})) {
    if (!value || typeof value !== 'object') { result[oldKey] = value; continue; }
    const code = String(value.codigo ?? oldKey);
    const key = cartKey(code);
    const count = Number(value.cantidad ?? 1);
    const quantity = Number.isSafeInteger(count) && count > 0 ? count : 1;
    if (result[key]) result[key].cantidad += quantity;
    else result[key] = { ...value, codigo: code, cantidad: quantity };
  }
  return result;
}
export function cartItems(raw) { return Object.values(normalizeCart(raw)).filter(item => item && typeof item === 'object'); }
export function cartTotal(items) { return items.reduce((sum, item) => sum + Math.round((Number(item.precio) || 0) * 100) * item.cantidad, 0) / 100; }
export function updateCart(raw, code, delta, product, remove = false) {
  const cart = normalizeCart(raw), key = cartKey(code);
  if (remove) { delete cart[key]; return cart; }
  const previous = cart[key]?.cantidad || 0;
  const quantity = previous + delta;
  if (quantity <= 0) { delete cart[key]; return cart; }
  if (delta > 0 && (!product || !Number.isFinite(Number(product.Existencias)) || quantity > Math.floor(Number(product.Existencias)))) return undefined;
  if (delta > 0 && (!Number.isFinite(Number(product.Precio)) || Number(product.Precio) < 0)) return undefined;
  const source = product ? {
    nombre: String(product.NombredelR || 'Repuesto'), codigo: String(code), auto: String(product.Auto || ''),
    modelo: String(product.Model || ''), year: String(product.year || ''), precio: Number(product.Precio),
    imagen: String(product.imagen || ''), existencias: Number(product.Existencias)
  } : cart[key];
  if (!source) return cart;
  cart[key] = { ...cart[key], ...source, cantidad: quantity };
  return cart;
}
