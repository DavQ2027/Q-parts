import { getBackend } from './backend.js';
import { el, pageURL } from './utils.js';
import { notify } from './ui.js';
export const session = { user: null, ready: false, failed: false, signingOut: false };
const listeners = new Set();
export function observeSession(callback) {
  listeners.add(callback); if (session.ready) callback(session.user);
  return () => listeners.delete(callback);
}
function publish(user) { session.user = user; session.ready = true; listeners.forEach(callback => callback(user)); }
export async function startSession() {
  let slow;
  try {
    slow = setTimeout(() => notify('La conexión está tardando. Puedes seguir explorando mientras se restablece.', 'info'), 12000);
    const api = await getBackend();
    api.onAuthStateChanged(api.auth, user => { clearTimeout(slow); publish(user); }, () => failed());
  } catch { failed(); }
  function failed() {
    clearTimeout(slow); session.failed = true;
    const banner = el('div', 'qp-connection-error', 'No se pudo conectar con el servicio. ');
    banner.setAttribute('role', 'alert');
    const retry = el('button', 'qp-button qp-secondary', 'Reintentar'); retry.onclick = () => location.reload();
    banner.append(retry); document.querySelector('.qp-header')?.after(banner);
  }
}
export function requireUser() {
  if (session.user) return session.user;
  notify(session.ready ? 'Inicia sesión para guardar productos en tu cotización.' : 'Espera a que se conecte tu cuenta o revisa tu conexión.', 'info');
  return null;
}
export const loginURL = () => {
  const url = new URL(pageURL('Inicio de sesion.html'));
  url.searchParams.set('next', location.pathname + location.search); return url.href;
};
export function nextURL() {
  const next = new URLSearchParams(location.search).get('next');
  if (next) {
    const url = new URL(next, location.origin);
    if (url.origin === location.origin && url.pathname.startsWith(new URL(pageURL('')).pathname) && !/Inicio%20de%20sesion|Registrarse/i.test(url.pathname)) return url.href;
  }
  return pageURL('index.html');
}
