// Exportación real de PDF con cuenta y carrito simulados; no escribe en Firebase.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.dirname(here);
const output=path.join(here,'results/quote');fs.mkdirSync(output,{recursive:true});
const require=createRequire(import.meta.url);
const {chromium}=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright') : await import('playwright');
const fixture=JSON.parse(fs.readFileSync(path.join(here,'fixtures.json')));
delete fixture.carrito['qa-user'].old2;
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try {res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
 catch {res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,base=origin+'/Q%20parts/';
const browser=await chromium.launch({headless:true,...(process.env.QP_CHROMIUM_PATH?{executablePath:process.env.QP_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-gpu']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.route('**/js/backend.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(here,'mock-backend.js'),'utf8')}));
await context.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
await context.addInitScript(data=>{window.__qpFixture={data};},fixture);
const page=await context.newPage();page.setDefaultTimeout(7000);
const report={flows:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
const mark=name=>{report.flows.push(name);console.log('OK',name);};
async function ready(){await page.waitForFunction(()=>document.documentElement.dataset.qpReady==='true');await page.waitForSelector('.qp-cart-item');}
async function reset(data=fixture){await page.evaluate(data=>{localStorage.clear();localStorage.setItem('qa-data',JSON.stringify(data));},data);await page.reload();await ready();}
async function finished(){await page.waitForFunction(()=>!document.querySelector('#generarPDF').hasAttribute('aria-busy'));}
async function holdSave(){await page.evaluate(()=>{
 const Original=window.jspdf.jsPDF;
 window.jspdf.jsPDF=new Proxy(Original,{construct(target,args){
  const doc=new target(...args), save=doc.save.bind(doc);
  doc.save=async(...args)=>{window.__saveStarted=true;await new Promise(resolve=>{window.__continueSave=resolve;});return save(...args);};return doc;
 }});
});}
async function exportPDF(filename,release=false){
 const pending=page.waitForEvent('download');
 if(release)await page.evaluate(()=>window.__continueSave());else await page.locator('#generarPDF').click();
 const download=await pending;await download.saveAs(path.join(output,filename));await finished();
 assert.equal(fs.readFileSync(path.join(output,filename)).subarray(0,4).toString(),'%PDF');
}
try {
 await page.goto(base+'carrito.html');await ready();await holdSave();
 await page.locator('#generarPDF').click();await page.waitForFunction(()=>window.__saveStarted);
 assert.equal(await page.locator('.qp-cart-item').count(),1);
 assert.ok(await page.locator('#generarPDF').isDisabled());assert.ok(await page.locator('#vaciarCarrito').isDisabled());
 assert.ok((await page.locator('.qp-cart-item button').evaluateAll(ns=>ns.every(n=>n.disabled))));
 mark('Mientras el PDF está pendiente, conserva el carrito y bloquea cambios/descargas duplicadas');
 await exportPDF('cotizacion-formato-original.pdf',true);
 assert.equal(await page.locator('.qp-cart-item').count(),0);assert.equal(await page.locator('#qp-cart-count').textContent(),'0');
 assert.ok(await page.locator('#generarPDF').isDisabled());assert.ok(await page.locator('#vaciarCarrito').isDisabled());
 await page.reload();await page.waitForSelector('#listaCarrito .qp-empty');assert.equal(await page.locator('.qp-cart-item').count(),0);
 mark('PDF real generado y carrito vacío persistente, contador y botones actualizados');

 await reset();await page.evaluate(()=>{window.jspdf=null;});await page.locator('#generarPDF').click();await finished();
 assert.equal(await page.locator('.qp-cart-item').count(),1);assert.ok(await page.getByRole('alert').isVisible());
 mark('Sin generador PDF, los productos se conservan');

 await reset();await page.evaluate(()=>{
  const Original=window.jspdf.jsPDF;
  window.jspdf.jsPDF=new Proxy(Original,{construct(target,args){const doc=new target(...args);doc.save=async()=>{throw Error('Fallo de descarga simulado');};return doc;}});
 });
 await page.locator('#generarPDF').click();await finished();
 assert.equal(await page.locator('.qp-cart-item').count(),1);assert.ok(await page.getByRole('alert').isVisible());
 assert.ok(await page.locator('#generarPDF').isEnabled());
 mark('Error al guardar el PDF: no vacía el carrito y permite reintentar');

 const incomplete=structuredClone(fixture);incomplete.usuarios['qa-user'].direccion='';await reset(incomplete);
 await page.locator('#generarPDF').click();await finished();assert.equal(await page.locator('.qp-cart-item').count(),1);
 assert.match(await page.locator('.qp-toast').textContent(),/Completa nombre/);
 mark('Perfil incompleto: conserva los productos');

 await reset();await page.evaluate(()=>{window.__failWrite=true;});await exportPDF('cotizacion-error-vaciado.pdf');
 assert.equal(await page.locator('.qp-cart-item').count(),1);assert.match(await page.getByRole('alert').textContent(),/PDF se generó, pero no se pudo vaciar/);
 mark('Si falla el vaciado, el PDF se descarga y el carrito permanece con aviso');

 await reset();await holdSave();await page.locator('#generarPDF').click();await page.waitForFunction(()=>window.__saveStarted);
 await page.evaluate(async()=>{const {getBackend}=await import('./js/backend.js');const api=await getBackend();await api.runTransaction(api.ref(api.db,'carrito/qa-user'),raw=>{Object.values(raw)[0].cantidad++;return raw;});});
 await exportPDF('cotizacion-cambio-concurrente.pdf',true);
 assert.equal(await page.locator('.qp-quantity').textContent(),'2');assert.match(await page.locator('.qp-toast').textContent(),/carrito cambió/);
 mark('No elimina cambios de otra pestaña que no estaban en el PDF');

 const large=structuredClone(fixture);large.carrito['qa-user']={};
 large.usuarios['qa-user'].nombre='María José Hernández de los Ángeles García López';
 for(let i=1;i<=65;i++)large.carrito['qa-user']['item'+i]={codigo:String(i),nombre:`Repuesto ${String(i).padStart(2,'0')} - sensor de oxígeno y conjunto de repuesto para vehículo de prueba`,cantidad:i%3+1,precio:20.68,auto:i%2?'Nissan':'Mazda',existencias:90,imagen:'img/tubo.jpg'};
 await reset(large);await exportPDF('cotizacion-multipagina.pdf');assert.equal(await page.locator('.qp-cart-item').count(),0);
 mark('Cotización de 65 filas con nombres largos: exportación y vaciado completos');
 assert.deepEqual(report.errors,[]);console.log('PASS',report.flows.length,'flujos de PDF y carrito');
}catch(error){report.failure=error.stack;await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
