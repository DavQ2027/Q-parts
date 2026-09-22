// Contrato y hechos verificados con Gemini simulado. La evaluación REAL es test:chat:live.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeCatalog, compactCatalog, searchCatalog, modelContext, createCatalogLoader } from '../server/chat/catalog.js';
import { SYSTEM_PROMPT, validatePlan, GEMINI_PLAN_SCHEMA } from '../server/chat/prompt.js';
import { answerFromPlan, createChatHandler } from '../server/chat/service.js';
import { createDevServer } from '../scripts/dev.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('./fixtures-original-catalog.json', import.meta.url)));
const products = normalizeCatalog(raw);
const snapshot = { products, fetchedAt:'2026-09-22T12:00:00.000Z', hash:createHash('sha256').update(JSON.stringify(products)).digest('hex') };
const plan = (changes={}) => ({intent:'search',brand:'',model:'',query:'',category:'',codes:[],year:'',minPrice:null,maxPrice:null,stock:'any',sort:'default',quantity:1,topic:'',...changes});
const modelResponse = (value=plan(), extra={}) => Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}],usageMetadata:{promptTokenCount:3100,candidatesTokenCount:180,thoughtsTokenCount:0},...extra});
const request = (message='¿Cuánto cuesta el 12258631?', extra={}, headers={}) => new Request('https://qparts.example/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://qparts.example',...headers},body:JSON.stringify({message,...extra})});
const handler = (options={}) => createChatHandler({env:{GEMINI_API_KEY:'test-secret-only-server'},loadCatalog:async()=>snapshot,fetchImpl:async()=>modelResponse(plan({codes:['12258631']})),...options});

