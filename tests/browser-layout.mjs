import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDevServer } from '../scripts/dev.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here);
const require=createRequire(import.meta.url);
const {chromium}=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright') : await import('playwright');
const output=path.join(here,'results/layout');fs.mkdirSync(output,{recursive:true});
const fixture=JSON.parse(fs.readFileSync(path.join(here,'fixtures.json')));
fixture.Repuestos=JSON.parse(fs.readFileSync(path.join(here,'fixtures-original-catalog.json')));
const files=['','cotizador ASD/'].flatMap(dir=>fs.readdirSync(path.join(root,'Q parts',dir)).filter(file=>file.endsWith('.html')&&/id="SeccionCatalogo"/.test(fs.readFileSync(path.join(root,'Q parts',dir,file),'utf8'))).map(file=>dir+file))
  .filter(file=>file!=='repuestos.html').map(file=>file.split('/').map(encodeURIComponent).join('/'))
  .concat(['repuestos.html?marca=Nissan&modelo=NP300','repuestos.html?marca=Mazda&modelo=CX-30','repuestos.html?marca=Isuzu&modelo=D-MAX']);
const server=createDevServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,base=origin+'/Q%20parts/';
const browser=await chromium.launch({headless:true,...(process.env.QP_CHROMIUM_PATH?{executablePath:process.env.QP_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-gpu']});
const context=await browser.newContext();
await context.route('**/js/backend.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(here,'mock-backend.js'),'utf8')}));
await context.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
await context.addInitScript(data=>{window.__qpFixture={data};},fixture);
const page=await context.newPage();page.setDefaultTimeout(7000);
const report={browser:browser.version(),searches:[],corporate:[],errors:[]};
page.on('pageerror',error=>report.errors.push(error.message));
try {
  for(const width of [320,390,600,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for(const file of files) {
      await page.goto(base+file,{waitUntil:'domcontentloaded'});
      await page.locator('#qp-product-search').waitFor();
      await page.locator('#qp-product-search').fill('Texto de prueba largo que debe quedar dentro del campo y separado del botón para limpiar');
      const boxes=await page.locator('.qp-search-input').evaluate(box=>{
        const input=box.querySelector('input').getBoundingClientRect(),button=box.querySelector('button').getBoundingClientRect(),outer=box.getBoundingClientRect();
        return {inputRight:input.right,buttonLeft:button.left,buttonRight:button.right,buttonWidth:button.width,buttonHeight:button.height,outerRight:outer.right,outerLeft:outer.left};
      });
      assert.ok(boxes.buttonLeft-boxes.inputRight>=7,`${file} (${width}) input y X se solapan`);
      assert.ok(boxes.buttonWidth>=44&&boxes.buttonHeight>=44);
      assert.ok(boxes.buttonRight<=boxes.outerRight&&boxes.outerRight<=width+1&&boxes.outerLeft>=0);
      if(file==='repuestos.html?marca=Nissan&modelo=NP300'&&[390,1440].includes(width)) {
        await page.locator('.qp-search-input').screenshot({path:path.join(output,'buscador-con-texto-'+width+'.png'),animations:'disabled'});
      }
      await page.getByRole('button',{name:'Limpiar búsqueda',exact:true}).click();
      assert.equal(await page.locator('#qp-product-search').inputValue(),'');
      assert.ok(await page.locator('#qp-product-search').evaluate(node=>node===document.activeElement));
      report.searches.push({file,width,...boxes});
      if(file==='repuestos.html?marca=Nissan&modelo=NP300'&&[390,1440].includes(width)) {
        await page.locator('.qp-search-tools').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(output,'buscador-'+width+'.png'),animations:'disabled'});
      }
    }
    console.log('Buscadores:',width,files.length,'páginas');
  }
  for(const width of [320,390,480,481,600,768,1024,1440]) {
    await page.setViewportSize({width,height:900});await page.goto(base+'index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.documentElement.dataset.qpReady==='true');
    const metrics=await page.locator('.corp-checks').evaluate(grid=>{
      const items=[...grid.querySelectorAll('.check-item')];
      const outside=items.flatMap((item,i)=>{
        const bounds=item.getBoundingClientRect();
        return [...item.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()).flatMap(n=>{
          const range=document.createRange();range.selectNodeContents(n);
          return [...range.getClientRects()].filter(r=>r.left<bounds.left-1||r.right>bounds.right+1||r.bottom>bounds.bottom+1).map(()=>i);
        });
      });
      const rect=grid.getBoundingClientRect();
      return {columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,outside,left:rect.left,right:rect.right};
    });
    assert.deepEqual(metrics.outside,[],'Texto fuera de su celda: '+width);
    assert.ok(metrics.left>=0&&metrics.right<=width);assert.equal(metrics.columns,width<=480?1:2);
    await page.locator('.corporate-section').scrollIntoViewIfNeeded();
    if([390,600].includes(width))await page.screenshot({path:path.join(output,'grupo-q-'+width+'.png'),animations:'disabled'});
    report.corporate.push({width,...metrics});
  }
  assert.deepEqual(report.errors,[]);
  console.log('OK',report.searches.length,'vistas de buscadores y',report.corporate.length,'vistas de textos de Grupo Q');
} finally {
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
