// Exporta exclusivamente el catálogo público. No necesita clave de Gemini.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compactCatalog, createCatalogLoader, normalizeCatalog } from '../server/chat/catalog.js';
import { SYSTEM_PROMPT, GEMINI_PLAN_SCHEMA } from '../server/chat/prompt.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--source')) {
  console.error('Uso: npm run chatbot:dump [-- --source ruta/al/nodo-Repuestos.json]');
  process.exitCode = 1;
} else {
  try {
    const snapshot = args.length
      ? { products: normalizeCatalog(JSON.parse(await fs.readFile(path.resolve(args[1]), 'utf8'))), fetchedAt: new Date().toISOString() }
      : await createCatalogLoader()();
    const dump = JSON.stringify(compactCatalog(snapshot.products, snapshot.fetchedAt));
    const folder = path.join(root, 'data');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, 'chatbot-catalog.json'), dump + '\n');
    await fs.writeFile(path.join(folder, 'chatbot-context.txt'), SYSTEM_PROMPT + '\n\nDATOS_CATALOGO:\n' + dump + '\n');
    await fs.writeFile(path.join(folder, 'chatbot-schema.json'), JSON.stringify(GEMINI_PLAN_SCHEMA, null, 2) + '\n');
    console.log(`Dump público: ${snapshot.products.length} registros, ${Buffer.byteLength(dump)} bytes compactos. Archivos en data/.`);
    console.log('Son instantáneas para inspección; la API consulta Firebase y NO usa estos archivos como inventario vigente.');
  } catch (error) {
    console.error('No se pudo exportar el nodo público Repuestos. Comprueba su acceso o el archivo de origen. Código:', error.code || error.message);
    process.exitCode = 1;
  }
}
