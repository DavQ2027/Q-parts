import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if(existsSync(path.join(root,'.env.local')))loadEnvFile(path.join(root,'.env.local'));
const {default:chat}=await import('../api/chat.js');
export function createDevServer(handler=chat.fetch) {
 return http.createServer(async(req,res)=>{
  try {
   const url=new URL(req.url,'http://'+req.headers.host);
   if(url.pathname==='/api/chat') {
    const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});
    const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
   }
   const pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
   if(pathname!=='/index.html'&&!pathname.startsWith('/Q parts/')){res.writeHead(404).end('No encontrado');return;}
   const file=path.resolve(root,'.'+pathname);
   if((file!==path.join(root,'index.html')&&!file.startsWith(path.join(root,'Q parts')+path.sep))||path.relative(root,file).split(path.sep).some(p=>p.startsWith('.'))){res.writeHead(404).end();return;}
   const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif','.ttf':'font/ttf','.gif':'image/gif'};
   res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(readFileSync(file));
  }catch{res.writeHead(404).end('No encontrado');}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const port=Number(process.env.PORT)||3000;
 createDevServer().listen(port,'127.0.0.1',()=>console.log(`Q-Parts: http://localhost:${port} (chat y sitio en el mismo servidor)`));
}
