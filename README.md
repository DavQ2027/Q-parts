# Q-Parts 2.0.2

Revisión del proyecto académico de grupo Q Parts · 22 de septiembre de 2026.

Actualización puntual sobre 2.0.1: presentación de Nissan NP300, Isuzu D-MAX y Mazda CX-30, formato original de la cotización PDF y vaciado del carrito después de generarla. No requiere compilación.

## Cambios de 2.0.2

- **Mismo ancho que los otros cotizadores:** las tres vistas usan un contenedor de máximo 1100 px, con el catálogo de hasta 1020 px y un máximo de **tres columnas** en escritorio. En pantallas menores se adapta a dos o una columna.
- **Sin enlace adicional:** se elimina «Volver al catálogo de marcas» de esta plantilla.
- **Indicadores del vehículo:** cada botón se conecta a su zona mediante una línea roja punteada y un punto de origen. Las líneas acompañan el tamaño de la imagen. En móvil, los botones siguen debajo de la ilustración, como en los demás cotizadores. La animación respeta la preferencia de movimiento reducido.
- **Icono de pestaña:** `repuestos.html` vuelve a usar el favicon local de Q-Parts.
- **Formato PDF restaurado:** hoja A4 horizontal, logo, título «Cotización de Grupo Q», número y fecha, campos en recuadros, tabla verde con las siete columnas originales y desglose de subtotal, descuento, impuesto y total. Los documentos largos repiten la cabecera de tabla, admiten nombres en varias líneas y muestran números de página.
- **Carrito después del PDF:** al generar el archivo e iniciar correctamente su descarga se vacía el carrito, se actualiza el contador y se deshabilita la exportación de un carrito vacío. Mientras se genera, se bloquean los controles del carrito para evitar cambios o descargas duplicadas. Si falta el perfil, falla el generador o la descarga produce un error, los productos permanecen. Si el archivo se genera pero falla el vaciado, se muestra un aviso para reintentarlo. Si otra pestaña modifica el carrito durante la generación, este se conserva para no borrar productos que no aparecen en el PDF.

### Datos y cálculo del PDF

La plantilla usa los valores de la captura: sociedad **GRUPO Q EL SALVADOR**, canal **Q4**, centro **S052**, almacén **2200**, moneda **USD** y pago **Contado**. Están centralizados en `Q parts/js/quote-pdf.js`. La marca procede de los productos; el nombre y la ID tributaria proceden del nombre y DUI guardados en el perfil.

Se restaura el cálculo mostrado en la captura: descuento 0 e impuesto de venta del **13 %** sobre el subtotal. Los importes se redondean en centavos; por ejemplo, **180.80 + 23.50 = 204.30**. La pantalla del carrito identifica su importe como «Subtotal (sin impuesto)». Estos son parámetros de la plantilla académica solicitada.

El código del cliente y la orden de compra quedan vacíos cuando no existen los campos opcionales `codigoCliente` y `ordenCompra` en su ficha; no se inventan números ni se modifica el formulario de perfil. Se conserva la referencia de cotización `QP-` seguida de fecha y hora. El navegador inicia la descarga mediante jsPDF; el sitio no puede comprobar la confirmación final del diálogo de guardado del sistema.

### Alcance de esta actualización

Archivos de aplicación modificados: `Q parts/repuestos.html`, `Q parts/css/qparts.css`, `Q parts/js/catalog-models.js`, `Q parts/carrito.html`, `Q parts/js/cart-page.js` y `Q parts/js/cart-service.js`. Se añade `Q parts/js/quote-pdf.js` para separar la plantilla PDF. También se actualizan este README, la versión/comandos de `package.json` y la prueba existente del carrito, y se añade `tests/browser-quote.mjs`.

Se conservan los datos, imágenes, búsquedas y asociaciones de repuestos de 2.0.1. Los archivos ajenos a estas correcciones conservan su contenido. El PDF de informe y `docs/VERIFICACION.json` incluidos en `docs/` son documentos históricos de la entrega 2.0; los cambios actuales se documentan aquí.

### Verificación de 2.0.2

