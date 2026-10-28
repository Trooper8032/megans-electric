# MEGANS ELECTRIC · Ventas, stock y caja

Sistema de punto de venta para una tienda de materiales eléctricos. Versión de demostración que funciona sin servidor: todo se guarda en el navegador. Hecho para una dueña que quiere ver todo claro: letra grande, pocas opciones, y cuaderno impreso para trabajar en paralelo mientras se acostumbra.

Desarrollado por Sandro Rivera Peñares · RIVERGREEN SOLUTIONS.

## Cómo probarlo
```
npm install
npm run dev          # desarrollo
npm run build && npm run preview   # versión final en http://127.0.0.1:4328
node scripts/preparar_ia.mjs   # una vez: copia/baja los modelos de IA a public/ia (~250 MB con Whisper small, no van al repositorio)
npm test             # 120 pruebas (Vitest)
python scripts/e2e.py         # recorrido por rol + axe + capturas (necesita Playwright y Chrome)
python scripts/e2e_venta.py   # venta en 3 toques por rol (admin, coadmin, vendedor1) en celular 390 y escritorio 1440 + capturas venta-*; incluye escaneo por teclado, venta delegada y verificación de pagos
python scripts/e2e_decisiones.py  # decisiones de Sandro: guía con historial, delegada entre pestañas, conciliación, etiquetas, escaneo (teclado y cámara falsa) + capturas nuevo-*
```

## Accesos de demostración
| Usuario | Contraseña | Qué puede hacer |
|---|---|---|
| admin | admin | **Vende** igual que un vendedor y además todo: anular, devolver (solo ella), verificar pagos y conciliar, asignar ventas a vendedores, etiquetas, precios, reabrir cajas, respaldo, ver costos y utilidad |
| coadmin | coadmin | **Vende**; ve y edita; etiquetas e ingreso por escaneo; no devuelve, no verifica pagos, no borra ni cambia precios de lista; ve costos y utilidad; no anula ni reabre cajas |
| vendedor1 | vendedor1 | Vende (sus Yape/Plin quedan Por verificar), ve al instante las ventas que le asignan y cierra su caja; no devuelve, no ve costos ni utilidad; no anula |
| vendedor2 | vendedor2 | Igual que vendedor1 |

Los permisos se aplican en la capa de datos y también en la interfaz (rutas y botones).

## Qué incluye
- **Venta para los 3 roles (administradora, co-administrador y vendedores):** botón grande **Nueva venta** en el inicio y destacado en el menú (celular y escritorio). Flujo rápido de **3 toques**: producto → cantidad (− / +) → **Cobrar** (Efectivo marcado por defecto). Buscador por nombre (sin importar tildes) con nombre y precio, botones de **favoritos** (cada usuario marca los suyos) y **más vendidos**, varios productos en el carrito, **precio editable** (descuento de mostrador; se guarda el precio de lista y queda en el historial), nombre del cliente (obligatorio en toda venta), vendedor elegido de la lista (por defecto quien está en sesión; el vendedor solo vende a su nombre), Yape/Plin/Efectivo/Pendiente con botones grandes y estado **Cobrado/Pendiente**, producto **Otros** con "¿Qué se vendió?" que no mueve stock, **foto de la venta** (tomar o subir, comprimida), rechazo claro si no hay stock. La lista completa contra el Apps Script está en `VERIFICACION-VENTA.md`.
- **Después de vender:** se busca una venta del día y se **agregan productos**; el historial dice quién, cuándo y qué. Pendiente → Cobrado con un botón por medio. Devoluciones con motivo, reingreso de stock opcional y foto, siempre de una venta identificada y solo por la administradora. **Anular solo la administradora**, sin borrar. Cierre del día con resumen para compartir por WhatsApp o descargar.
- **Guía de venta en PDF:** logo, serie y número, fecha, cliente, productos, total, medio de pago, firma y QR de verificación. Botón de WhatsApp con mensaje prellenado (lo envía la persona). Aclara que **no es guía de remisión SUNAT**.
- **Inventario:** descuento automático, alerta de stock bajo con mínimo por producto, movimientos con autor y fecha, **conteo semanal** de 10 a 15 productos sugeridos con diferencias en rojo y ajuste con motivo.
- **Tiendas externas:** hoja de envío en PDF, confirmación de recepción por producto con diferencias marcadas, cuenta corriente (enviado − pagado − devuelto = deuda) con pagos y devoluciones.
- **Caja:** cierre por día y por vendedor, esperado contra contado por Efectivo, Yape y Plin, pendientes por cobrar, diferencia en rojo. El cierre queda bloqueado; solo la administradora lo reabre y debe escribir el motivo.
- **Panel:** gráficos SVG propios (cada uno con su tabla alternativa): ventas por día y mes, utilidad, stock bajo, ranking, cuadre de caja, deudas por tienda y alertas.
- **Para la transición:** exportar a Excel todo (ventas, stock, movimientos, tiendas, caja), **cuaderno diario imprimible** por día con reporte de cuadre, y **respaldo en un clic** (JSON) con restauración validada.
- **Seguridad de uso:** sesión que vence por inactividad (20 min), bloqueo tras 5 intentos fallidos (5 min, sobrevive a recargar), validaciones, mensajes de error y estados vacíos, modo claro y oscuro, instalable como aplicación (PWA).
- **Datos de ejemplo:** catálogo real de 68 productos, unos 105 días de ventas de varios vendedores, 3 tiendas ficticias con envíos, pagos y devoluciones, conteos y cierres. Botón **Restablecer demostración** en Más.

