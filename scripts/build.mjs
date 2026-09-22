import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await fs.rm(root+'public',{recursive:true,force:true});
await fs.mkdir(root+'public',{recursive:true});
await fs.copyFile(root+'index.html',root+'public/index.html');
// Solo archivos públicos; nunca .env, scripts, pruebas ni módulos del servidor.
await fs.cp(root+'Q parts',root+'public/Q parts',{recursive:true});
console.log('Sitio estático preparado en public/. Vercel compila api/chat.js por separado.');
