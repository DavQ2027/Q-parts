import { icons, pageURL, errorMessage } from './utils.js';
import { startSession, observeSession, session } from './session.js';
import { startCart, observeCart } from './cart-service.js';
import { confirmDialog, notify } from './ui.js';
import { getBackend } from './backend.js';
import { initCatalog } from './catalog.js';
import { initForms } from './forms.js';
import { initCartPage } from './cart-page.js';
import { initHome } from './home.js';

const toggle = document.querySelector('#qp-menu-toggle');
const menu = document.querySelector('#qp-menu');
function closeMenu() { menu.classList.remove('is-open'); toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-label','Abrir menú'); }
toggle.addEventListener('click', () => {
  const open = !menu.classList.contains('is-open'); menu.classList.toggle('is-open',open);
  toggle.setAttribute('aria-expanded',String(open)); toggle.setAttribute('aria-label',open ? 'Cerrar menú' : 'Abrir menú');
});
menu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('pointerdown', event => { if (!event.target.closest('.qp-header')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.classList.contains('is-open')) { closeMenu(); toggle.focus(); } });
const breakpoint = matchMedia('(min-width: 1200px)'); breakpoint.addEventListener('change',closeMenu);
const current = decodeURIComponent(location.pathname);
document.querySelectorAll('.qp-header a').forEach(link => {
  if (decodeURIComponent(new URL(link.href).pathname) === current) link.setAttribute('aria-current','page');
});
observeSession(user => {
  document.querySelectorAll('[data-auth="in"]').forEach(node => node.hidden = !user);
  document.querySelectorAll('[data-auth="out"]').forEach(node => node.hidden = Boolean(user));
});
const logout = document.querySelector('#qp-logout');
logout.addEventListener('click', async () => {
  closeMenu();
  if (!await confirmDialog('Cerrar sesión','¿Deseas cerrar tu sesión en Q-Parts?','Cerrar sesión')) return;
  logout.disabled = true; session.signingOut = true;
  try { const api = await getBackend(); await api.signOut(api.auth); location.assign(pageURL('index.html')); }
  catch (error) { session.signingOut = false; notify(errorMessage(error),'error'); }
  finally { logout.disabled = false; }
});
observeCart(items => { const counter = document.querySelector('#qp-cart-count'); counter.textContent = items.reduce((sum,item)=>sum+item.cantidad,0); counter.setAttribute('aria-label', `${counter.textContent} unidades`); });
// Una sola navegación adaptable, con las mismas rutas en cualquier ancho.
icons(); startCart(); initForms(); initCatalog(); initCartPage(); initHome(); startSession();
document.documentElement.dataset.qpReady = 'true';
if (document.body.dataset.page === 'inventory') import('./inventory.js').then(module => module.initInventory());

// Los iconos decorativos no sustituyen el nombre accesible de los enlaces.
document.querySelectorAll('.redes-sociales a').forEach(link => {
  const host = new URL(link.href).hostname.replace(/^www\./,''); link.setAttribute('aria-label',host.split('.')[0]);
});
