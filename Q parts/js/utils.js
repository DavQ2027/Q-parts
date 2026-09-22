export const baseURL = new URL('../', import.meta.url);
export const pageURL = path => new URL(path, baseURL).href;
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function icon(name) {
  const node = el('i'); node.dataset.lucide = name; node.setAttribute('aria-hidden', 'true'); return node;
}
export function icons() { window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true', 'focusable': 'false' } }); }
export function button(label, name, className = 'qp-button') {
  const node = el('button', className); node.type = 'button';
  if (name) node.append(icon(name)); node.append(el('span', '', label)); return node;
}
export function productImage(value) {
  const raw = String(value || '').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  // Los registros antiguos guardaban rutas relativas al cotizador.
  const clean = raw.replace(/^(\.\.\/|\.\/)+/, '').replace(/^Q parts\//, '');
  if (clean.startsWith('img/') || clean.startsWith('cotizador ASD/img/')) return pageURL(clean);
  return pageURL('img/logoicon.png');
}
export function errorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
    'auth/wrong-password': 'El correo o la contraseña no son correctos.',
    'auth/user-not-found': 'El correo o la contraseña no son correctos.',
    'auth/invalid-email': 'Escribe un correo electrónico válido.',
    'auth/email-already-in-use': 'Este correo ya tiene una cuenta. Inicia sesión.',
    'auth/weak-password': 'La contraseña no cumple los requisitos de la cuenta.',
    'auth/too-many-requests': 'Hay demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
    'auth/network-request-failed': 'No se pudo conectar. Revisa tu conexión e inténtalo otra vez.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google sin iniciar sesión.',
    'auth/popup-blocked': 'Permite ventanas emergentes para iniciar sesión con Google.',
    'auth/unauthorized-domain': 'Este dominio todavía no está autorizado en Firebase Authentication.',
    'auth/operation-not-allowed': 'Este método de acceso todavía no está habilitado en Firebase.',
    'auth/requires-recent-login': 'Vuelve a iniciar sesión antes de cambiar el correo.',
    'PERMISSION_DENIED': 'No tienes permiso para realizar esta operación.',
    'permission_denied': 'No tienes permiso para realizar esta operación.'
  };
  return messages[error?.code] || 'No se pudo completar la operación. Revisa tu conexión e inténtalo otra vez.';
}
