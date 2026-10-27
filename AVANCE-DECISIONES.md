# Avance de las decisiones de Sandro (19 oct 2026)

Respaldo previo: /workspace/_respaldo-megans-v2-pre-decisiones (tar sin node_modules ni dist).

## Etapa A — HECHA (npm test 68/68, build OK, e2e.py 0 fallos axe 0 en 38, e2e_venta.py 0 fallos axe 0 en 22)
1. Cantidades enteras por defecto; cada producto tiene "Permite decimales" (Inventario) y unidad de venta. Desactivado en todos los productos. Validado en dominio (`cantidadDe`, máx. 3 decimales) y en la pantalla.
2. Foto opcional por cada línea de producto, además de la foto general de la venta; también se agrega después desde la guía (`guardarFotoLinea`).
3. Toda devolución pertenece a una venta identificada (ya era así en v2; no existe devolución libre).
4. SOLO la administradora registra devoluciones (`devolver: SOLO_ADMIN` en permisos y en la capa de datos; el botón ya no aparece a coadmin ni vendedores).
5. El nombre del comprador es obligatorio en TODAS las ventas: pantalla, capa de datos (`textoLimpio`, mín. 2) y schema (`cliente text not null check (char_length(btrim(cliente)) >= 2)`, sin valor por defecto).
Schema también: productos.decimales, productos.codigo unique, stock y cantidades `numeric(12,3)`, venta_items.foto_ruta, política dev_ins solo admin. pglast: OK, 110 sentencias.
Migración de datos v3→v4: decimales false, codigo '', foto de línea null, cliente corto → "Cliente de mostrador".

## Etapa B — HECHA (código + pruebas)
Guía de venta automática con historial completo: quién vendió / registró, fecha y hora, productos, agregados posteriores (quién y cuándo), estado Cobrado/Parcial/Pendiente, pagos parciales con medio, nro. de operación, foto de comprobante y estado de verificación, devoluciones. Se agregan productos, fotos de línea y fotos de comprobante después. El PDF de la guía trae una 2.ª hoja "Historial de la guía" (pagos, devoluciones, cambios).

## Etapa C — HECHA
La administradora (y el coadmin, que ya podía elegir vendedor) crea la venta y la asigna; en la app del vendedor aparece al instante con aviso "Nueva venta asignada" (evento storage entre pestañas + sondeo cada 3 s en repoLocal.suscribir). repoLocal.cargar() relee si otra pestaña guardó, para no pisar datos. Supabase: repoSupabase.suscribir con Realtime y `alter publication supabase_realtime add table ventas, venta_items, pagos`.

## Etapa D — HECHA
venta.pagos[] {medio, monto, operacion, foto, estado, quien, caja, fecha, verificadoPor, duplicado, inicial}. Operación obligatoria en Yape/Plin (pantalla, dominio y CHECK en schema). Efectivo y los pagos registrados por la administradora quedan Verificado; Yape/Plin de vendedores y coadmin quedan Por verificar hasta que la administradora los verifica (verificarPago, SOLO_ADMIN). calcularCaja cuenta solo verificados y muestra "por verificar" aparte. Pantalla Conciliación (solo admin): por medio esperado vs verificado, pagos por verificar con botón Verificar, operaciones repetidas, pendientes sin cobrar con antigüedad. Colores: Yape morado, Plin celeste, Efectivo verde, Pendiente rojo, con texto y contraste AA. Migración v4→v5: pagos históricos como Verificado. Schema: tabla pagos + RLS + trigger + vista conciliacion_diaria.

## Etapa E — HECHA
Code128 propio (src/lib/codigoBarras.js): codificador + decodificador local (prueba cruzada con python-barcode). Código interno MEG+5 dígitos por producto. Pantalla "Etiquetas y escaneo" (admin/coadmin): PDF A4 24 por hoja con nombre, precio y código; ingreso de mercadería escaneando (ingresarVarios). Nueva venta: el buscador acepta el código + Enter (lector USB/BT) y botón Escanear con cámara (BarcodeDetector si existe; si no, decodificador local). CSP: se agregó `media-src 'self' blob:`; Permissions-Policy ya permitía camera=(self). Nada viene de CDN.

## Estado de pruebas — CERRADO (19 oct 2026)
- `npm test`: 81/81 (9 archivos). `npm run build`: OK.
- `scripts/e2e.py`: 0 fallos, 0 errores de consola, 0 desbordes, axe AA 0 violaciones en 46 pantallas (incluye Conciliación y Etiquetas en claro y oscuro, escaneo por teclado en ingreso, coadmin sin conciliación ni devoluciones).
- `scripts/e2e_venta.py`: 0 fallos, axe 0 en 26 pantallas. Admin, coadmin y vendedor1 venden en 3 toques (390 y 1440); cliente obligatorio; devolución solo admin; nuevo `flujos_nuevos`: escaneo por teclado (código + Enter), Yape exige nro. de operación y queda Por verificar, venta delegada a Vendedor 1, verificación desde Conciliación.
- `scripts/e2e_decisiones.py`: 0 fallos, axe 0 en 16 pantallas. Delegada entre 2 pestañas, guía con historial + PDF, operación repetida, caja solo verificados, etiquetas PDF, ingreso por escaneo, cámara falsa de Chrome con código real.
- Corrección en el cierre: contraste del código bajo la vista previa de etiquetas en modo oscuro (`.etq-prev small{color:#111}`).
- Capturas nuevas: `capturas/nuevo-{celular,escritorio}-01..08` (+ 01b, 03b, 04b, 06b) y `nuevo-guia-pdf-historial-2.png`, `nuevo-etiquetas-pdf-1.png`. Las `decision-*` anteriores quedan como referencia.
- Búsqueda sin distinguir mayúsculas del nombre de la ciudad fuera de node_modules: 0 coincidencias.
- Límites: cámara probada solo con cámara falsa (falta celular físico y lector USB/BT físico); tiempo real de la demo solo entre pestañas del mismo navegador; Realtime y `schema.sql` de Supabase solo validados en sintaxis (pglast), sin proyecto real; nada publicado.

## Voz e IA — HECHA en rama local `voz-ia` (27 oct 2026, sin publicar)
- `npm test`: 120/120. Build OK. `scripts/e2e_voz.py` (CSP real): 0 fallos, 0 desbordes, axe 0 en 12 pantallas (390 y 1440).
- Precisión con 50 audios sintéticos (25 frases × 2 voces): 39/50 entendidas por completo. Voz mexicana 22/25: ventas 6/8, ingresos 3/4, preguntas 8/8, comandos 5/5. Voz española 17/25: ventas 5/8, ingresos 2/4, preguntas 6/8, comandos 4/5. Lo fallado queda como «duda» para elegir, no se agrega solo.
- Tiempos en este equipo: primera carga de voz ~9 s; cada frase ~6 s; foto de factura ~2 s (7 de 8 filas emparejadas, la 8.ª no está en el catálogo y se marcó); quitar fondo ~3 s.
- Corregido: la demo no cargaba los martes (stock inicial insuficiente de «Caja de 24 polos»).
- Pendiente: los e2e antiguos (`e2e.py`, `e2e_venta.py`, `e2e_decisiones.py`) buscan los botones `.rapido` del selector anterior; el selector ya era buscador antes de esta rama. Hay que actualizarlos.
