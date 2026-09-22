# Q Bot para Grupo Q · Configuración y mantenimiento

## 1. Activarlo en Vercel

La única credencial nueva obligatoria es **`GEMINI_API_KEY`**. Se lee en el servidor, nunca en el HTML ni en el JavaScript público.

1. Crea una clave en [Google AI Studio](https://aistudio.google.com/api-keys) para tu proyecto.
2. Sube a GitHub el contenido de este proyecto, incluyendo `api/`, `server/`, `scripts/`, `package.json` y `vercel.json`. Conserva la carpeta `Q parts/` con ese nombre. No subas `.env.local`.
3. En Vercel, selecciona como **Root Directory** la carpeta que contiene `package.json`, `api/` y `vercel.json`; **no** la subcarpeta `Q parts/`.
4. Usa el preset **Other** y Node.js **22.x**. `vercel.json` configura `npm run build` y el directorio público `public/`. Vercel publica `/api/chat` como función de Node.
5. En **Settings → Environment Variables**, crea `GEMINI_API_KEY`, pega la clave y selecciona Production y Preview si usarás ambos entornos. Deja el valor como secreto.
6. Haz un nuevo despliegue. Los cambios de variables no se aplican a despliegues anteriores.
7. En Inicio abre Q Bot y consulta una pieza del inventario. Un saludo se responde localmente y no sirve para verificar la conexión con Gemini.

No pongas la clave en `firebase-config.js` ni uses prefijos públicos como `VITE_` o `NEXT_PUBLIC_`. La clave pública ya existente de Firebase tiene otra función y se conserva.

| Variable | Obligatoria | Valor |
| --- | --- | --- |
| `GEMINI_API_KEY` | Sí | Tu clave de Google AI Studio. |
| `GEMINI_MODEL` | No | Predeterminado: `gemini-3.1-flash-lite`. |

El modelo elegido tiene nivel gratuito según la documentación consultada el 22/09/2026. La cuota efectiva depende del proyecto y puede cambiar: revísala en AI Studio. No hay llamadas a búsquedas de Google, embeddings, File Search ni almacenamiento de contexto de pago. Tampoco hay cambio automático a otro modelo al agotar la cuota. Si tu proyecto tiene facturación habilitada, el código por sí solo no garantiza gasto cero; el responsable debe configurar su cuota en Google.

## 2. Probar en tu equipo

Desde la carpeta de este README y con Node.js 22:

```powershell
Copy-Item .env.example .env.local
```

En macOS/Linux: `cp .env.example .env.local`.

Abre **`.env.local`**, completa la línea y guarda:

```dotenv
GEMINI_API_KEY=PEGA_AQUI_TU_CLAVE
GEMINI_MODEL=gemini-3.1-flash-lite
```

Luego ejecuta:

```bash
npm run dev
```

Abre `http://localhost:3000/`. El servidor local usa las mismas funciones de API que Vercel. No necesita dependencias de producción; `npm install` es necesario para instalar Playwright si deseas repetir las pruebas de navegador.

Live Server, `python -m http.server` y GitHub Pages pueden mostrar las páginas estáticas, pero **no ejecutan `/api/chat`**. Para el chatbot usa este servidor Node o Vercel.

## 3. Contexto propio de Grupo Q

`server/chat/knowledge.js` contiene el contexto editorial y las respuestas de ayuda verificadas contra los archivos del sitio:

- Identidad de Q-Parts como proyecto de repuestos para Grupo Q; atención en español y orientación de servicio.
- Marcas del catálogo: Nissan, Mazda e Isuzu. No se presentan como todas las marcas de la corporación.
- Información que la página Nosotros publica sobre servicio, innovación, calidad y valores.
- Búsqueda por marca/modelo/categoría/código, sesión, edición de perfil y cotización.
- Plantilla de GRUPO Q EL SALVADOR, USD, impuesto configurado del 13 %, generación del PDF y vaciado posterior del carrito. El PDF no constituye una compra ni reserva stock.
- Referencias compartidas entre modelos, identificadas como tales; no se certifica compatibilidad por vehículo o VIN.
- Derivación a Contacto para datos no documentados: sucursales concretas, horarios, garantías, envíos, citas y políticas comerciales.

El asistente conoce **el entorno de este sitio** y sus registros públicos; no se presenta como acceso a SAP, pedidos, agendas de taller o inventario corporativo privado de Grupo Q. Edita ese archivo si el responsable confirma nuevos procesos o información comercial. No hace falta reescribir la interfaz.

## 4. Prompt y dump de la base

| Archivo | Función |
| --- | --- |
| `server/chat/prompt.js` | Prompt de configuración, esquema JSON y validación de la intención. |
| `server/chat/knowledge.js` | Identidad, contexto de Grupo Q, procesos y rutas permitidas del sitio. |
| `server/chat/catalog.js` | Lectura del inventario, normalización, exportación compacta y consultas. |
| `server/chat/service.js` | Llamada a Gemini, límites, errores y construcción de respuestas con datos comprobados. |
| `api/chat.js` | Entrada de la función de Vercel. |
| `Q parts/js/chat-client.js` | Interfaz, memoria breve, tarjetas y confirmación para añadir. |
| `data/chatbot-catalog.json` | Instantánea compacta de los 129 registros públicos revisados; ejemplo para inspección. |
| `data/chatbot-context.txt` | Prompt completo más esa instantánea, legible para revisar la carga al modelo. |
| `data/chatbot-schema.json` | Esquema JSON que se exige a Gemini. |

**No tienes que subir manualmente un dump a Gemini.** En cada consulta la función carga o reutiliza durante un máximo de 30 segundos el nodo público **`Repuestos`** de la misma instancia de Firebase que usa el sitio. El prompt y los datos se adjuntan a la solicitud. Los archivos de `data/` no son un inventario de respaldo en producción y no se publican como parte del sitio.

Puedes volver a exportar una copia de inspección sin clave de Gemini:

```bash
npm run chatbot:dump
```

Para procesar un archivo que contenga **solo el nodo Repuestos**:

```bash
npm run chatbot:dump -- --source ruta/al/nodo-Repuestos.json
```

El ZIP incluye un ejemplo exportado a partir de la lectura pública realizada durante esta revisión. La fecha `at` de una exportación desde archivo indica cuándo se procesó esa copia; no certifica una consulta en línea en ese momento. El servidor usa siempre Firebase y muestra la hora de su propia lectura.

El dump aplica una lista de campos permitidos. **No lee ni envía perfiles, DUI, teléfonos, contraseñas, carritos ni otros nodos.** `ModelEx` duplicaba el código en los 129 registros revisados y no se repite; las URL de imágenes tampoco se envían. Se conservan nombre, código, marca, modelo, categoría, año, precio y existencias. El modelo recibe además la consulta escrita por el visitante y su breve historial; esa entrada puede contener datos personales si el visitante los escribe. No deben introducirse datos sensibles en el chat. En el nivel gratuito, Google indica que el contenido puede utilizarse para mejorar sus productos.

Formato del dump:

```json
{
  "v": 1,
  "at": "fecha ISO de la lectura/exportación",
  "total": 129,
  "complete": true,
  "columns": ["code", "name", "brand@d", "model@d", "category@d", "year", "price_cents_USD", "stock"],
  "d": ["Nissan", "Frontier", "Sistema de Escape"],
  "rows": [["12258631", "Tubo de escape", 0, 1, 2, "2026", 18080, 5]]
}
```

El ejemplo anterior muestra una fila. Los números de las columnas `@d` son índices del diccionario `d`; `18080` centavos significa USD 180.80. Los códigos siguen siendo cadenas, incluyendo ceros iniciales y los espacios históricos de algunas claves. Un precio o existencia ausente se representa con `null`; un stock de `0` significa agotado. Datos imposibles o mal formados tampoco se convierten en cero.

## 5. Respuestas y acciones verificadas

Gemini interpreta la consulta y produce un **plan JSON**: intención, marca, modelo, nombre/categoría/código, año, límites de precio, orden y cantidad. El prompt distingue las instrucciones de configuración de los datos y rechaza instrucciones incrustadas en consultas o registros.

El servidor valida ese plan, busca en el inventario y construye el texto y las tarjetas. **Los precios y existencias que ve el visitante no se copian de prosa generada por la IA.** Proceden de los registros de Firebase. Si Gemini devuelve campos no permitidos, una respuesta incompleta o JSON inválido, se muestra un error sin inventar resultados.

El modelo puede interpretar mal una pregunta; las tarjetas muestran marca, modelo, código y filtros para que el visitante pueda comprobar la selección. El sistema tampoco puede corregir por sí mismo cifras erróneas ya guardadas en Firebase. El dato refleja la última lectura del catálogo, con un máximo de 30 segundos de caché, y no confirma disponibilidad física en una sucursal.

Ejemplos de consultas:

- «¿Hay dos tubos de escape para Frontier?»
- «¿Cuánto cuesta el código 12258631?»
- «Frenos de Nissan por menos de 100 dólares»
- «¿Cuál es el más barato?» / «Quiero dos del segundo»
- «¿Qué marcas tiene este catálogo de Grupo Q?»
- «¿Cómo descargo mi cotización?»

Para añadir, Q Bot propone el botón de la tarjeta. **Solo el clic del usuario escribe en su carrito**, mediante el servicio existente, que exige sesión y vuelve a leer las existencias. El modelo no escribe en Firebase, no elimina productos, no reserva unidades ni genera compras autónomas. Las acciones de borrar, cambiar cantidades y generar PDF siguen disponibles en Cotización.

## 6. Consumo y límites

| Control | Configuración |
| --- | --- |
| Texto de la consulta | Hasta 700 caracteres. |
| Memoria enviada | Últimos 4 mensajes; 700 caracteres por mensaje de usuario y hasta 1200 de contexto de respuesta. |
| Catálogo actual | 129 registros completos: 7,563 bytes compactos frente a 37,121 bytes del JSON original (aprox. 79.6 % menos bytes). |
| Catálogo futuro grande | Si supera 14,000 bytes, el modelo recibe hasta 40 registros seleccionados y `complete:false`; la consulta final sigue recorriendo **todos** los registros. |
| Respuesta de Gemini | Una llamada como máximo por consulta; hasta 768 tokens de salida y razonamiento mínimo en el modelo predeterminado. |
| Repeticiones idénticas | Caché de planes durante 30 s; incluye la huella del inventario para invalidarse al cambiar los datos. |
| Saludos breves | Respuesta local, cero llamadas a Gemini. |
| Peticiones | 8/minuto y 100/día por IP, por instancia; hasta 3 peticiones simultáneas por instancia. |
| Reintentos | Solo manuales; no se multiplican llamadas automáticamente ante errores. |
| Datos de consumo | La respuesta de `/api/chat` incluye `usage` con los contadores reales que devuelva Google; `null` cuando no hubo llamada. |

La reducción de bytes **no equivale** a una medición exacta de tokens. El consumo de entrada depende de la tokenización, el prompt, el esquema, la pregunta y el historial. Se limita el contexto de datos a 21,000 bytes y el prompt tiene tamaño fijo. Para medir tokens reales usa `test:chat:live` después de configurar la clave.

Los límites guardados en memoria son una protección básica: Vercel puede abrir varias instancias o reiniciarlas. No son un presupuesto global ni un límite duradero por visitante. Para tráfico público mayor, configura reglas de rate limiting en Vercel o un almacén compartido, además de las cuotas del proveedor. El proyecto no añade esa infraestructura ni una segunda clave obligatoria.

## 7. Pruebas y problemas frecuentes

```bash
npm test
npm run test:chat
npm install
npx playwright install chromium
npm run test:chat:browser
npm run test:layout
```

Las pruebas automáticas usan Gemini y Firebase simulados para comprobar el contrato, los números, las referencias, las acciones explícitas, la interfaz y los errores sin escribir en producción. El inventario de prueba reproduce los 129 registros públicos revisados. Los resultados del navegador quedan en `tests/results/`.

**Falta la validación en vivo con tu clave.** No se ha certificado el comportamiento real del modelo ni se ha realizado un despliegue en tu Vercel. Cuando configures la clave, ejecuta:

```bash
npm run test:chat:live
```

Hace hasta seis consultas reales: precio/stock, seguimiento para añadir, CX-30, contexto de Grupo Q, código inexistente e instrucción de inventar existencias. Comprueba códigos y cifras contra Firebase y escribe `tests/results/chat-live.json`, sin guardar la clave ni modificar carritos. Termina con código 2 si no hay clave y con código 1 si falla un caso o se agota una cuota. No convierte un fallo en una prueba aprobada.

| Síntoma | Comprobación |
| --- | --- |
| «Q Bot aún no está configurado» | Revisa el nombre exacto `GEMINI_API_KEY`; reinicia `npm run dev` o despliega de nuevo en Vercel. |
| «Q Bot no está disponible en este servidor» | Usa Node/Vercel, no un servidor exclusivamente estático. Revisa la raíz del proyecto. |
| «Límite de consultas» / HTTP 429 | Espera; consulta la cuota de Gemini y los límites por IP. El catálogo sigue accesible. |
| «No pude comprobar el inventario» | Revisa conexión y lectura pública de `/Repuestos`. No abras los perfiles ni carritos para resolverlo. |
| «No pudo conectarse al asistente» | Revisa permisos/validez de la clave y disponibilidad del modelo en AI Studio. |
| No puede añadir un repuesto | Inicia sesión; revisa existencias actuales y las reglas de acceso del carrito existente. |

## Fuentes técnicas

- [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite), [precios](https://ai.google.dev/gemini-api/docs/pricing) y [cuotas](https://ai.google.dev/gemini-api/docs/rate-limits).
- [Clave de API](https://ai.google.dev/gemini-api/docs/api-key), [generateContent](https://ai.google.dev/api/generate-content) y [salidas estructuradas](https://ai.google.dev/gemini-api/docs/structured-output).
- [Funciones Node de Vercel](https://vercel.com/docs/functions/runtimes/node-js) y [variables de entorno](https://vercel.com/docs/environment-variables/managing-environment-variables).
- [Lectura REST de Firebase](https://firebase.google.com/docs/database/rest/retrieve-data).

Las decisiones de implementación, medidas de tamaño y pruebas anteriores corresponden a este proyecto; las fuentes documentan los servicios externos y pueden cambiar.