- 53 pruebas de lógica existentes aprobadas.
- 24 vistas de las tres páginas a 320, 390, 700, 701, 768, 1024, 1440 y 1920 px: sin desbordamientos, imágenes y favicon locales, máximo de tres columnas, ancho igual al cotizador de referencia y 21 botones de categoría funcionales. Revisión visual adicional de los puntos del D-MAX.
- Suite general: 23 páginas en cuatro anchos (92 vistas) y 20 flujos aprobados, incluido el nuevo vaciado después del PDF y el vaciado manual con confirmación.
- Ocho casos específicos de exportación: descarga pendiente, éxito persistente, generador ausente, error de descarga, perfil incompleto, error al vaciar, cambio concurrente del carrito y cotización de 65 filas en seis páginas. Se comprueba el contenido completo de las filas y los importes, y se revisan visualmente las páginas PDF.
- Pruebas en Chromium 153 con Firebase y servicios externos simulados. Esta revisión no escribe datos en producción.

## Cambios puntuales de 2.0.1 (historial)

- **Ilustraciones y botones:** NP300, D-MAX y CX-30 recuperan las vistas de referencia utilizadas por el proyecto original. Sus botones filtran las categorías; en móvil se distribuyen debajo de la imagen para seguir siendo legibles.
- **Repuestos recuperados:** se conservan tanto los registros propios de cada modelo como el catálogo que abrían sus enlaces originales. También se revisaron QKR y PickUp, que sufrían el mismo recorte de datos.
- **Imágenes:** los tres registros de frenos de Kicks ya no muestran el logo ni una foto del automóvil. Usan una foto local de pastillas con la leyenda «Imagen ilustrativa». Se recupera localmente la imagen original del motor Mazda y se sustituye la imagen inválida de frenos de Mazda por la misma referencia identificada. Si Firebase recibe una nueva URL válida, esa imagen tiene prioridad.
- **Contacto y Perfil:** fuente Plus Jakarta Sans incluida localmente, con respaldo sans-serif y herencia correcta en campos, botones y menú. Perfil vuelve a una tarjeta centrada de máximo 520 px; los campos y mensajes quedan dentro de ella.
- **Cuadrículas:** límite de ancho de modelos, columnas que caben en pantallas pequeñas y tarjetas que no se estiran a todo el ancho cuando quedan pocos resultados. El catálogo CX-5 sale de la tarjeta informativa que lo encerraba en una columna estrecha.
- **Animación de acceso:** vuelve el aviso «¡Bienvenido de nuevo!» con círculo y marca animados y botón **Continuar**, tanto con correo como con Google. Se recreó con un diálogo local para que aparezca encima del menú. Los errores de acceso no muestran bienvenida. Se respeta el destino de retorno al continuar.
- **Otras animaciones solicitadas:** entrada breve de avisos y confirmaciones, e indicador de trabajo en los botones de acceso y guardado. Se desactivan con la preferencia del sistema de reducir movimiento.

### Catálogos compartidos del proyecto original

Los enlaces y consultas originales compartían datos entre distintos modelos. Se recuperan **como referencias de la demostración**, con una indicación visible y conservando marca, modelo, código, precio y existencias del registro; no se declara que sean piezas compatibles entre vehículos.

| Página | Registros propios en la consulta revisada | Referencia original recuperada | Total visible |
| --- | ---: | --- | ---: |
| Nissan NP300 | 1 | 28 de Nissan Frontier | 29 |
| Nissan Kicks | 3 | 26 de Nissan Sedan | 29 |
| Isuzu D-MAX | 0 | 10 del cotizador PickUp original | 10 |
| Mazda CX-30 | 0 | 2 de Mazda CX-5 | 2 |
| Isuzu QKR | 0 | 9 de Isuzu QMR | 9 |
| Mazda PickUp | 4 | 6 registros PickUp adicionales del cotizador original | 10 |

Estas cantidades corresponden a la lectura del 22/09/2026; cambian al editar el inventario. No se inventaron repuestos ni se escribieron cambios en Firebase. Las ilustraciones reutilizadas también identifican su modelo de referencia. Para un catálogo comercial, el responsable debe asignar la compatibilidad real por vehículo/VIN en la base de datos.

### Alcance de los archivos modificados

- Código existente: `Q parts/css/qparts.css`, `Q parts/js/catalog.js`, `Q parts/js/forms.js` y `Q parts/cotizador ASD/cotizadorMazdacx-5.html`.
- Complementos de estas correcciones: `catalog-models.js`, `catalog-media.js`, `auth-feedback.js`, fuentes locales con su licencia e imágenes de referencia con sus fuentes.
- Documentación y verificación: este README, versión/comandos de `package.json`, adaptación de las pruebas de acceso y modelos, y nuevas pruebas de regresión.

