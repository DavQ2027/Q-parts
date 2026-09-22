// Pruebas de interfaz aisladas. Nunca se conectan a las cuentas o datos reales.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(here), output=path.join(here,'results');fs.mkdirSync(output,{recursive:true});
const require=createRequire(import.meta.url);
const {chromium}=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright') : await import('playwright');
const fixture=JSON.parse(fs.readFileSync(path.join(here,'fixtures.json')));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(req.url.split('?')[0]);let name=path.resolve(root,'.'+relative);
  if(!name.startsWith(root+path.sep)&&name!==root){res.statusCode=403;res.end();return;}
  try{if(fs.statSync(name).isDirectory())name=path.join(name,'index.html');res.setHeader('Content-Type',mime[path.extname(name)]||'application/octet-stream');res.end(fs.readFileSync(name));}catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port, base=origin+'/Q%20parts/';
const browser=await chromium.launch({headless:true,...(process.env.QP_CHROMIUM_PATH ? {executablePath:process.env.QP_CHROMIUM_PATH} : {}),args:['--no-sandbox','--disable-gpu']});
const report={browser:browser.version(),pages:[],flows:[],errors:[],localFailures:[]};
let context,page;
async function fresh(guest=false){
  if(context)await context.close();
  context=await browser.newContext({viewport:{width:1366,height:900}});
  await context.route('**/js/backend.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(here,'mock-backend.js'),'utf8')}));
  // El contrato completo del chat se comprueba en browser-chat.mjs; aquí solo su posición y navegación.
  await context.route('**/api/chat',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({answer:'Consulta de motor recibida.',products:[],links:[],context:'Ayuda: catalog'})}));
  // Ni Firebase, ni Formspree, ni Google reciben solicitudes en esta prueba.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await context.addInitScript(({data,guest})=>{window.__qpFixture={data,guest};},{data:fixture,guest});
  page=await context.newPage();page.setDefaultTimeout(7000);
  page.on('pageerror',error=>report.errors.push({url:page.url(),message:error.message}));
  page.on('response',response=>{if(response.url().startsWith(origin)&&response.status()>=400)report.localFailures.push(response.url());});
}
async function go(file){await page.goto(base+file,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.qpReady==='true');await page.waitForTimeout(80);}
async function capture(name){await page.screenshot({path:path.join(output,name+'.png'),fullPage:false});}
const mark=name=>{report.flows.push(name);console.log('OK',name);};
try{
  await fresh();
  const pages=fs.readdirSync(path.join(root,'Q parts')).filter(x=>x.endsWith('.html')).map(encodeURIComponent).concat(fs.readdirSync(path.join(root,'Q parts/cotizador ASD')).filter(x=>x.endsWith('.html')).map(x=>'cotizador%20ASD/'+encodeURIComponent(x)));
  for(const width of [360,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    for(const file of pages){
      await go(file);
      const metrics=await page.evaluate(()=>{
        const header=document.querySelector('.qp-header').getBoundingClientRect();
        const toggle=document.querySelector('#qp-menu-toggle').getBoundingClientRect();
        const overflow=[...document.querySelectorAll('button,a,input,select,textarea,[role="button"]')].filter(n=>{
          const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width&&r.height&&s.visibility!=='hidden'&&!n.closest('.qp-skip')&&(r.right>innerWidth+1||r.left < -1);
        }).map(n=>({tag:n.tagName,id:n.id,text:n.textContent.trim().slice(0,30)}));
        return {headerTop:header.top,headerHeight:header.height,toggleRight:toggle.right,overflow};
      });
      assert.equal(metrics.headerTop,0,`${file} navbar fija`);assert.equal(Math.round(metrics.headerHeight),80,`${file} altura navbar`);
      if(width<1200){assert.ok(metrics.toggleRight<=width,`${file} hamburger clipped`);await page.locator('#qp-menu-toggle').click();assert.equal(await page.locator('#qp-menu-toggle').getAttribute('aria-expanded'),'true');assert.ok(await page.locator('#qp-menu a[href$="perfil.html"]').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('#qp-menu-toggle').getAttribute('aria-expanded'),'false');}
      else assert.ok(await page.locator('#qp-menu a[href$="perfil.html"]').isVisible());
      report.pages.push({file,width,...metrics});
    }
    console.log('Viewport audit',width,pages.length,'pages');
  }
  assert.deepEqual(report.pages.filter(item=>item.overflow.length),[], 'Controles fuera de la pantalla');
  mark('23 páginas: navegación, perfil y breakpoints 360/768/1024/1440');
  await page.goto(origin+'/');await page.waitForURL('**/Q%20parts/index.html');mark('Entrada raíz redirige a la página válida');
  await go('cotizador%20ASD/CotizadorFrontier.html');
  await page.locator('#qp-product-search').fill('OXIGENO');assert.equal(await page.locator('.qp-product').count(),1);
  await page.locator('#qp-product-search').fill('001001');assert.equal(await page.locator('.qp-product').count(),1);
  await page.locator('#qp-product-search').fill('sin-coincidencia');assert.equal(await page.locator('.qp-product').count(),0);assert.ok(await page.locator('.qp-empty').isVisible());
  await page.locator('.qp-empty button').click();assert.equal(await page.locator('.qp-product').count(),4);mark('Búsqueda inmediata por nombre sin acentos, código y estado vacío');
  for(const tag of await page.locator('.etiqueta').all()){await tag.click();assert.equal(await tag.getAttribute('aria-pressed'),'true');}
  await page.locator('#qp-category').selectOption('Sistema de Escape');assert.equal(await page.locator('.qp-product').count(),3);mark('Zonas interactivas y filtro por categoría');
  await page.setViewportSize({width:1150,height:900});await page.locator('#SeccionCatalogo').scrollIntoViewIfNeeded();await capture('catalogo-desktop');
  const add=page.locator('[data-product-code="001001"]');await add.click();
  await page.locator('.qp-quick-cart').waitFor();assert.equal(await page.locator('.qp-quantity').textContent(),'4');
  const quickTop=await page.locator('.qp-quick-cart').evaluate(n=>n.getBoundingClientRect().top);assert.ok(quickTop>=80);
  await page.getByRole('button',{name:'Sumar una unidad',exact:true}).click();assert.equal(await page.locator('.qp-quantity').textContent(),'5');
  await page.getByRole('button',{name:'Sumar una unidad',exact:true}).click();assert.equal(await page.locator('.qp-quantity').textContent(),'5');
  await page.getByRole('button',{name:'Restar una unidad',exact:true}).click();assert.equal(await page.locator('.qp-quantity').textContent(),'4');
  await capture('cantidad-rapida');
  await page.mouse.move(2,85);await page.waitForTimeout(2300);assert.equal(await page.locator('.qp-quick-cart').count(),0);mark('Panel rápido: suma/resta, tope de stock y cierre a los 2 segundos');
  await add.click();await page.getByRole('button',{name:'Eliminar',exact:true}).click();assert.equal(await page.locator('.qp-quick-cart').count(),0);await add.click();
  await go('carrito.html');assert.equal(await page.locator('.qp-cart-item').count(),1);assert.equal(await page.locator('.qp-quantity').textContent(),'1');
  await page.getByRole('button',{name:'Sumar una unidad de Tubo de escape',exact:true}).click();assert.equal(await page.locator('.qp-quantity').textContent(),'2');assert.equal(await page.locator('#total').textContent(),'$361.60');
  await page.reload();await page.waitForSelector('.qp-cart-item');assert.equal(await page.locator('.qp-quantity').textContent(),'2');mark('Carrito consolidado: controles, total y persistencia al recargar');
  await capture('carrito-desktop');
  const download=page.waitForEvent('download');await page.locator('#generarPDF').click();const pdf=await download;await pdf.saveAs(path.join(output,'cotizacion-prueba.pdf'));await page.waitForSelector('.qp-empty');assert.equal(await page.locator('.qp-cart-item').count(),0);assert.ok(await page.locator('#generarPDF').isDisabled());mark('Descarga de PDF vacía el carrito después de generarlo');
  await page.evaluate(async()=>{const {changeQuantity}=await import('./js/cart-service.js');await changeQuantity('001001',1);});await page.waitForSelector('.qp-cart-item');
  await page.locator('#vaciarCarrito').click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await page.locator('.qp-cart-item').count(),1);
  await page.locator('#vaciarCarrito').click();await page.getByRole('button',{name:'Vaciar',exact:true}).click();await page.waitForSelector('.qp-empty');assert.equal(await page.locator('.qp-cart-item').count(),0);assert.ok(await page.locator('#generarPDF').isDisabled());mark('Vaciar requiere confirmación y deshabilita PDF cuando no hay productos');
  for(const [file,code] of [['cotizador%20ASD/cotizadorkicks.html','002'],['cotizador%20ASD/cotizadorQKR.html','011'],['cotizador%20ASD/cotizadorQMR.html','010'],['cotizador%20ASD/cotizadorMazdacx-5.html','008'],['repuestos.html?marca=Nissan&modelo=NP300','006'],['repuestos.html?marca=Isuzu&modelo=D-MAX','012']]){
    await go(file);assert.equal(await page.locator('.qp-product:not(:has(.qp-reference-label))').count(),4);const codes=await page.locator('.qp-product:not(:has(.qp-reference-label)) [data-product-code]').evaluateAll(nodes=>nodes.map(n=>n.dataset.productCode));assert.ok(codes.every(value=>value.startsWith(code)));
  }mark('Los registros propios de cada modelo se conservan y las referencias originales se identifican');
  await go('ModelosMazda.html');await page.locator('#qp-product-search').fill('cx-30');assert.equal(await page.locator('.qp-product').count(),4);mark('Búsqueda por marca incluye sus modelos');
  await go('perfil.html');await page.locator('#nombre').fill('1');await page.locator('#btnguardar').click();assert.equal(await page.locator('#nombre').getAttribute('aria-invalid'),'true');
  await page.locator('#nombre').fill('Nuevo Nombre');await page.locator('#numero').fill('123');await page.locator('#btnguardar').click();assert.equal(await page.locator('#numero').getAttribute('aria-invalid'),'true');
  await page.locator('#numero').fill('+503 77778888');await page.locator('#btnguardar').click();await page.waitForSelector('.qp-success');
  await page.locator('#email').fill('nuevo@example.com');await page.locator('#btnguardar').click();assert.equal(await page.evaluate(()=>window.__verificationEmail),'nuevo@example.com');mark('Perfil: validaciones, guardado y solicitud de verificación de correo');
  await page.setViewportSize({width:390,height:844});await go('perfil.html');await page.locator('#qp-menu-toggle').click();await capture('menu-mobile');await page.locator('#qp-logout').click();
  await page.waitForSelector('dialog[open]');const hit=await page.locator('dialog').evaluate(d=>{const r=d.getBoundingClientRect();return d.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});assert.ok(hit);await capture('confirmacion-mobile');
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).last().click();await page.waitForURL('**/index.html');mark('Cerrar sesión desde perfil móvil: diálogo encima del menú y destino válido');
  await go('perfil.html');await page.waitForURL('**/Inicio%20de%20sesion.html?*');mark('Perfil sin sesión redirige al login con retorno');
  await fresh(true);await go('Registrarse.html');await page.locator('#Iniciar').click();assert.equal(await page.locator('[aria-invalid="true"]').count(),9);
  const values={Nombre:'Estudiante Nuevo',dui:'01234567-8',Direccion:'San Miguel, El Salvador',Giro:'Estudiante',Registro:'001234-5',numeroT:'7777-8888',Email:'nuevo@example.com','Contraseña':'prueba123',ConfirmarContrasena:'diferente'};
  for(const [id,value]of Object.entries(values))await page.locator(`[id="${id}"]`).fill(value);
  await page.locator('#Iniciar').click();assert.equal(await page.locator('#ConfirmarContrasena').getAttribute('aria-invalid'),'true');
  await page.getByRole('button',{name:'Mostrar contraseña',exact:true}).first().click();assert.equal(await page.locator('[id="Contraseña"]').getAttribute('type'),'text');
  await page.locator('#ConfirmarContrasena').fill('prueba123');await page.locator('#Iniciar').click();await page.waitForURL('**/perfil.html');mark('Registro: obligatorios, confirmación, mostrar contraseña y creación simulada');
  await fresh(true);await go('Inicio%20de%20sesion.html');await page.locator('#email').fill('correo-invalido');await page.locator('[id="Contraseña"]').fill('123456');await page.locator('#botoniniciarsesion').click();assert.equal(await page.locator('#email').getAttribute('aria-invalid'),'true');
  await page.locator('#email').fill('prueba@example.com');await page.locator('[id="Contraseña"]').fill('incorrecta');await page.locator('#botoniniciarsesion').click();await page.waitForSelector('.qp-error');
  await page.locator('[id="Contraseña"]').fill('123456');await page.locator('[id="Contraseña"]').press('Enter');await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.waitForURL('**/index.html');mark('Login: formato, error de credenciales y envío con Enter para contraseñas anteriores');
  await fresh(true);await go('Inicio%20de%20sesion.html');await page.locator('#Googleboton').click();await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.waitForURL('**/index.html');mark('Manejador de Google aislado del formulario obligatorio (simulado)');
  await go('contacto.html');await page.locator('input[type="submit"]').click();assert.equal(await page.locator('[aria-invalid="true"]').count(),4);
  for(const [id,value] of Object.entries({nombre:'Estudiante de prueba',telefono:'77778888',correo:'prueba@example.com',mensaje:'Necesito una cotización de repuestos.'}))await page.locator('#'+id).fill(value);
  await page.route('https://formspree.io/**',route=>route.fulfill({status:500,body:'error'}));await page.locator('input[type="submit"]').click();await page.waitForSelector('.qp-error');assert.ok(await page.locator('#mensaje').inputValue());
  await page.route('https://formspree.io/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));await page.locator('input[type="submit"]').click();await page.waitForSelector('.qp-success');assert.equal(await page.locator('#mensaje').inputValue(),'');mark('Contacto: obligatorios, recuperación de error y envío simulado sin borrar texto fallido');
  for(const width of [390,768,1366]){
    await page.setViewportSize({width,height:900});await go('index.html');await page.locator('#draggable-chat-btn').click();await page.waitForSelector('#chatWindow.is-open');
    const geometry=await page.locator('#chatWindow').evaluate(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,top:r.top};});
    assert.ok(geometry.left>=0&&geometry.right<=width&&geometry.top>=80);
    if(width<=600)assert.ok(Math.abs((width-geometry.width)/2-geometry.left)<2);else assert.ok(geometry.left>width/3);
    await page.locator('#chatInput').fill('Motor');await page.locator('#chatInput').press('Enter');await page.waitForTimeout(400);assert.match(await page.locator('.bot-bubble').last().textContent(),/motor/);
    await capture('chat-'+width);await page.locator('#chatCloseBtn').click();assert.ok(!await page.locator('#chatWindow').isVisible());
  }mark('Q Bot cerca del botón en escritorio/tablet, centrado en móvil, consulta y cierre');
  await page.locator('.brand-btn').first().click();assert.ok(await page.locator('#brandModal').isVisible());await page.keyboard.press('Escape');assert.ok(!await page.locator('#brandModal').isVisible());mark('Información de marca abre y cierra con teclado');
  await fresh();await go('cotizador%20ASD/CotizadorFrontier.html');await page.evaluate(()=>window.__failWrite=true);await page.locator('[data-product-code="001001"]').click();await page.waitForSelector('.qp-error');assert.equal(await page.locator('.qp-quick-cart').count(),0);mark('Error al guardar no muestra confirmación falsa');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.localFailures,[]);
  console.log('PASS',report.flows.length,'flujos;',report.pages.length,'vistas; sin excepciones JavaScript ni recursos locales rotos.');
}catch(error){report.failure=error.stack;await page.screenshot({path:path.join(output,'failure.png'),fullPage:false}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