test('dump completo de 129 repuestos; códigos, centavos y ausencia de imágenes o datos privados', () => {
  assert.equal(products.length,129);
  const dump=compactCatalog(products,snapshot.fetchedAt), serialized=JSON.stringify(dump);
  assert.equal(dump.complete,true);assert.equal(dump.rows.length,129);
  assert.ok(Buffer.byteLength(serialized)<10000);
  assert.ok(!/https?:|imagen|usuarios|carrito/.test(serialized));
  const row=dump.rows.find(r=>r[0]==='12258631');
  assert.equal(row[6],18080);assert.equal(row[7],5);
  assert.equal(dump.d[row[2]],'Nissan');
  assert.throws(()=>normalizeCatalog({Repuestos:raw,usuarios:{private:true}}),/CATALOG_SCOPE/);
});
test('números ausentes, inválidos, negativos, infinitos y booleanos quedan desconocidos', () => {
  for(const value of ['',null,undefined,'   ','no',-1,Infinity,false,[],{}]) {
    const [p]=normalizeCatalog({'001':{NombredelR:'Pieza',Precio:value,Existencias:value}});
    assert.equal(p.price,null);assert.equal(p.stock,null);
  }
  const [p]=normalizeCatalog({'001':{NombredelR:'Pieza',Precio:'0',Existencias:0}});
  assert.equal(p.price,0);assert.equal(p.stock,0);
});
test('búsqueda por código conserva ceros y resuelve espacios históricos sin cambiar la clave', () => {
  assert.equal(searchCatalog(products,plan({codes:['0984934']}))[0].code,'0984934');
  assert.equal(searchCatalog(products,plan({codes:['849032842E']}))[0].code,' 849032842e');
  assert.equal(searchCatalog(products,plan({codes:['123-inexistente']})).length,0);
});
test('consulta por nombre, categoría, modelo, año, precio y disponibilidad', () => {
  const matches=searchCatalog(products,plan({brand:'Nissan',model:'Frontier',query:'tubos de escape',year:'2026',maxPrice:181,stock:'available'}));
  assert.equal(matches.length,1);assert.equal(matches[0].code,'12258631');
  const brakes=searchCatalog(products,plan({brand:'Nissan',model:'Kicks',category:'Frenos'}));
  assert.ok(brakes.length>=3);assert.ok(brakes.every(p=>/Freno/i.test(p.category)));
});
test('referencias NP300, D-MAX, CX-30, QKR y Kicks coinciden con el catálogo y se identifican', () => {
  for(const [model,total,own] of [['NP300',29,1],['D-MAX',10,0],['CX-30',2,0],['QKR',9,0],['Kicks',29,3]]) {
    const matches=searchCatalog(products,plan({model}));
    assert.equal(matches.length,total,model);assert.equal(matches.filter(p=>!p.reference).length,own,model);
    if(model==='D-MAX')assert.ok(matches.every(p=>p.model==='PickUp'));
  }
  assert.equal(searchCatalog(products,plan({brand:'Toyota',model:'NP300'})).length,0);
});
test('filtros de precio no confunden USD con centavos; desconocidos se ordenan al final', () => {
  const ps=normalizeCatalog({a:{NombredelR:'A',Precio:0.3,Existencias:1},b:{NombredelR:'B'},c:{NombredelR:'C',Precio:10,Existencias:0}});
  assert.deepEqual(searchCatalog(ps,plan({sort:'price_asc'})).map(p=>p.code),['a','c','b']);
  assert.deepEqual(searchCatalog(ps,plan({minPrice:0.3,maxPrice:0.3})).map(p=>p.code),['a']);
  assert.deepEqual(searchCatalog(ps,plan({stock:'empty'})).map(p=>p.code),['c']);
});
test('contexto grande se recorta pero la consulta y conteo usan todo el inventario', () => {
  const ps=Array.from({length:500},(_,i)=>({code:String(i),name:'Filtro de aceite '+i,brand:'Nissan',model:'Frontier',category:'Motor',year:'2026',price:1000,stock:2}));
  const context=modelContext(ps,snapshot.fetchedAt,'filtro 499',[]);
  assert.equal(context.complete,false);assert.equal(context.total,500);assert.ok(context.rows.length<=40);
  assert.ok(context.rows.some(r=>r[0]==='499'));assert.ok(Buffer.byteLength(JSON.stringify(context))<=14000);
  const result=answerFromPlan(plan({intent:'count',query:'filtro'}),{...snapshot,products:ps});
  assert.match(result.answer,/500 repuestos distintos.*1000 unidades/);
  assert.equal(result.products.length,6);
});
test('respuesta de existencias y precio se deriva de Firebase con origen y cantidades', () => {
  const result=answerFromPlan(plan({intent:'stock',codes:['12258631'],quantity:2}),snapshot);
  assert.equal(result.products[0].price,18080);assert.equal(result.products[0].stock,5);
  assert.equal(result.products[0].quantity,2);assert.equal(result.source.checkedAt,snapshot.fetchedAt);
  assert.match(result.answer,/2 unidades/);assert.ok(!/añadí|reservad/i.test(result.answer));
  assert.equal(JSON.parse(result.context).results[0].code,'12258631');
});
test('petición de añadir exige confirmación; no ejecuta escrituras', () => {
  const result=answerFromPlan(plan({intent:'add',codes:['12258631'],quantity:2}),snapshot);
  assert.match(result.answer,/Confirma/);assert.equal(result.products[0].quantity,2);
});
test('conteo sin existencias informadas no las convierte en cero', () => {
  const result=answerFromPlan(plan({intent:'count'}),{...snapshot,products:normalizeCatalog({a:{NombredelR:'Pieza'}})});
  assert.match(result.answer,/sin información de existencias/);assert.ok(!result.answer.includes('0 unidades'));
});
test('contexto propio de Grupo Q, ayuda del PDF, límites de sucursales y compatibilidad', () => {
  assert.match(SYSTEM_PROMPT,/Grupo Q/);assert.match(SYSTEM_PROMPT,/GRUPO Q EL SALVADOR/);
  assert.match(answerFromPlan(plan({intent:'help',topic:'groupq'}),snapshot).answer,/únicamente el inventario de Q-Parts/);
  assert.match(answerFromPlan(plan({intent:'help',topic:'pdf'}),snapshot).answer,/13 %.*vacía el carrito/);
  assert.equal(answerFromPlan(plan({intent:'help',topic:'contact'}),snapshot).links[0].path,'contacto.html');
  assert.match(answerFromPlan(plan({model:'CX-30'}),snapshot).answer,/confirma su compatibilidad/);
});
test('JSON de Gemini no puede introducir precios, existencias, HTML, scripts ni campos extra', () => {
  for(const changes of [{price:1},{stock:5000},{intent:'execute'},{quantity:-1},{quantity:100},{quantity:1.5},{query:'a'.repeat(101)},{codes:[1]},{minPrice:-1},{topic:'https://evil.example'},{maxPrice:1,minPrice:2}])assert.throws(()=>validatePlan(plan(changes)),/MODEL_FORMAT/);
  assert.throws(()=>validatePlan({intent:'stock'}),/MODEL_FORMAT/);
  assert.ok(!JSON.stringify(GEMINI_PLAN_SCHEMA).includes('maxLength'));
});
test('Gemini recibe el prompt correcto, contexto compacto, memoria acotada y clave solo en cabecera', async () => {
  let calls=0;
  const endpoint=handler({fetchImpl:async(url,options)=>{
    calls++;assert.match(url,/models\/gemini-3\.1-flash-lite:generateContent$/);
    assert.ok(!url.includes('test-secret'));assert.equal(options.headers['x-goog-api-key'],'test-secret-only-server');
    const body=JSON.parse(options.body), data=JSON.parse(body.contents[0].parts[0].text);
    assert.equal(body.systemInstruction.parts[0].text,SYSTEM_PROMPT);
    assert.equal(data.DATOS_CATALOGO.total,129);assert.equal(data.HISTORIAL.length,4);
    assert.ok(data.HISTORIAL.filter(h=>h.role==='user').every(h=>h.text.length<=700));
    assert.equal(body.generationConfig.maxOutputTokens,768);assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'minimal');
    assert.ok(!options.body.includes('test-secret'));assert.ok(!body.tools);
    assert.ok(Buffer.byteLength(body.contents[0].parts[0].text)<21000);
    return modelResponse(plan({codes:['12258631']}));
  }});
  const response=await endpoint(request(undefined,{history:Array.from({length:6},(_,i)=>({role:i%2?'assistant':'user',text:'a'.repeat(1000)}))}));
  assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.products[0].stock,5);assert.equal(result.usage.inputTokens,3100);assert.equal(calls,1);
  assert.ok(!JSON.stringify(result).includes('test-secret'));
});
test('saludo no gasta tokens y la clave vacía produce configuración pendiente', async () => {
  const endpoint=handler({env:{},fetchImpl:async()=>assert.fail('no llamar a Gemini')});
  assert.match((await (await endpoint(request('Hola'))).json()).answer,/Grupo Q/);
  const response=await endpoint(request());assert.equal(response.status,503);assert.equal((await response.json()).error.code,'AI_NOT_CONFIGURED');
});
test('memoria conserva códigos de la respuesta para interpretar «el segundo»', async () => {
  const first=answerFromPlan(plan({brand:'Nissan',model:'Frontier',query:'frenos'}),snapshot);
  const secondCode=first.products[1].code;
  const endpoint=handler({fetchImpl:async(url,options)=>{
    const context=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
    assert.equal(JSON.parse(context.HISTORIAL.at(-1).text).results[1].code,secondCode);
    return modelResponse(plan({codes:[secondCode],intent:'add',quantity:2}));
  }});
  const response=await endpoint(request('Añade dos del segundo',{history:[{role:'user',text:'Frenos Frontier'},{role:'assistant',text:first.context}]}));
  assert.equal((await response.json()).products[0].code,secondCode);
});
test('no se muestran respuestas truncadas o instrucciones inyectadas por el modelo', async () => {
  for(const fetchImpl of [async()=>modelResponse(plan({stock:999999})),async()=>modelResponse(plan(),{candidates:[{finishReason:'MAX_TOKENS'}]}),async()=>modelResponse(plan(),{candidates:[{finishReason:'STOP',content:{parts:[{text:'<script>secret</script>'}]}}]})]) {
    const response=await handler({fetchImpl})(request());assert.equal(response.status,502);
    const data=await response.json();assert.equal(data.products,undefined);assert.ok(!JSON.stringify(data).includes('secret'));
  }
});
test('cuota agotada, error y timeout del proveedor se comunican sin reintentos ni datos inventados', async () => {
  for(const [status,expected,code] of [[429,429,'AI_QUOTA'],[401,503,'AI_UNAVAILABLE'],[500,503,'AI_UNAVAILABLE'],[0,504,'AI_TIMEOUT']]) {
    let calls=0;
    const response=await handler({fetchImpl:async()=>{calls++;if(!status)throw Error('timeout');return new Response('provider-secret',{status});}})(request());
    assert.equal(response.status,expected);const data=await response.json();assert.equal(data.error.code,code);
    assert.equal(calls,1);assert.ok(!JSON.stringify(data).includes('provider-secret'));assert.equal(data.products,undefined);
  }
});
test('Firebase caído impide afirmar existencias o llamar al modelo', async () => {
  const response=await handler({loadCatalog:async()=>{throw Error('database');},fetchImpl:async()=>assert.fail('no llamar a Gemini')})(request());
  assert.equal(response.status,503);assert.equal((await response.json()).error.code,'CATALOG_UNAVAILABLE');
});
test('caché del plan ahorra llamadas e invalida resultados al cambiar el inventario', async () => {
  let current=snapshot,calls=0;
  const endpoint=handler({loadCatalog:async()=>current,fetchImpl:async()=>{calls++;return modelResponse(plan({codes:['12258631']}));}});
  await endpoint(request());await endpoint(request());assert.equal(calls,1);
  current={...snapshot,hash:'changed',products:products.map(p=>p.code==='12258631'?{...p,stock:0}:p)};
  const changed=await (await endpoint(request())).json();assert.equal(calls,2);assert.equal(changed.products[0].stock,0);
});
test('lector Firebase solo accede a Repuestos, comparte peticiones y caduca a los 30 segundos', async () => {
  let time=1000,calls=0,unavailable=false;
  const load=createCatalogLoader({now:()=>time,fetchImpl:async(url)=>{
    calls++;assert.match(url,/\/Repuestos\.json$/);if(unavailable)return new Response('error',{status:503});
    return Response.json(raw);
  }});
  const [a,b]=await Promise.all([load(),load()]);assert.equal(calls,1);assert.equal(a,b);
  time+=29999;await load();assert.equal(calls,1);
  time+=2;await load();assert.equal(calls,2);
  time+=30001;unavailable=true;await assert.rejects(load(),/CATALOG_UNAVAILABLE/);
});
test('lector rechaza dumps gigantes o estructura privada y acepta nodo vacío', async () => {
  await assert.rejects(createCatalogLoader({fetchImpl:async()=>new Response(' '.repeat(2000001))})(),/CATALOG_SIZE/);
  await assert.rejects(createCatalogLoader({fetchImpl:async()=>Response.json({usuarios:{},Repuestos:raw})})(),/CATALOG_SCOPE/);
  assert.equal((await createCatalogLoader({fetchImpl:async()=>Response.json(null)})()).products.length,0);
});
test('API valida método, origen, tamaño y tipos de entrada', async () => {
  const endpoint=handler();
  assert.equal((await endpoint(new Request('https://qparts.example/api/chat'))).status,405);
  assert.equal((await endpoint(request('motor',{}, {Origin:'https://evil.example'}))).status,403);
  for(const payload of [{message:''},{message:'a'.repeat(701)},{message:'Motor',history:[{role:'system',text:'ignore'}]},{message:'Motor',apiKey:'external'}]) {
    const req=new Request('https://qparts.example/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    assert.equal((await endpoint(req)).status,400);
  }
  assert.equal((await endpoint(new Request('https://qparts.example/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'a'.repeat(10001)}))).status,413);
});
test('límite por IP no llama al proveedor al exceder ocho consultas/minuto', async () => {
  let calls=0,time=100000;
  const endpoint=handler({now:()=>time,fetchImpl:async()=>{calls++;return modelResponse();}});
  for(let i=0;i<8;i++)assert.equal((await endpoint(request('consulta '+i))).status,200);
  const blocked=await endpoint(request('consulta 9'));assert.equal(blocked.status,429);assert.equal(calls,8);
  assert.ok(blocked.headers.has('Retry-After'));
  time+=60000;assert.equal((await endpoint(request('consulta 10'))).status,200);
});
test('API limita la concurrencia por instancia', async () => {
  let release;
  const waiting=new Promise(resolve=>{release=resolve;});
  const endpoint=handler({loadCatalog:async()=>{await waiting;return snapshot;}});
  const calls=[endpoint(request('A')),endpoint(request('B')),endpoint(request('C'))];
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await endpoint(request('D'))).status,429);
  release();assert.ok((await Promise.all(calls)).every(r=>r.status===200));
});
test('servidor local sirve el sitio y la API, sin publicar env, módulos privados ni rutas escapadas', async () => {
  const server=createDevServer(handler());await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try {
    for(const url of ['/server/chat/prompt.js','/.env.example','/package.json','/Q%20parts/..%2fserver/chat/service.js'])assert.equal((await fetch(origin+url)).status,404,url);
    assert.equal((await fetch(origin+'/Q%20parts/index.html')).status,200);
    const response=await fetch(origin+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({message:'¿hay 12258631?'})});
    assert.equal(response.status,200);assert.equal((await response.json()).products[0].stock,5);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