En la entrega 2.0.1, el resto de los archivos de aplicación de la versión 2.0 conservaba sus bytes: configuración y operaciones Firebase, carrito y cantidades, validaciones, rutas, menú, página de inicio, Q Bot y exportación de cotizaciones. Los cambios posteriores del PDF y su vaciado se detallan arriba, en 2.0.2.

## Cómo abrir el proyecto

1. Descomprime `Q-parts.zip` y abre la carpeta `Q-parts` en Visual Studio Code.
2. Abre una terminal en esa carpeta, donde está este README.
3. En Windows, con Python instalado, ejecuta:

   ```powershell
   py -m http.server 8000
   ```

   En otros sistemas puedes usar `python3 -m http.server 8000`.
4. Abre `http://localhost:8000/` en el navegador. La entrada raíz conduce a `Q parts/index.html`.
5. También puedes usar Live Server de VS Code. Sirve el proyecto por HTTP; abrir los archivos con doble clic puede bloquear los módulos JavaScript.

La navegación, los estilos y los iconos son locales. El inventario y las cuentas requieren conexión con Firebase. El formulario de contacto conserva el servicio Formspree configurado en el proyecto original. Google Fonts y algunas imágenes de inventario pueden requerir Internet; hay tipografía alternativa e imagen de respaldo.

## Funciones conservadas de 2.0

| Área | Comportamiento nuevo |
| --- | --- |
| Navegación | Las 23 páginas internas usan el mismo menú y las mismas rutas. Mi perfil y Cerrar sesión están disponibles desde cualquier página cuando hay una sesión activa. |
| Pantallas pequeñas | Menú hamburguesa con iconos y estado expandido. Puede cerrarse con Escape, al seguir un enlace o al pulsar fuera. El cambio a menú amplio ocurre a partir de 1200 px. |
| Barra superior | Posición fija y espacio reservado de 80 px, evitando que el contenido inicial quede debajo. |
| Alertas | Confirmaciones con `dialog`, por encima de la navegación. Avisos y panel de cantidad debajo de la barra. |
| Interacción | Hover y pulsación sutiles, foco visible, nombres accesibles y respeto por la preferencia de movimiento reducido. |
| Iconos | Lucide 1.8.0 incluido localmente; menú, búsqueda, cuenta, carrito, cantidades, descarga, guardado y otras acciones. |
| Formularios | Validación de inicio de sesión, registro, perfil y contacto; errores junto al campo; envío con Enter; botones bloqueados durante solicitudes para evitar envíos repetidos. |
| Registro | Corregido el error de sintaxis que impedía ejecutar su módulo. Confirmación de contraseña y controles para mostrarla u ocultarla. Google ya no intenta enviar el formulario de registro. |
| Perfil | Corregida la redirección a `login.html`, que no existía. La edición del correo solicita verificación antes de cambiar el acceso en Firebase. |
| Catálogo | Búsqueda mientras se escribe por nombre, código, modelo y categoría, sin distinguir mayúsculas ni acentos. Disponible por marca y dentro de cada cotizador. |
| Modelos | Se conservan los registros propios; la revisión 2.0.1 recupera las referencias compartidas del proyecto original, identificadas en cada tarjeta. |
| Tarjetas | Cuadrícula adaptable y controles legibles. Los estados de carga, catálogo vacío y falta de conexión tienen mensajes. |
| Cantidades | Un registro por código de repuesto. Sumar/restar, eliminar y total actualizado, con comprobación de existencias. |
| Q Bot | Ventana próxima al botón en escritorio y tablet; centrada en móvil. Se conserva el arrastre con ratón y se mejora el uso con teclado. |
| PDF de cotización | Formato original restaurado en 2.0.2. Generarlo vacía el carrito después de iniciar la descarga; el botón de vaciado manual conserva su confirmación. |
| Correcciones adicionales | Rutas de pies de página, entrada raíz, formulario de contacto con capa negativa, estilos de formularios con alturas fijas y mensajes de error incompletos. |

## Panel rápido al añadir

Después de confirmar el guardado de un producto, se abre un panel con **menos**, **más**, **eliminar** y acceso a la cotización. Muestra la cantidad total de ese repuesto en la cuenta.

El panel se cierra tras **dos segundos sin actividad**. Las interacciones reinician el tiempo y una solicitud en curso no lo cierra. Para facilitar el uso con teclado, permanece abierto mientras un control tiene foco visible; Escape o el botón de cierre permiten cerrarlo. Al llegar a cero, el producto se retira. Un error de guardado nunca produce una confirmación de éxito.

## Reglas de validación

