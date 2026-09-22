import { createHash } from 'node:crypto';
import { firebaseConfig } from '../../Q parts/js/firebase-config.js';
import { modelKey, matchesVehicle, isReferenceProduct } from '../../Q parts/js/catalog-models.js';

export const clean = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const text = (value, max = 100) => typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '';
const numeric = value => ['string','number'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1e9 ? Number(value) : null;
export const categoryKey = value => clean(value).replace(/sistemas?|delanteros?|reforzada|electrico|\by\b|\bde\b/g, '').replace(/[^a-z0-9]/g, '');
const inferredBrands = { frontier:'Nissan', np300:'Nissan', kicks:'Nissan', sedan:'Nissan', sentra:'Nissan', urvan:'Nissan', pathfinder:'Nissan', qkr:'Isuzu', qmr:'Isuzu', dmax:'Isuzu', cx5:'Mazda', cx30:'Mazda' };

// Lista explícita de campos públicos: nunca copiar usuarios, carrito, URLs o metadatos.
export function normalizeCatalog(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('CATALOG_FORMAT');
  if (Object.hasOwn(raw, 'Repuestos') || Object.hasOwn(raw, 'carrito') || Object.hasOwn(raw, 'usuarios')) throw new Error('CATALOG_SCOPE');
  if (Object.keys(raw).length > 5000) throw new Error('CATALOG_SIZE');
  return Object.entries(raw).flatMap(([code, value]) => {
    if (!value || typeof value !== 'object' || !text(value.NombredelR) || code.length > 80) return [];
    const stock = numeric(value.Existencias), price = numeric(value.Precio);
    const model = text(value.Model, 50);
    return [{ code, name: text(value.NombredelR), brand: text(value.Auto, 40) || inferredBrands[modelKey(model)] || '', model,
      category: text(value.tag, 70), year: text(value.year, 20), price: price === null ? null : Math.round(price * 100),
      stock: stock === null ? null : Math.floor(stock) }];
  }).sort((a, b) => a.code.localeCompare(b.code));
}

export function compactCatalog(products, fetchedAt, total = products.length) {
  const dictionary = [], indexes = new Map();
  const index = value => { if (!indexes.has(value)) { indexes.set(value, dictionary.length); dictionary.push(value); } return indexes.get(value); };
  const rows = products.map(p => [p.code, p.name, index(p.brand), index(p.model), index(p.category), p.year, p.price, p.stock]);
  return { v:1, at:fetchedAt, total, complete:products.length === total,
    columns:['code','name','brand@d','model@d','category@d','year','price_cents_USD','stock'], d:dictionary, rows };
}

const stopWords = new Set('hay tiene tienes tienen de del el la los las un una unos unas para por que cual cuales cuanto cuantos precio cuesta vale existencia existencias disponible disponibles repuesto repuestos pieza piezas necesito quiero buscar busca dame me en con al es y o se unidades unidad stock agregar añade anade'.split(' '));
const stems = value => clean(value).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>1&&!stopWords.has(w)).map(w=>w.length>4?w.replace(/(?:es|s)$/,''):w);
export function searchCatalog(products, plan) {
  const terms = stems(plan.query || '');
  const brand = plan.brand || inferredBrands[modelKey(plan.model)] || '';
  const results = products.flatMap(p => {
    if (plan.codes?.length && !plan.codes.some(code => clean(code) === clean(p.code))) return [];
    const original = {Auto:p.brand, Model:p.model};
    const own = matchesVehicle(original, brand, plan.model);
    const reference = !own && Boolean(plan.model) && isReferenceProduct(original, brand, plan.model);
    if (!own && !reference) return [];
    if (plan.year && p.year !== plan.year) return [];
    if (plan.category && !categoryKey(p.category).includes(categoryKey(plan.category))) return [];
    if (plan.minPrice !== null && (p.price === null || p.price < Math.round(plan.minPrice * 100))) return [];
    if (plan.maxPrice !== null && (p.price === null || p.price > Math.round(plan.maxPrice * 100))) return [];
    if (plan.stock === 'available' && !(p.stock > 0)) return [];
    if (plan.stock === 'empty' && p.stock !== 0) return [];
    const haystack = stems([p.name, p.category, p.brand, p.model, p.code].join(' '));
    if (!terms.every(term => haystack.some(word => word.includes(term)))) return [];
    return [{...p, reference}];
  });
  if (plan.sort === 'price_asc') results.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
  else if (plan.sort === 'price_desc') results.sort((a,b)=>(b.price??-1)-(a.price??-1));
  else if (plan.sort === 'stock_desc') results.sort((a,b)=>(b.stock??-1)-(a.stock??-1));
  else results.sort((a,b)=>Number(a.reference)-Number(b.reference));
  return results;
}

export function modelContext(products, fetchedAt, query, history) {
  let compact = compactCatalog(products, fetchedAt);
  if (Buffer.byteLength(JSON.stringify(compact)) <= 14000) return compact;
  // Al crecer el catálogo: selección local para el modelo, consulta final sobre TODOS los registros.
  const terms = stems([query, ...history.map(h=>h.text)].join(' '));
  const ranked = products.map(p=>({p, score:terms.reduce((n,t)=>n+(clean([p.name,p.brand,p.model,p.category,p.code].join(' ')).includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score||a.p.code.localeCompare(b.p.code));
  let selected=ranked.slice(0,40).map(x=>x.p);
  do { compact=compactCatalog(selected,fetchedAt,products.length); if(Buffer.byteLength(JSON.stringify(compact))<=14000)break;selected.pop(); } while(selected.length);
  return compact;
}

export function createCatalogLoader({ fetchImpl = fetch, now = Date.now, ttl = 30000 } = {}) {
  let cached, expires = 0, pending;
  return async () => {
    if (cached && now() < expires) return cached;
    if (pending) return pending;
    pending = (async () => {
      // Solo el nodo público Repuestos, jamás la raíz de Firebase.
      const response = await fetchImpl(firebaseConfig.databaseURL + '/Repuestos.json', { signal:AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('CATALOG_UNAVAILABLE');
      const reader=response.body.getReader();let bytes=0;const chunks=[];
      for (;;) {const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2_000_000){await reader.cancel();throw new Error('CATALOG_SIZE');}chunks.push(Buffer.from(value));}
      const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const products=raw===null?[]:normalizeCatalog(raw);
      cached={ products, fetchedAt:new Date(now()).toISOString(), hash:createHash('sha256').update(JSON.stringify(products)).digest('hex') };
      expires=now()+ttl;return cached;
    })();
    try {return await pending;} finally {pending=null;}
  };
}
