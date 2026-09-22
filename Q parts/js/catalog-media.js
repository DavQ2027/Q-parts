import { el, normalize, pageURL, productImage } from './utils.js';

export function catalogImage(product) {
  let source = String(product.imagen || '').trim();
  // Google imgres guarda una página: la imagen está en el parámetro imgurl.
  try {
    const url = new URL(source);
    if (/^(www\.)?google\.[a-z.]+$/i.test(url.hostname) && url.pathname === '/imgres') {
      const imageURL = url.searchParams.get('imgurl');
      source = /^https?:\/\//i.test(imageURL || '') ? imageURL : '';
    }
  } catch { /* Las rutas locales se resuelven con productImage. */ }
  // Tres registros de Kicks contienen una página comercial o una foto del auto.
  // Se corrige solo esa asociación; una futura imagen válida de esos registros se respeta.
  const badKicksImage = normalize(product.NombredelR) === 'frenos' &&
    (/nissanelsalvador\.com\/vehiculo\/.*\/atributos\.html/i.test(source) ||
     source === 'https://acroadtrip.blob.core.windows.net/catalogo-imagenes/xl/RT_V_be472b8e5f9b4cd2aaec1a536c8a11fa.jpg');
  if (badKicksImage || source === 'https://dojiw2m9tvv09.cloudfront.net/50293/product/13632645.jpeg') {
    return { src:pageURL('img/catalogo/frenos-referencia.jpg'), illustrative:true };
  }
  // Copia local del archivo que ya usaba el registro de motor Mazda.
  if (source === 'https://tse1.mm.bing.net/th/id/OIP.1cuPL-U9SJGh8vJE_kPwwQHaHg?r=0&rs=1&pid=ImgDetMain&o=7&rm=3') {
    return { src:pageURL('img/catalogo/motor-mazda.webp') };
  }
  if (!source || /\.html?(?:[?#]|$)/i.test(source)) return { src:null };
  const src = productImage(source);
  return { src:src.endsWith('/img/logoicon.png') ? null : src };
}

export function productPicture(product) {
  const media = el('figure', 'qp-product-media');
  const image = el('img', 'qp-product-image');
  const result = catalogImage(product);
  const unavailable = () => {
    media.replaceChildren(el('div', 'qp-image-unavailable', 'Imagen no disponible'));
  };
  if (!result.src) { unavailable(); return media; }
  image.alt = result.illustrative ? 'Imagen ilustrativa del sistema de frenos' : (product.NombredelR || 'Repuesto');
  image.loading = 'lazy'; image.onerror = unavailable; image.src = result.src; media.append(image);
  if (result.illustrative) media.append(el('figcaption', '', 'Imagen ilustrativa'));
  return media;
}