- Nombre: 3 a 80 caracteres; letras, espacios y signos habituales de nombres.
- DUI: 9 dígitos, con o sin el guion antes del último dígito. Se conservan ceros iniciales.
- Teléfono: 8 dígitos, con separador opcional y prefijo `+503` opcional.
- Dirección: 10 a 200 caracteres.
- Giro: 2 a 100 caracteres.
- Registro fiscal: 2 a 14 dígitos; admite guiones entre grupos.
- Correo: formato de correo y longitud máxima de 254 caracteres.
- Nueva contraseña: 8 a 128 caracteres y confirmación coincidente.
- Acceso de cuentas existentes: no se impone el nuevo mínimo de 8 caracteres; las cuentas anteriores con contraseña de 6 caracteres pueden iniciar sesión.
- Contacto: todos los campos obligatorios; mensaje de 10 a 2000 caracteres. Si el envío falla, se conserva el texto para reintentar.

Las validaciones de documentos son de **formato**: no comprueban identidad, existencia de un documento o validez fiscal. Las operaciones que afecten datos también deben estar protegidas por reglas del servidor.

## Carrito y compatibilidad con los datos anteriores

Se conservan las rutas originales `Repuestos`, `usuarios/{uid}` y `carrito/{uid}`. No se cambió el proyecto Firebase ni se importó un inventario de demostración a producción.

La versión anterior utilizaba `push()` cada vez que se añadía una unidad. Ahora se usa una clave estable por código y `runTransaction()` sobre el carrito del usuario. Esto permite consolidar los registros anteriores y actualizar las cantidades sin sobrescribir cambios concurrentes de otra pestaña. La consolidación se realiza al cargar el carrito de una sesión y suma las cantidades existentes del mismo código.

Las operaciones de añadir verifican las existencias publicadas; no reservan ni descuentan inventario. Si un carrito antiguo supera las existencias actuales, no se recorta su cantidad automáticamente: puede reducirse, pero no ampliarse por encima del límite.

Los nombres de producto se insertan como texto, evitando interpretar contenido del inventario como HTML. En el catálogo, las imágenes defectuosas conocidas se corrigen localmente; otros errores de imagen muestran «Imagen no disponible», sin presentar el logotipo como fotografía de un repuesto.

## Organización del código

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `index.html` | Entrada raíz que conduce al inicio válido. |
| `Q parts/*.html` | Páginas originales, formularios, catálogo de marcas, perfil y carrito. |
| `Q parts/repuestos.html` | Catálogo parametrizado con las vistas de referencia restauradas para NP300, D-MAX y CX-30. |
| `Q parts/cotizador ASD/*.html` | Diagramas y repuestos por modelo. |
| `Q parts/css/qparts.css` | Navegación, capas, hover, accesibilidad y componentes adaptables compartidos. |
| `Q parts/js/app.js`, `session.js` | Menú, sesión y coordinación de páginas. |
| `Q parts/js/firebase-config.js`, `backend.js` | Configuración original y carga única del SDK Firebase 10.12.0. |
| `Q parts/js/catalog.js` | Coincidencias en tiempo real y filtro por vehículo/categoría. |
| `Q parts/js/catalog-models.js`, `catalog-media.js` | Referencias de los modelos, vistas ilustradas e imágenes corregidas. |
| `Q parts/js/auth-feedback.js` | Bienvenida animada y botón Continuar. |
| `Q parts/js/cart-model.js`, `cart-service.js` | Consolidación, cantidades y operaciones atómicas. |
| `Q parts/js/quick-cart.js`, `cart-page.js` | Panel temporal, vista del carrito y flujo de exportación/vaciado. |
| `Q parts/js/quote-pdf.js` | Formato de cotización, parámetros de la plantilla y totales con impuesto. |
| `Q parts/js/validation.js`, `forms.js` | Reglas, mensajes y guardado de formularios. |
| `Q parts/js/home.js` | Q Bot y ventanas de información de marcas. |
| `Q parts/js/ui.js`, `utils.js` | Avisos, confirmaciones, iconos, formato y utilidades. |
| `Q parts/js/inventory.js` | Validaciones de la herramienta de carga `LLENADO.html`. |
| `Q parts/vendor/` | Lucide 1.8.0, jsPDF 2.5.1 y AutoTable 3.8.2, con licencias. |
| `tests/` | Pruebas aisladas; casos ficticios y copia de los 129 registros públicos originales para reproducir las capturas. |

