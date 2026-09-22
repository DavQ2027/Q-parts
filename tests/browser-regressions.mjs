// Casos de las capturas: usa los 129 registros originales y servicios de cuenta simulados.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.dirname(here);
const output=path.join(here,'results/regressions');fs.mkdirSync(output,{recursive:true});
const require=createRequire(import.meta.url);
const {chromium}=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright') : await import('playwright');
const fixture=JSON.parse(fs.readFileSync(path.join(here,'fixtures.json')));
fixture.Repuestos=JSON.parse(fs.readFileSync(path.join(here,'fixtures-original-catalog.json')));
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)){res.statusCode=403;res.end();return;}
 try {const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg'};res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
 catch {res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,base=origin+'/Q%20parts/';
const browser=await chromium.launch({headless:true,...(process.env.QP_CHROMIUM_PATH?{executablePath:process.env.QP_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-gpu']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.route('**/js/backend.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(here,'mock-backend.js'),'utf8')}));
await context.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>{
 // Comprueba el CSS externo de Bootstrap cargado, a diferencia de la suite aislada.
 if(r.request().url().includes('/bootstrap@5.3.3/'))return r.fulfill({contentType:'text/css',body:fs.readFileSync(path.join(here,'bootstrap-5.3.3.test.css'))});
 return r.abort();
});
await context.addInitScript(data=>{window.__qpFixture={data};},fixture);
const page=await context.newPage();page.setDefaultTimeout(7000);
const report={views:[],flows:[],errors:[],localFailures:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)report.localFailures.push(r.url());});
const mark=name=>{report.flows.push(name);console.log('OK',name);};
async function go(file){await page.goto(base+file,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.qpReady==='true');await page.evaluate(()=>document.fonts.ready);}
async function shot(name){await page.screenshot({path:path.join(output,name+'.png'),fullPage:false});}
const models=[
 ['repuestos.html?marca=Nissan&modelo=NP300',29,7],['cotizador%20ASD/cotizadorkicks.html',29,4],
 ['repuestos.html?marca=Isuzu&modelo=D-MAX',10,7],['repuestos.html?marca=Mazda&modelo=CX-30',2,7],
 ['cotizador%20ASD/cotizadorMazdacx-5.html',2,7],['cotizador%20ASD/cotizadorQKR.html',9,7],
 ['cotizador%20ASD/cotizadorpickup.html',10,7]
];
try{
 for(const width of [320,390,768,1024,1243,1440,1920]){
  await page.setViewportSize({width,height:1000});
  for(const file of ['ModelosNissan.html','ModelosIsuzu.html','ModelosMazda.html','perfil.html','contacto.html',...models.map(x=>x[0])]){
   await go(file);
   const model=models.find(x=>x[0]===file);
   if(model){
    await page.waitForSelector('.qp-product');
    assert.equal(await page.locator('.qp-product').count(),model[1],file+' conserva todos los registros');
    assert.equal(await page.locator('.etiqueta,.hotspot-tag').count(),model[2]);
    const image=page.locator('.qp-vehicle-image,.imagenVehiculo,.vehicle-img').first();
    await image.evaluate(i=>i.decode());assert.ok(await image.isVisible());
   }
   const state=await page.evaluate(()=>{
    const all=[...document.querySelectorAll('.grid-cards>.card,.qp-product,.tarjeta1,form,button,a,input,textarea,select,[role="button"]')];
    const overflow=all.filter(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&!n.classList.contains('qp-skip')&&(r.left< -1||r.right>innerWidth+1);}).map(n=>({id:n.id,class:n.className,text:n.textContent.slice(0,40)}));
    const profile=document.querySelector('.tarjeta1');
    const catalog=document.querySelector('#SeccionCatalogo'),outer=catalog?.parentElement;
    return {overflow,scroll:document.documentElement.scrollWidth,profileWidth:profile?.getBoundingClientRect().width,bodyFont:getComputedStyle(document.body).fontFamily,headerFont:getComputedStyle(document.querySelector('.qp-nav')).fontFamily,formFont:document.querySelector('form')&&getComputedStyle(document.querySelector('form')).fontFamily,catalogWidth:catalog?.getBoundingClientRect().width,outerWidth:outer?.getBoundingClientRect().width};
   });
   assert.deepEqual(state.overflow,[],file+' a '+width+'px');
   assert.ok(state.scroll<=width+1,file+' sin desbordamiento horizontal');
   if(file==='perfil.html'){assert.ok(state.profileWidth<=520);assert.match(state.formFont,/QParts Jakarta/);}
   if(file==='contacto.html'){assert.match(state.bodyFont,/QParts Jakarta/);assert.match(state.headerFont,/QParts Jakarta/);assert.match(state.formFont,/QParts Jakarta/);}
   if(file.includes('Mazdacx'))assert.equal(await page.locator('.info-card #SeccionCatalogo').count(),0);
   report.views.push({file,width,...state});
  }
  console.log('Viewport',width,'12 páginas con catálogo original');
 }
 mark('84 vistas: imágenes, tarjetas, fuentes locales y ausencia de desbordamientos');
 await page.setViewportSize({width:1440,height:1000});
 for(const [file] of models){
  await go(file);
  const allCodes=await page.locator('[data-product-code]').evaluateAll(ns=>ns.map(n=>n.dataset.productCode));
  for(const tag of await page.locator('.etiqueta,.hotspot-tag').all()){
   await tag.click();assert.equal(await tag.getAttribute('aria-pressed'),'true');
   assert.ok((await page.locator('[data-product-code]').evaluateAll(ns=>ns.map(n=>n.dataset.productCode))).every(code=>allCodes.includes(code)));
  }
  await page.locator('#qp-category').selectOption('');
  await page.locator('#qp-product-search').fill('sin-coincidencia');assert.ok(await page.locator('.qp-empty').isVisible());
  await page.getByRole('button',{name:'Limpiar búsqueda',exact:true}).click();
  assert.equal(await page.locator('.qp-product').count(),allCodes.length);
 }
 mark('46 marcadores de los vehículos y búsquedas conservan su catálogo');
 await go('cotizador%20ASD/cotizadorkicks.html');
 for(const code of ['456879','4757839','12345678']){
  const card=page.locator('.qp-product').filter({has:page.locator(`[data-product-code="${code}"]`)});
  const image=card.locator('img');await image.evaluate(i=>i.decode());
  assert.ok((await image.getAttribute('src')).endsWith('/img/catalogo/frenos-referencia.jpg'));
  assert.equal(await card.locator('figcaption').textContent(),'Imagen ilustrativa');
 }
 await page.locator('#qp-product-search').fill('456879');await page.locator('#SeccionCatalogo').scrollIntoViewIfNeeded();await shot('kicks-imagenes');
 mark('Las tres imágenes erradas de Kicks muestran una ilustración local de frenos');
 await go('cotizador%20ASD/cotizadorMazdacx-5.html');
 for(const image of await page.locator('.qp-product img').all())await image.evaluate(i=>i.decode());
 assert.equal(await page.locator('.qp-product img').count(),2);
 await page.locator('#SeccionCatalogo').scrollIntoViewIfNeeded();await shot('cx5-grid');
 mark('Las imágenes de los dos repuestos Mazda cargan desde archivos locales');
 await go('repuestos.html?marca=Nissan&modelo=NP300');await shot('np300-vista');
 await go('repuestos.html?marca=Isuzu&modelo=D-MAX');await shot('dmax-vista');
 await go('repuestos.html?marca=Mazda&modelo=CX-30');await shot('cx30-vista');
 await go('ModelosNissan.html');await shot('nissan-grid');
 await go('perfil.html');await shot('perfil-desktop');
 await go('contacto.html');await shot('contacto-desktop');
 await page.setViewportSize({width:390,height:844});await go('perfil.html');await shot('perfil-mobile');
 await go('repuestos.html?marca=Nissan&modelo=NP300');await shot('np300-mobile');
 // Autenticación local simulada. No se crea ninguna cuenta real.
 await page.evaluate(()=>localStorage.setItem('qa-logged-out','true'));
 await page.setViewportSize({width:1366,height:900});await go('Inicio%20de%20sesion.html?next=/Q%20parts/perfil.html');
 await page.locator('#email').fill('prueba@example.com');await page.locator('[id="Contraseña"]').fill('incorrecta');await page.locator('#botoniniciarsesion').click();
 await page.waitForSelector('.qp-error');assert.equal(await page.locator('.qp-auth-success').count(),0);
 await page.locator('[id="Contraseña"]').fill('123456');await page.locator('[id="Contraseña"]').press('Enter');
 await page.waitForSelector('.qp-auth-success');
 assert.ok(page.url().includes('Inicio'));assert.ok(await page.locator('#botoniniciarsesion').isDisabled());
 assert.equal(await page.locator('.qp-success-mark path').evaluate(n=>getComputedStyle(n).animationName),'qp-check');
 await page.locator('.qp-auth-success').evaluate(d=>Promise.all(d.getAnimations({subtree:true}).map(a=>a.finished)));
 await shot('bienvenida');await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.waitForURL('**/perfil.html');
 mark('Bienvenida animada: solo tras éxito, Continuar y retorno al perfil');
 await page.evaluate(()=>localStorage.setItem('qa-logged-out','true'));
 await page.emulateMedia({reducedMotion:'reduce'});await go('Inicio%20de%20sesion.html');await page.locator('#Googleboton').click();
 await page.waitForSelector('.qp-auth-success');assert.equal(await page.locator('.qp-success-mark path').evaluate(n=>getComputedStyle(n).animationName),'none');
 await page.keyboard.press('Escape');await page.waitForURL('**/index.html');
 mark('Google, teclado y preferencia de movimiento reducido');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.localFailures,[]);
 console.log('PASS',report.views.length,'vistas;',report.flows.length,'flujos de regresión.');
}catch(error){report.failure=error.stack;await shot('failure').catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
