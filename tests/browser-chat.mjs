// Interfaz + API real del proyecto; SOLO Gemini y Firebase son sustituidos localmente.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDevServer } from '../scripts/dev.mjs';
import { createChatHandler } from '../server/chat/service.js';
import { normalizeCatalog } from '../server/chat/catalog.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const {chromium}=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright') : await import('playwright');
const output=path.join(here,'results/chat');fs.mkdirSync(output,{recursive:true});
const raw=JSON.parse(fs.readFileSync(path.join(here,'fixtures-original-catalog.json')));
raw['qa-unknown']={NombredelR:'Pieza sin datos',Auto:'Nissan',Model:'Frontier'};
raw['qa-xss']={NombredelR:'<img src=x onerror="window.qbotXSS=true">',Precio:25,Existencias:2,Auto:'Nissan',Model:'Frontier'};
const fixture=JSON.parse(fs.readFileSync(path.join(here,'fixtures.json')));
fixture.Repuestos=raw;fixture.carrito={'qa-user':{}};
const snapshot={products:normalizeCatalog(raw),fetchedAt:'2026-09-22T12:00:00Z',hash:'browser-snapshot'};
const plan=(changes={})=>({intent:'stock',brand:'',model:'',query:'',category:'',codes:[],year:'',minPrice:null,maxPrice:null,stock:'any',sort:'default',quantity:1,topic:'',...changes});
let calls=[],failQuota=false,handler,context,page;
function resetHandler(env={GEMINI_API_KEY:'browser-test-secret'}) {
  calls=[];failQuota=false;
  handler=createChatHandler({env,loadCatalog:async()=>snapshot,fetchImpl:async(url,options)=>{
    const prompt=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);calls.push(prompt);
    await new Promise(resolve=>setTimeout(resolve,120));
    if(failQuota)return new Response('quota',{status:429});
    let result=plan({codes:['12258631'],quantity:2});
    if(prompt.CONSULTA==='CX-30')result=plan({model:'CX-30'});
    else if(prompt.CONSULTA==='el segundo')result=plan({codes:[JSON.parse(prompt.HISTORIAL.at(-1).text).results[1].code]});
    else if(prompt.CONSULTA==='sin datos')result=plan({codes:['qa-unknown']});
    else if(prompt.CONSULTA==='texto seguro')result=plan({codes:['qa-xss']});
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]});
  }});
}
resetHandler();
const server=createDevServer(request=>handler(request));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,base=origin+'/Q%20parts/';
const browser=await chromium.launch({headless:true,...(process.env.QP_CHROMIUM_PATH?{executablePath:process.env.QP_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-gpu']});
const report={browser:browser.version(),mode:'Gemini y Firebase simulados; API y cliente reales',views:[],flows:[],errors:[]};
const mark=name=>{report.flows.push(name);console.log('OK',name);};
async function fresh(width=1366,guest=false) {
  if(context)await context.close();resetHandler();
  context=await browser.newContext({viewport:{width,height:900}});
  await context.route('**/js/backend.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(here,'mock-backend.js'),'utf8')}));
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await context.addInitScript(({data,guest})=>{window.__qpFixture={data,guest};},{data:fixture,guest});
  page=await context.newPage();page.setDefaultTimeout(8000);
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.qpReady==='true');
  await page.locator('#draggable-chat-btn').click();await page.locator('#chatWindow.is-open').waitFor();
}
async function ask(text) {
  await page.locator('#chatInput').fill(text);
  const response=page.waitForResponse(r=>r.url()===origin+'/api/chat');
  await page.locator('#chatInput').press('Enter');
  const result=await response;await page.waitForFunction(()=>!document.querySelector('#chatSendBtn').disabled);
  return result;
}
const lastResult=()=>page.locator('.qp-chat-response').last();
const quantity=()=>page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('qa-data')||'{}').carrito?.['qa-user']||{}).find(p=>p.codigo==='12258631')?.cantidad||0);
try {
  for(const width of [320,390,768,1440]) {
    await fresh(width);
    assert.equal((await ask('Hay 2 tubos de escape, código 12258631')).status(),200);
    const result=lastResult();
    assert.match(await result.textContent(),/\$180\.80 USD/);assert.match(await result.textContent(),/Existencias: 5 unidades/);assert.match(await result.textContent(),/\$361\.60/);
    assert.equal(await quantity(),0,'La consulta no modifica el carrito');
    const bounds=await page.locator('#chatWindow').evaluate(n=>{
      const r=n.getBoundingClientRect();
      const overflow=[...n.querySelectorAll('button,input,a,article')].filter(c=>{const b=c.getBoundingClientRect();return b.width&&(b.right>r.right+1||b.left<r.left-1);}).map(c=>c.tagName);
      return {left:r.left,right:r.right,top:r.top,width:r.width,overflow};
    });
    assert.deepEqual(bounds.overflow,[]);assert.ok(bounds.left>=0&&bounds.right<=width&&bounds.top>=80);
    if(width<=600)assert.ok(Math.abs(bounds.left-(width-bounds.width)/2)<2);
    await page.screenshot({path:path.join(output,'chat-'+width+'.png'),animations:'disabled'});
    await result.locator('.qp-chat-add').click();await page.waitForFunction(()=>document.querySelector('#qp-cart-count').textContent==='2');
    assert.equal(await quantity(),2);assert.match(await page.locator('.bot-bubble').last().textContent(),/Añadí 2 unidades/);
    // La confirmación consulta Firebase otra vez: simular fallo de lectura y verificar que no vuelve a sumar.
    await page.evaluate(()=>{window.__failGet=true;});await result.locator('.qp-chat-add').click();
    await page.waitForFunction(()=>!document.querySelector('.qp-chat-add').disabled);assert.equal(await quantity(),2);
    await page.evaluate(()=>{window.__failGet=false;});
    await page.locator('#chatInput').focus();await page.keyboard.press('Escape');
    assert.equal(await page.locator('#draggable-chat-btn').getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#chatWindow').isVisible(),false);
    report.views.push({width,...bounds});
  }
  mark('4 anchos: stock/precio/subtotal correctos, añadir 2 solo al confirmar, revalidación y Escape');
  await fresh();
  await page.locator('#chatInput').fill('Consulta 12258631');
  await page.locator('#chatInput').press('Enter');
  await page.waitForSelector('.qp-chat-loading');
  assert.ok(await page.locator('#chatSendBtn').isDisabled());
  await page.locator('#chatInput').press('Enter');
  await page.waitForFunction(()=>!document.querySelector('#chatSendBtn').disabled);assert.equal(calls.length,1);
  mark('Espera visible y protección contra consultas duplicadas');
  await ask('CX-30');assert.equal(await lastResult().locator('.qp-chat-product').count(),2);
  assert.equal(await lastResult().locator('.qp-chat-reference').count(),2);
  const second=await lastResult().locator('.qp-chat-product').nth(1).getAttribute('data-chat-code');
  await ask('el segundo');assert.equal(await lastResult().locator('.qp-chat-product').getAttribute('data-chat-code'),second);
  assert.ok(calls.at(-1).HISTORIAL.length<=4);mark('Referencias de CX-30 y seguimiento de «el segundo»');
  await ask('sin datos');assert.match(await lastResult().textContent(),/Precio sin informar/);assert.ok(await lastResult().locator('.qp-chat-add').isDisabled());
  await ask('texto seguro');assert.match(await lastResult().textContent(),/<img src=x/);assert.equal(await lastResult().locator('img').count(),0);assert.ok(!await page.evaluate(()=>window.qbotXSS));
  mark('Datos ausentes y texto HTML no se convierten en hechos ni elementos ejecutables');
  await fresh(390);failQuota=true;
  assert.equal((await ask('consulta fallida')).status(),429);assert.equal(await page.locator('.qp-chat-product').count(),0);
  assert.match(await page.locator('.qp-chat-error').textContent(),/límite de consultas/);
  failQuota=false;await page.locator('.qp-chat-retry').click();await page.locator('.qp-chat-product').waitFor();
  assert.equal(calls.length,2);assert.equal(await page.locator('.user-bubble').count(),1);
  mark('Cuota agotada y reintento manual sin duplicar mensajes');
  await fresh();resetHandler({});await ask('precio 12258631');
  assert.match(await page.locator('.qp-chat-error').textContent(),/no está configurado/);
  assert.equal(calls.length,0);assert.equal(await page.locator('.qp-chat-product').count(),0);
  mark('Clave pendiente: mensaje útil y enlace al catálogo');
  await fresh(390,true);await ask('2 del 12258631');await lastResult().locator('.qp-chat-add').click();
  await page.locator('.bot-bubble').last().getByRole('link',{name:'Iniciar sesión',exact:true}).click();
  await page.waitForURL('**/Inicio%20de%20sesion.html?*');
  mark('Añadir sin sesión conserva el flujo de acceso existente');
  assert.deepEqual(report.errors,[],'No debe haber errores de JavaScript');
} finally {
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
