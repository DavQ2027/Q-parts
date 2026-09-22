import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { matchesVehicle, isReferenceProduct, modelKey } from '../Q parts/js/catalog-models.js';
import { catalogImage } from '../Q parts/js/catalog-media.js';

// Lectura pública del catálogo original; no contiene cuentas ni escribe en Firebase.
const data = JSON.parse(fs.readFileSync(new URL('./fixtures-original-catalog.json', import.meta.url)));
const products = Object.entries(data).map(([codigo,item]) => ({...item,codigo}));
for (const [brand,model,own,references] of [
  ['Nissan','NP300',1,28], ['Nissan','Kicks',3,26], ['Isuzu','D-MAX',0,10], ['Mazda','CX-30',0,2],
  ['Isuzu','QKR',0,9], ['Mazda','PickUp',4,6]
]) test(`${brand} ${model}: recupera el catálogo original sin perder sus registros propios`, () => {
  assert.equal(products.filter(p => matchesVehicle(p,brand,model)).length,own);
  assert.equal(products.filter(p => isReferenceProduct(p,brand,model)).length,references);
  assert.equal(products.filter(p => matchesVehicle(p,brand,model) && isReferenceProduct(p,brand,model)).length,0);
});
test('Las referencias cruzadas no cambian el catálogo de otros modelos o marcas', () => {
  assert.equal(products.filter(p => isReferenceProduct(p,'Nissan','Frontier')).length,0);
  assert.equal(products.filter(p => isReferenceProduct(p,'Mazda','')).length,0);
  assert.equal(matchesVehicle({Auto:'Mazda',Model:'Kicks'},'Nissan','Kicks'),false);
  assert.equal(matchesVehicle({Auto:'Nissan ',Model:'kicks'},'Nissan','Kicks'),true);
  assert.equal(modelKey('Mazda CX-5'),'cx5');
});
test('Los tres registros de frenos de Kicks usan una imagen ilustrativa de frenos', () => {
  for (const code of ['456879','4757839','12345678']) {
    const picture = catalogImage(data[code]);
    assert.equal(picture.illustrative,true);
    assert.ok(picture.src.endsWith('/img/catalogo/frenos-referencia.jpg'));
  }
});
test('Se respeta una imagen corregida posteriormente en Firebase', () => {
  const item = {...data['456879'],imagen:'https://example.com/frenos-kicks.jpg'};
  assert.deepEqual(catalogImage(item),{src:item.imagen});
});
test('Una página Google imgres se convierte en su imagen directa, sin ejecutar otras URL', () => {
  assert.equal(catalogImage({imagen:'https://www.google.com/imgres?imgurl=https%3A%2F%2Fexample.com%2Ffrenos.jpg'}).src,'https://example.com/frenos.jpg');
  assert.equal(catalogImage({imagen:'https://www.google.com/imgres?imgurl=javascript%3Aalert(1)'}).src,null);
});
test('Las dos imágenes de Mazda están disponibles localmente; el reemplazo se identifica', () => {
  assert.ok(catalogImage(data['9578434']).src.endsWith('/img/catalogo/motor-mazda.webp'));
  assert.ok(catalogImage(data['123345667']).src.endsWith('/img/catalogo/frenos-referencia.jpg'));
  assert.equal(catalogImage(data['123345667']).illustrative,true);
});
test('Un enlace de página o imagen ausente no se sustituye por el logotipo', () => {
  assert.equal(catalogImage({imagen:'https://example.com/producto.html'}).src,null);
  assert.equal(catalogImage({}).src,null);
});
