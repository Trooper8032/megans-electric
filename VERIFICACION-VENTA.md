# Lista de verificación de la VENTA: Apps Script vs v2

Corrección de Sandro: *"Se perdió la esencia de la venta. La admin no puede vender y ella también vende."*

Fuente revisada (solo lectura): `/workspace/megans_appscript/Code.gs` (`guardarVenta_`, `guardarDevolucion_`, `anularVenta_`, `cobrarPendiente_`, `armarCierre_`, `topProductos_`, `listaVendedores_`, `getPanel`, `getVenta`) e `Index.html` (pantallas Venta, Devolución, Panel, Cierre, Lista, Detalle; `abrirPicker`, `stepper`, `comprimir`, `compartirResumen`).

Leyenda: **Hecho** = funciona en v2 y tiene prueba · **Adaptado** = se cubre de otra forma, explicado · **Pendiente** = no se hizo; decisión de Sandro.

## A. Lo pedido explícitamente

| # | Bondad de venta | Apps Script | v2 | Estado | Prueba |
|---|---|---|---|---|---|
| 1 | La administradora y el co-administrador VENDEN igual que el vendedor | Todos ven "Nueva venta" | Permiso `vender` para los 3 roles en la capa de datos; misma pantalla | Hecho | Vitest `venta-roles` · E2E 3 roles × 2 vistas |
| 2 | Acceso directo destacado "Nueva venta" en inicio y menú, celular y escritorio | Botón redondo en inicio | Botón grande en el inicio de los 3 roles; "Nueva venta" destacado en el menú lateral y al centro de la barra del celular | Hecho | E2E (`.venta-hero-btn`, menú `destacado`) |
| 3 | Flujo rápido de 3 toques: producto, cantidad, Cobrar | Elegir producto, cantidad, Guardar | Toque 1 producto (lista o botón rápido) · toque 2 "+" · toque 3 "Cobrar S/ …" (Efectivo marcado por defecto, sin diálogo extra) | Hecho | E2E: 6 ventas en exactamente 3 toques |
| 4 | Buscador por nombre con lista de nombre y precio | Picker con nombre, categoría y stock, sin tildes | Buscador sin tildes por nombre y categoría; cada fila muestra nombre, precio y "Quedan N" | Hecho | E2E |
| 5 | Favoritos y productos más vendidos | Top 5 del día en el panel | Fila "Favoritos y más vendidos" arriba del catálogo: favoritos del usuario (estrella, máx. 12) + más vendidos de 30 días | Hecho | Vitest favoritos / más vendidos · E2E |
| 6 | Cantidad con + / − | Stepper | − / + en la fila del producto y en el carrito, y casilla editable | Hecho | E2E |
| 7 | Precio automático editable (descuento de mostrador), registrando el precio original | Precio se llena solo y se puede cambiar (no guardaba el original) | Precio de lista automático; "Precio c/u" editable; se guarda `precioLista`, `precioEditado` y una línea en el historial; muestra el descuento | Hecho | Vitest precio editado · E2E admin |
| 8 | Varios productos en el carrito | "Agregar producto" | Carrito con varias líneas, total en vivo | Hecho | E2E admin |
| 9 | Nombre del cliente | Obligatorio | **Obligatorio en toda venta** (decisión #32): pantalla, capa de datos y schema | Hecho | E2E 3 roles (sin nombre se rechaza) |
| 10 | Vendedor elegido de la lista, por defecto el usuario en sesión | Lista de la hoja Vendedores | Administración elige de la lista de usuarios activos (por defecto, quien está en sesión); el vendedor solo vende a su nombre; se guarda `registradoPor` | Hecho | Vitest vendedor de la lista · E2E admin |
| 11 | Medios Yape, Plin, Efectivo y Pendiente con botones grandes | Botones grandes | 4 botones grandes (radio accesible) | Hecho | E2E |
| 12 | Estado Cobrado o Pendiente | Columna EstadoCobro | `estadoCobro` Cobrado/Pendiente/Anulada, visible al cobrar, en la confirmación y en la guía; aviso "No entra a la caja hasta que se cobre" | Hecho | Vitest pendiente → cobrado |
| 13 | Producto "Otros" con "Qué se vendió" que no mueve stock | Sí | Sí ("Otros, no mueve stock") | Hecho | Vitest Otros · E2E admin |
| 14 | Foto de la venta (capturar o subir, comprimida) | Tomar o elegir, JPEG 1024 px | "Tomar foto" (cámara) o "Subir foto"; JPEG 900 px, máx. ~350 KB; se ve en el detalle de la venta y se puede cambiar después | Hecho | Vitest foto · E2E admin |
| 15 | Rechazo si no hay stock, con mensaje claro | "No hay stock suficiente de X. Hay N y pediste M." | Mismo mensaje, y el botón del producto se apaga cuando todo el stock está en el carrito | Hecho | Vitest rechazo sin stock |
| 16 | Devoluciones con motivo y reingreso de stock | Motivo, ¿reingresa? Sí/No, foto, la registra el vendedor | Desde la venta: producto, cantidad, motivo, reingreso (casilla), medio de devolución y foto. Solo la administradora (decisión #33) | Hecho | Vitest devolución · E2E admin |
| 17 | Anular solo la administradora, sin borrar | Solo Admin; Estado = Anulada; devuelve stock | Igual; pide motivo; la venta sigue guardada con su total e historial | Hecho | Vitest anulación · E2E (coadmin y vendedor no ven "Anular") |
| 18 | Cierre del día | Totales por medio, una fila por día, reabrir solo admin | Cierre por día y por vendedor con contado vs esperado; reabrir solo administradora con motivo | Hecho | Pruebas de caja existentes |

## B. Otras bondades encontradas en el Apps Script

| # | Bondad | v2 | Estado |
|---|---|---|---|
| 19 | No vender con el día cerrado (aviso al tocar "Nueva venta") | Botón apagado y aviso rojo si la caja está cerrada | Hecho |
| 20 | Total de la venta en vivo | Total en el carrito y en la barra fija de Cobrar | Hecho |
| 21 | Esperar a que la foto termine antes de guardar | "Preparando foto…" y Cobrar avisa que espere | Hecho |
| 22 | "Otros" sin control de stock en el buscador | Sección propia "Otros, no mueve stock" | Hecho |
| 23 | Cobrar un pendiente con botones Yape/Plin/Efectivo | Botones de color "Cobrar con Yape/Plin/Efectivo" en la guía, con monto (pago parcial), nro. de operación y foto del comprobante | Hecho |
| 24 | El vendedor ve sus ventas y devoluciones del día | "Mis ventas" y "Mi caja" | Hecho |
| 25 | Panel: ventas de hoy, efectivo/Yape/Plin de hoy, pendientes, top | Panel con gráficos + caja del día + pendientes | Hecho |
| 26 | Detalle de la venta con líneas, foto, vendedor y estado | Guía en pantalla con foto, estado y quién registró | Hecho |
| 27 | Compartir el resumen del cierre (texto) | "Compartir resumen por WhatsApp" y "Descargar resumen" (.txt) en Caja | Hecho |
| 28 | Anulada conserva el monto original | v2 no pone el total en 0: conserva total y marca Anulada (la caja la excluye) | Adaptado |
| 29 | Cantidades con decimales (p. ej., metros de cable) | Decisión de Sandro: enteras por defecto; opción "Permite decimales" por producto (desactivada en todos), hasta 3 decimales | Hecho (decidido) |
| 30 | Una foto por cada producto de la venta | Decisión de Sandro: foto opcional por línea además de la foto general; se puede agregar después desde la guía | Hecho (decidido) |
| 31 | Devolución "libre": sin elegir la venta, con monto escrito a mano y fecha pasada | Decisión de Sandro: se elimina; toda devolución pertenece a una venta identificada y solo la registra la administradora | Hecho (decidido) |

## C. Se mantiene todo lo nuevo de v2

Agregar productos a la venta del día con historial (quién/cuándo, también con precio editado) · guía de venta en PDF con logo, correlativo, firma, QR y WhatsApp · inventario y conteo semanal · tiendas externas con cuenta corriente · caja y conciliación · panel con gráficos · Excel, cuaderno y respaldo.

## Resumen

- **31 ítems revisados: 31 hechos (incluye 1 adaptado: #28; #9 pasó a obligatorio; #29, #30 y #31 cerrados con las decisiones de Sandro del 19-oct-2026).**
- El vendedor sigue sin ver costos ni utilidad y no puede anular.
- Pruebas (cierre 19-oct-2026): `npm test` 81/81; `scripts/e2e_venta.py` (3 roles venden en 3 toques en 390 y 1440 + escaneo por teclado, Yape por verificar, venta delegada y verificación en Conciliación); `scripts/e2e.py` (recorrido completo + Conciliación y Etiquetas en claro/oscuro); `scripts/e2e_decisiones.py` (guía con historial y PDF, delegada entre 2 pestañas, duplicados, etiquetas PDF, escaneo con cámara falsa). Todas con axe AA en 0 violaciones.

## D. Decisiones de Sandro (19-oct-2026)
| # | Decisión | Dónde | Estado | Prueba |
|---|---|---|---|---|
| 32 | Nombre del comprador obligatorio en toda venta | Vender, `crearVenta`, schema `NOT NULL` + `CHECK` | Hecho | Vitest + E2E |
| 33 | Solo la administradora registra devoluciones | permisos `devolver: SOLO_ADMIN`, política `dev_ins` | Hecho | Vitest + E2E (coadmin y vendedor no ven el botón) |
| 34 | Guía con historial completo (pagos parciales, agregados, devoluciones) y PDF con hoja de historial | Ventas › guía, `pdfGuia` | Hecho | E2E (texto del PDF) |
| 35 | Venta asignada a un vendedor aparece al instante en su app | `repoLocal.suscribir`, App.jsx, Realtime en schema | Hecho | Vitest + E2E con 2 pestañas |
| 36 | Pagos con nro. de operación (Yape/Plin), foto y verificación por la administradora; caja solo con verificados | `registrarPago`, `verificarPago`, `calcularCaja` | Hecho | Vitest + E2E |
| 37 | Conciliación diaria por medio, duplicados y pendientes sin cobrar | pantalla Conciliación | Hecho | Vitest + E2E |
| 38 | Colores por medio (Yape morado, Plin celeste, Efectivo verde, Pendiente rojo) con texto y AA | styles.css `.m-*`, `ChipMedio` | Hecho | axe AA |
| 39 | Etiquetas Code128 internas en PDF A4 | Etiquetas y escaneo, `pdfEtiquetas` | Hecho | E2E (PDF) + lectura del PDF impreso |
| 40 | Venta e ingreso por escaneo (lector USB/BT y cámara con decodificador local) | Selector, Escaner, `ingresarVarios` | Hecho | Vitest + E2E con cámara falsa |
