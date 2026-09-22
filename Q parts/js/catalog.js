import { getBackend } from './backend.js';
import { normalize, money, el, button, icons } from './utils.js';
import { catalogReference, matchesVehicle, isReferenceProduct, restoreVehicleView } from './catalog-models.js';
import { productPicture } from './catalog-media.js';
import { changeQuantity, observeCart, quantityFor } from './cart-service.js';
import { showQuickCart } from './quick-cart.js';
import { busy, notify } from './ui.js';

export function initCatalog() {
  const section = document.querySelector('#SeccionCatalogo');
  if (!section) return;
  const grid = document.querySelector('#contenedor, #catalogGrid, #CatalogoTarjetas');
  if (!grid) return;
  const heading = document.querySelector('#Ctitulo');
  const params = new URLSearchParams(location.search);
  const brand = document.body.dataset.brand || params.get('marca') || '';
  const model = document.body.dataset.model || params.get('modelo') || '';
  restoreVehicleView(section, brand, model);
  const tags = [...document.querySelectorAll('.etiqueta, .hotspot-tag')];
  const categoryKey = value => {
    const key = normalize(value).replace(/\s+/g, ' ');
    return ({'faros delanteros led':'faros','motor y parrilla':'motor','sistemas de frenos':'frenos','sistema de frenos':'frenos'})[key] || key;
  };
  let products = [], category = '', loaded = false;
  const title = 'Repuestos de ' + [brand, model].filter(Boolean).join(' ');
  heading.textContent = title; section.style.display = 'block';
  section.classList.add('qp-catalog'); grid.className = 'qp-products';
  const tools = el('div', 'qp-search-tools');
  const label = el('label', '', 'Buscar repuestos'); label.htmlFor = 'qp-product-search';
  const searchbox = el('div', 'qp-search-input');
  const input = el('input'); input.id = 'qp-product-search'; input.type = 'search'; input.maxLength = 100;
  input.placeholder = 'Nombre, código o categoría…'; input.autocomplete = 'off';
  const clear = button('Limpiar búsqueda', 'x', 'qp-icon-button'); clear.onclick = () => { input.value = ''; render(); input.focus(); };
  searchbox.append(input, clear);
  const filters = el('div', 'qp-search-filters');
  const categoryLabel = el('label', '', 'Categoría'); categoryLabel.htmlFor = 'qp-category';
  const select = el('select'); select.id = 'qp-category'; select.append(new Option('Todas las categorías', ''));
  filters.append(categoryLabel, select);
  const count = el('p', 'qp-results-count', 'Cargando repuestos…'); count.setAttribute('role', 'status');
  const referenceNote = el('p', 'qp-catalog-reference'); referenceNote.hidden = true;
  tools.append(label, searchbox, filters); heading.after(referenceNote, tools, count);
  input.addEventListener('input', render);
  select.addEventListener('change', () => setCategory(select.value));
  tags.forEach(tag => {
    tag.setAttribute('role', 'button'); tag.tabIndex = 0; tag.setAttribute('aria-pressed', 'false');
    tag.addEventListener('click', () => setCategory(tag.dataset.title));
    tag.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tag.click(); } });
    tag.addEventListener('mouseenter', () => showInfo(tag));
    tag.addEventListener('focus', () => showInfo(tag));
  });
  function showInfo(tag) {
    const title = document.querySelector('#TittuloInformacion, #infoTitle');
    const desc = document.querySelector('#descripccion, #infoDesc');
    if (title) title.textContent = tag.dataset.title;
    if (desc) desc.textContent = tag.dataset.desc;
  }
  function setCategory(value) {
    category = value;
    const option = [...select.options].find(option => categoryKey(option.value) === categoryKey(value));
    if (!option) select.add(new Option(value, value));
    select.value = option?.value ?? value;
    tags.forEach(tag => { const active = categoryKey(tag.dataset.title) === categoryKey(value); tag.classList.toggle('active', active); tag.setAttribute('aria-pressed', String(active)); if (active) showInfo(tag); });
    heading.textContent = category ? `${title} · ${category}` : title;
    render();
  }
  function render() {
    if (!loaded) return;
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    const matches = products.filter(product => (!category || categoryKey(product.tag) === categoryKey(category)) && terms.every(term => normalize([product.NombredelR, product.codigo, product.ModelEx, product.tag, product.Model, product.Auto].join(' ')).includes(term)));
    grid.replaceChildren(); count.textContent = `${matches.length} ${matches.length === 1 ? 'repuesto encontrado' : 'repuestos encontrados'}`;
    if (!matches.length) {
      const empty = el('div', 'qp-empty'); empty.append(el('h3', '', 'No se encontraron repuestos'), el('p', '', 'Prueba otro nombre o código, o selecciona todas las categorías.'));
      const reset = button('Ver todos los repuestos', 'list-filter'); reset.onclick = () => { input.value = ''; setCategory(''); };
      empty.append(reset); grid.append(empty);
    }
    for (const product of matches) {
      const card = el('article', 'qp-product');
      const picture = productPicture(product);
      const info = el('div', 'qp-product-info');
      info.append(el('h3', '', product.NombredelR || 'Repuesto'), el('p', 'qp-muted', `Código: ${product.codigo}`), el('p', 'qp-muted', [product.Auto, product.Model, product.tag].filter(Boolean).join(' · ')));
      if (isReferenceProduct(product, brand, model)) info.append(el('small', 'qp-reference-label', 'Referencia del catálogo original'));
      const stock = Number(product.Existencias), price = Number(product.Precio);
      const available = Number.isFinite(stock) && stock > 0 && Number.isFinite(price) && price >= 0;
      info.append(el('p', available ? 'qp-stock' : 'qp-muted', available ? `En existencia: ${Math.floor(stock)}` : 'No disponible'));
      const actions = el('div', 'qp-product-actions'); actions.append(el('strong', 'qp-price', money(price)));
      const add = button(available ? 'Añadir' : 'Agotado', 'shopping-cart'); add.disabled = !available; add.dataset.productCode = product.codigo;
      add.setAttribute('aria-label', `Añadir ${product.NombredelR || 'repuesto'} a la cotización`);
      add.onclick = () => busy(add, async () => {
        if (await changeQuantity(product.codigo)) showQuickCart({ codigo: product.codigo, nombre: product.NombredelR }, add);
      });
      actions.append(add); card.append(picture, info, actions); grid.append(card);
    }
    updateCounts(); icons();
  }
  function updateCounts() {
    grid.querySelectorAll('[data-product-code]').forEach(control => {
      if (control.disabled && !control.hasAttribute('aria-busy')) return;
      const quantity = quantityFor(control.dataset.productCode);
      control.querySelector('span').textContent = quantity ? `Añadir · ${quantity} en cotización` : 'Añadir';
    });
  }
  observeCart(updateCounts);
  getBackend().then(api => {
    api.onValue(api.ref(api.db, 'Repuestos'), snapshot => {
      products = Object.entries(snapshot.val() || {}).map(([code, item]) => ({ ...item, codigo: code }))
        .filter(product => matchesVehicle(product, brand, model) || isReferenceProduct(product, brand, model));
      products.sort((a,b) => String(a.NombredelR).localeCompare(String(b.NombredelR), 'es'));
      referenceNote.hidden = !products.some(product => isReferenceProduct(product, brand, model));
      const reference = catalogReference(brand, model);
      if (reference) referenceNote.textContent = `Se conserva el catálogo de referencia ${reference.label} de la versión original, junto con los registros propios de ${model}. Cada repuesto indica su modelo de origen; confirma su compatibilidad antes de cotizar.`;
      const unique = new Map();
      for (const value of [...tags.map(tag => tag.dataset.title), ...products.map(product => product.tag)].filter(Boolean)) {
        if (!unique.has(categoryKey(value))) unique.set(categoryKey(value), String(value).trim());
      }
      const categories = [...unique.values()].sort();
      select.replaceChildren(new Option('Todas las categorías', ''), ...categories.map(value => new Option(value, value)));
      select.value = category; loaded = true; render();
    }, () => { count.textContent = 'No se pudo cargar el catálogo. Revisa la conexión o vuelve a cargar la página.'; });
  }).catch(() => { count.textContent = 'El catálogo no está disponible sin conexión. Puedes reintentar recargando la página.'; });
  icons();
}
