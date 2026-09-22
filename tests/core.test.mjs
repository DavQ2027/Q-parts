import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCart, cartItems, cartTotal, cartKey, updateCart } from '../Q parts/js/cart-model.js';
import { validationMessage, digits } from '../Q parts/js/validation.js';

const product = {NombredelR:'Tubo de escape',Auto:'Nissan',Model:'Frontier',year:2024,Precio:'180.80',Existencias:'5',imagen:'img/tubo.jpg'};
test('consolida registros antiguos sin perder cantidades ni ceros del código',()=>{
  const result=normalizeCart({old1:{codigo:'001',cantidad:1,precio:10},old2:{codigo:'001',cantidad:2,precio:10},other:{codigo:'002',cantidad:1,precio:3}});
  assert.equal(Object.keys(result).length,2);assert.equal(result[cartKey('001')].cantidad,3);assert.equal(cartTotal(cartItems(result)),33);
  assert.deepEqual(normalizeCart(result),result);
});
test('diez clics sucesivos agrupan en una fila y respetan las cinco existencias',()=>{
  let result={};let accepted=0;
  for(let i=0;i<10;i++){const next=updateCart(result,'001',1,product);if(next){accepted++;result=next;}}
  assert.equal(accepted,5);assert.equal(Object.keys(result).length,1);assert.equal(cartItems(result)[0].cantidad,5);
});
test('restar hasta cero y eliminar quita la fila',()=>{
  const initial=updateCart({},'001',1,product);assert.deepEqual(updateCart(initial,'001',-1),{});
  assert.deepEqual(updateCart(initial,'001',0,null,true),{});
});
test('un agotado, un precio inválido y existencias inválidas no se añaden',()=>{
  for(const patch of [{Existencias:0},{Existencias:'no'},{Precio:-1},{Precio:'no'}])assert.equal(updateCart({},'001',1,{...product,...patch}),undefined);
});
test('no recorta cantidades heredadas si el inventario disminuye',()=>{
  const raw={x:{codigo:'001',cantidad:8,precio:1}};
  assert.equal(normalizeCart(raw)[cartKey('001')].cantidad,8);assert.equal(updateCart(raw,'001',1,product),undefined);
  assert.equal(updateCart(raw,'001',-1)[cartKey('001')].cantidad,7);
});
test('no mezcla códigos ni descarta metadatos',()=>{
  const raw={old:{codigo:'001',cantidad:2,nota:'Conservar'},other:{codigo:'002',cantidad:1}};
  const result=updateCart(raw,'001',1,product);assert.equal(result[cartKey('001')].nota,'Conservar');assert.ok(result[cartKey('002')]);
});
test('totales monetarios en centavos',()=>assert.equal(cartTotal([{precio:0.1,cantidad:3},{precio:0.2,cantidad:1}]),0.5));
test('clave estable segura para Firebase incluso con caracteres especiales',()=>{
  assert.equal(cartKey('001'),cartKey('001'));assert.notEqual(cartKey('001'),cartKey('1'));assert.doesNotMatch(cartKey('.#$[]/á'),/[.#$\[\]/]/);
});
const cases=[
 ['name','José María',true],['name','Jo',false],['name','Ana123',false],['name','<script>x</script>',false],
 ['dui','012345678',true],['dui','01234567-8',true],['dui','123',false],['dui','1e2345678',false],
 ['phone','7777-8888',true],['phone','+503 77778888',true],['phone','777',false],['phone','-77778888',false],
 ['email','prueba@example.com',true],['email','   persona@example.com ',true],['email','abc@',false],['email','a b@c.com',false],
 ['address','San Miguel, El Salvador',true],['address','abc',false],['address',' '.repeat(20),false],
 ['fiscal','001234-5',true],['fiscal','1e3',false],['fiscal','123456789012345',false],
 ['business','Estudiante',true],['business',' ',false],['message','Me interesa cotizar una pieza.',true],['message','hola',false],
 ['new-password','prueba123',true],['new-password','1234567',false],['new-password','        ',false],
 ['password','123456',true],['password','',false]
];
for(const [kind,value,valid] of cases)test(`${kind}: ${JSON.stringify(value)} => ${valid}`,()=>assert.equal(!validationMessage(kind,value),valid));
test('confirmación de contraseña',()=>{assert.equal(validationMessage('confirm-password','abc12345','abc12345'),'');assert.ok(validationMessage('confirm-password','abc12345','abc12346'));});
test('normalizar documentos conserva ceros iniciales',()=>assert.equal(digits('01234567-8'),'012345678'));