Los archivos Bootstrap y los recursos originales se conservan. Se retiraron los scripts de sesión y carrito repetidos dentro de cada página para evitar comportamientos distintos entre menús.

## Verificación anterior de 2.0.1

- **53 pruebas de lógica**: las 41 existentes y 12 casos de regresión de consultas, modelos e imágenes.
- **23 páginas internas en 4 anchos**: 360, 768, 1024 y 1440 px; 92 combinaciones de página y pantalla.
- **20 flujos de navegador**: búsqueda, categorías, cantidades, carrito, perfil, cierre de sesión, registro, acceso, Google simulado, contacto simulado y Q Bot.
- **84 vistas adicionales de las 12 páginas afectadas**, con la copia del catálogo real: 320, 390, 768, 1024, 1243, 1440 y 1920 px. Se comprueban imágenes ilustrativas, cantidad de registros, fuentes locales y ausencia de controles/tarjetas fuera de la pantalla.
- **6 flujos de regresión**, incluidos los 46 marcadores de vehículos, imágenes corregidas, bienvenida, destino de retorno y movimiento reducido. Se carga también Bootstrap 5.3.3 en esta suite para detectar conflictos con sus estilos.
- Generación real de un PDF de cotización desde el navegador y revisión visual de su contenido.
- Pruebas ejecutadas en Chromium 153; no se afirma verificación en Safari, Firefox o dispositivos físicos.

La navegación se ejercitó con clics y teclado y se revisaron capturas de escritorio y móvil. Las pruebas de cuentas, escrituras y contacto utilizaron un sustituto local de Firebase y respuestas de Formspree simuladas: **no crearon cuentas, no enviaron mensajes y no modificaron la base de producción**. El inventario existente se consultó únicamente en modo de lectura.

### Ejecutar las pruebas

Con Node.js 20 o superior:

```bash
npm test
```

Para repetir la revisión de navegador:

```bash
npm install
npx playwright install chromium
npm run test:browser
npm run test:regressions
npm run test:quote
```

Los scripts inician un servidor local temporal. Los resultados, capturas y PDF de cotización de prueba se escriben en `tests/results/`. El sustituto de Firebase solo se inyecta desde las pruebas; el sitio normal usa Firebase real. La suite de regresión bloquea proveedores externos de imágenes para verificar también los recursos locales y los estados sin imagen; no certifica la disponibilidad permanente de todas las fotografías de terceros.

## Comprobaciones al instalar en tu equipo

1. Verifica que el dominio de prueba (`localhost`, el de Live Server o el de publicación) esté autorizado en Firebase Authentication y que los métodos de acceso usados estén habilitados.
2. Prueba una cuenta propia, el acceso real con Google y el cambio de correo verificado. Esos pasos dependen de la configuración y credenciales de tu Firebase.
3. Confirma que las reglas permitan al usuario leer y modificar únicamente su propio perfil y carrito. Las transacciones necesitan lectura y escritura en `carrito/{uid}`.
4. Restringe la escritura de `Repuestos` a responsables autorizados. `LLENADO.html` es una herramienta de mantenimiento, no una pantalla para visitantes; exigir sesión en la interfaz no sustituye las reglas de Firebase.
5. Revisa las etiquetas del inventario. En la consulta realizada había variantes de nombres y modelos sin registros coincidentes. La versión reconoce variantes como `Mazda CX-5` / `cx-5`, `Frontier NP300` / `NP300`, y categorías como `Motor` / `Motor y Parrilla`; no inventa repuestos para catálogos vacíos.
6. Verifica el destino de Formspree con el responsable antes de hacer un envío real.

No se publicaron cambios ni se enviaron commits al repositorio remoto. El ZIP excluye `.git` y `node_modules`. Para incorporarlo a tu clon existente, copia los archivos del proyecto sobre ese clon, conserva su carpeta `.git` y revisa los cambios antes de confirmarlos.

Q Bot conserva respuestas predefinidas: no consulta una IA ni valida averías o compatibilidad por VIN. La cotización es un resumen de referencia, no una compra ni una orden oficial.

## Referencias técnicas

- [Lectura, escritura y transacciones en Firebase Realtime Database](https://firebase.google.com/docs/database/web/read-and-write)
- [Gestión de usuarios en Firebase Authentication](https://firebase.google.com/docs/auth/web/manage-users)
- [Lucide para JavaScript](https://lucide.dev/guide/lucide)

Proyecto original: [DavQ2027/Q-parts](https://github.com/DavQ2027/Q-parts). Se trabajó a partir del ZIP suministrado.
