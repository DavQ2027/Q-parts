import { normalize, el, pageURL } from './utils.js';

export const modelKey = value => {
  const key = normalize(value).replace(/[^a-z0-9]/g, '');
  return ({ mazdacx5:'cx5', frontiernp300:'np300', mazdacx30:'cx30', b50:'pickup', b50pickup:'pickup', mazdapickup:'pickup' })[key] || key;
};

// Estas asociaciones reproducen las páginas enlazadas por el proyecto original.
// Son referencias de la demostración, no equivalencias de compatibilidad mecánica.
const references = {
  nissan: { np300: { model:'frontier', label:'Nissan Frontier' }, kicks: { model:'sedan', label:'Nissan Sedan' } },
  isuzu: { dmax: { model:'pickup', label:'PickUp' }, qkr: { model:'qmr', label:'Isuzu QMR' } },
  mazda: { cx30: { model:'cx5', label:'Mazda CX-5' }, pickup: { model:'pickup', label:'PickUp' } }
};
const inferredBrands = { frontier:'nissan', np300:'nissan', kicks:'nissan', sedan:'nissan', sentra:'nissan', urvan:'nissan', pathfinder:'nissan', qkr:'isuzu', qmr:'isuzu', dmax:'isuzu', pickup:'mazda', cx5:'mazda', cx30:'mazda' };

export function catalogReference(brand, model) {
  return references[modelKey(brand)]?.[modelKey(model)];
}

export function matchesVehicle(product, brand, model) {
  const actualModel = modelKey(product.Model);
  const actualBrand = modelKey(product.Auto) || inferredBrands[actualModel];
  return (!model || actualModel === modelKey(model)) && (!brand || actualBrand === modelKey(brand));
}

export function isReferenceProduct(product, brand, model) {
  const reference = catalogReference(brand, model);
  if (!reference || matchesVehicle(product, brand, model)) return false;
  // El cotizador PickUp original no filtraba por marca; conserva ese origen visible.
  return modelKey(product.Model) === reference.model && (reference.model === 'pickup' || matchesVehicle(product, brand, reference.model));
}

const pickupTags = [
  ['Faros Delanteros LED','Faros',89,80], ['Motor y Parrilla','Motor',88,55],
  ['Parabrisas','Parabrisas',73,29], ['Quemacocos Eléctrico','Quemacocos',52,15],
  ['Caja de Carga','Caja / Batea',14,22], ['Rueda y Frenos Delanteros','Frenos',67,92],
  ['Sistema de Escape','Escape',8,87]
];
const views = {
  'nissan/np300': { image:'cotizador ASD/img/frontier.png', reference:'Frontier', tags:pickupTags,
    origins:[[800,300],[870,220],[670,100],[510,30],[230,190],[680,485],[90,390]] },
  'isuzu/dmax': { image:'cotizador ASD/img/Pick up v2.jpg', reference:'PickUp', tags:pickupTags,
    origins:[[745,418],[810,325],[660,255],[600,165],[300,160],[650,505],[100,265]] },
  'mazda/cx30': { image:'cotizador ASD/img/Mazda CX-5 DETAILS.jpg', reference:'CX-5',
    origins:[[790,425],[830,380],[655,290],[300,340],[100,220],[650,510],[220,370]], tags:[
    ['Faros Delanteros LED','Faros',87,79], ['Motor y Parrilla','Motor',89,53],
    ['Parabrisas','Parabrisas',73,29], ['Estructura de Carrocería','Carrocería',51,15],
    ['Caja de Carga','Cajuela',16,24], ['Rueda y Neumáticos','Neumáticos',67,91],
    ['Sistema de Frenos','Frenos',9,85]
  ] }
};

export function restoreVehicleView(section, brand, model) {
  const view = views[modelKey(brand)+'/'+modelKey(model)];
  if (!view || document.querySelector('.vista,.viewer-wrapper')) return;
  const figure = el('figure', 'qp-vehicle-view');
  const stage = el('div', 'qp-vehicle-stage');
  const image = el('img', 'qp-vehicle-image');
  image.src = pageURL(view.image); image.alt = `Ilustración de referencia ${view.reference} del proyecto original`;
  stage.append(image);
  // Escala de los otros cotizadores, con puntos ajustados a cada ilustración.
  const svgNode = (name, attrs) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const lines = svgNode('svg', { class:'qp-vehicle-lines', viewBox:'0 0 1000 600', preserveAspectRatio:'none', 'aria-hidden':'true', focusable:'false' });
  stage.append(lines);
  for (const [index, [category, label, x, y]] of view.tags.entries()) {
    const [originX, originY] = view.origins[index];
    const targetX = x * 10, targetY = y * 6;
    const bendX = targetX - Math.sign(targetX - originX) * 30;
    lines.append(
      svgNode('circle', { class:'qp-vehicle-point', cx:originX, cy:originY, r:4 }),
      svgNode('path', { class:'qp-vehicle-line', d:`M ${originX} ${originY} L ${bendX} ${targetY} L ${targetX} ${targetY}` })
    );
    const tag = el('button', 'etiqueta qp-vehicle-tag', label); tag.type = 'button';
    tag.dataset.title = category; tag.dataset.desc = `Consulta los repuestos de ${label.toLowerCase()} en el catálogo.`;
    tag.style.setProperty('--x', x+'%'); tag.style.setProperty('--y', y+'%'); stage.append(tag);
  }
  const caption = el('figcaption', '', `Vista ilustrativa del catálogo original (${view.reference}). Selecciona una zona para consultar sus repuestos.`);
  const info = el('div', 'qp-vehicle-info');
  const title = el('strong', '', 'Selecciona una parte'); title.id = 'infoTitle';
  const description = el('p', '', 'Los botones filtran el catálogo por categoría.'); description.id = 'infoDesc';
  info.append(title, description); figure.append(stage, caption, info); section.before(figure);
}