### Decisiones de Sandro (19-oct-2026)
- **Venta:** nombre del comprador obligatorio; cantidades enteras salvo productos con "Permite decimales"; foto opcional por producto además de la general; devoluciones solo por la administradora y siempre de una venta.
- **Guía de venta con historial:** quién vendió/registró, productos y agregados posteriores, pagos parciales (medio, nro. de operación, comprobante, Por verificar/Verificado), devoluciones; el PDF incluye una hoja de historial.
- **Venta asignada:** la administradora elige el vendedor y la venta le aparece al instante (demo: entre pestañas del mismo navegador; producción: Supabase Realtime).
- **Pagos y conciliación:** Yape/Plin exigen nro. de operación; la administradora verifica; la caja cuadra solo con pagos verificados; pantalla "Conciliación de pagos" con duplicados y pendientes. Colores: Yape morado, Plin celeste, Efectivo verde, Pendiente rojo.
- **Códigos de barras:** "Etiquetas y escaneo" genera etiquetas Code128 internas (MEG + número) en PDF A4; en "Nueva venta" el buscador acepta el lector USB/Bluetooth (código + Enter) y el botón "Escanear" usa la cámara (BarcodeDetector o decodificador propio, sin CDN). El ingreso de mercadería también se hace escaneando.
- Pruebas: `npm test`, `scripts/e2e.py`, `scripts/e2e_venta.py` y `scripts/e2e_decisiones.py` (vista previa en el puerto 4328). Avance por etapas en `AVANCE-DECISIONES.md`.

## Voz e IA (todo en el equipo, gratis, sin enviar nada afuera)
- **Venta por voz** (Nueva venta): llena el carrito; quien vende revisa y toca Cobrar. Nunca cobra sola. Lo dudoso pide «¿Cuál es?» y lo que no está en el catálogo se marca.
- **Ingreso por voz o foto de factura** (Inventario → Ingreso por voz o foto): tabla editable, confirmación y queda en movimientos con el nombre de quien ingresó. Solo admin y coadmin; el costo solo lo ve y actualiza la administradora.
- **Asistente de voz** (botón del micrófono): preguntas rápidas con los datos que cada rol puede ver, ir a pantallas, buscar ventas y cobrar pendientes con confirmación. Anular, devolver, borrar o restaurar no se hacen por voz.
- **Revisar captura** de Yape/Plin en Conciliación: solo sugiere (Cuadra / Revisar). Nunca verifica sola.
- **Mejorar foto**: quita el fondo y pone un color (fotos de venta y de líneas).
- Motores: Whisper base q8 (transformers.js, Apache-2.0), tesseract.js (Apache-2.0), U-2-Netp en onnxruntime-web (MIT/Apache). Se cargan solo al usarlos y se sirven desde `/ia/` del mismo sitio.
- Pruebas: `node scripts/eval_voz.mjs` (precisión con audios sintéticos) y `python scripts/e2e_voz.py` (capturas `capturas/voz-*`). Los audios y muestras están fuera del repositorio.

## Datos de origen
Se leyó solo la carpeta `megans_appscript` (sin modificarla). El catálogo y sus categorías son reales; **los precios, costos, stock y movimientos son de ejemplo inventados**, porque en la base original estaban en cero. Las tiendas son ficticias.

## Estructura
- `src/lib/dominio.js`: reglas del negocio (ventas, stock, conteo, tiendas, caja) y permisos por rol.
- `src/data/`: capa de datos intercambiable (`repoLocal` activo; `repoSupabase` preparado).
- `src/vistas/`, `src/components/`: pantallas y gráficos.
- `supabase/schema.sql`: esquema con RLS por rol y buckets privados; `supabase/README-MIGRACION.md`: pasos para migrar. **No se creó ningún proyecto Supabase.**
- `.env.example`: variables vacías, sin claves.
- `capturas/`: capturas de escritorio (1440) y celular (390) de cada pantalla clave.

## Alcance y límites
- **Solo local.** Estos cambios no se publicaron desde aquí; la publicación se coordina aparte.
- **Seguridad real requiere servidor.** Aquí las claves y permisos viven en el navegador: sirven para la demostración y para ordenar el trabajo, no frenan a alguien con acceso a la computadora. Con Supabase y RLS (ver `supabase/`) se vuelven reales.
- **Almacenamiento:** localStorage permite unos 5 MB por navegador; la demo ocupa una parte. Hacer respaldo seguido. Datos de un navegador no se ven desde otro.
- **WhatsApp automático** no existe: el botón abre el chat con el mensaje listo y la persona lo envía. El envío automático necesita la API oficial y un servidor.
- **Notificaciones push** requieren servidor.
- **SUNAT:** la guía de venta es un comprobante interno, no es guía de remisión ni factura electrónica. Eso requiere un proveedor autorizado.
- **Fotos de venta:** se comprimen a JPEG (máx. ~350 KB) y en la demo ocupan espacio de localStorage; muchas fotos llenan los ~5 MB. En la versión real van al bucket privado `fotos` de Supabase.
- **Cantidades enteras:** el catálogo es por unidad; cada producto tiene "Permite decimales" (p. ej., cable por metro), hoy desactivado en todos.
- **Tiempo real:** en la demo la venta asignada llega solo entre pestañas del mismo navegador (evento storage + sondeo de 3 s). Entre celulares distintos necesita Supabase Realtime, que quedó preparado en el esquema y en `repoSupabase` pero no se probó contra un proyecto real.
- **Cámara:** el escaneo con cámara se probó con una cámara falsa de Chrome (video con un código real); falta probarlo en un celular físico. El lector USB/Bluetooth se probó como teclado (código + Enter), no con un lector físico.
- **Supabase:** `schema.sql` solo se validó en sintaxis (pglast); no se ejecutó contra una base real.
- Las firmas y el QR de verificación son internos: el QR trae un código que cambia si la venta cambia.
