// Reglas del negocio. Funciones puras: reciben la base completa y devuelven una copia nueva.
// Los permisos se aplican AQUÍ (capa de datos), además de ocultarse en la interfaz. Nada se borra.
import { config, MEDIOS, MEDIOS_CAJA, MOTIVOS_DEVOLUCION } from '../config/app.config.js'
import { puede } from './permisos.js'
import { codigoInterno } from './codigoBarras.js'
import { r2, soles } from './dinero.js'
import { fechaISO, horaHM, esFechaISO, diasEntre, semanaDe } from './fechas.js'

export class ErrorApp extends Error { constructor(m) { super(m); this.name = 'ErrorApp' } }
export const ID_OTROS = 'PRD-999'
let copiar = x => structuredClone(x)
// Solo para generar la demostración (muchas operaciones seguidas): trabaja sobre la misma base sin copiarla.
export const modoRapido = activo => { copiar = activo ? x => x : x => structuredClone(x) }
export const clon = x => copiar(x)
const falla = m => { throw new ErrorApp(m) }
export const FOTO_MAX = 350000 // caracteres del dataURL (foto comprimida en el celular)
export const fotoValida = f => typeof f === 'string' && /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(f) && f.length <= FOTO_MAX
const ahoraISO = a => a.toISOString()

export function actor(db, sesion) {
  const u = sesion && db.usuarios.find(x => x.id === sesion.id && x.activo !== false)
  if (!u) falla('Tu sesión no es válida. Ingresa de nuevo.')
  return u
}
export function exigir(db, sesion, accion) {
  const u = actor(db, sesion)
  if (!puede(u.rol, accion)) falla('Tu usuario no tiene permiso para hacer esto.')
  return u
}
const sig = (db, clave) => { db.contadores[clave] = (db.contadores[clave] || 0) + 1; return db.contadores[clave] }
const pad = (n, l = 6) => String(n).padStart(l, '0')
const nombreDe = (db, id) => db.usuarios.find(u => u.id === id)?.nombre || '—'
const prod = (db, id) => db.productos.find(p => p.id === id)
const textoLimpio = (t, max = 120) => String(t ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const entero = n => Number.isInteger(Number(n)) && Number(n) > 0 ? Number(n) : null
// Cantidad de una línea: entera, o con hasta 3 decimales si el producto permite decimales (ej. metro).
export const cantidadDe = (p, n) => {
  const x = Number(String(n ?? '').replace(',', '.'))
  if (!(x > 0) || x > 9999) return null
  const r = Math.round(x * 1000) / 1000
  if (Math.abs(x - r) > 1e-9) return null
  return (p && p.decimales) || Math.abs(r - Math.round(r)) < 1e-9 ? r : null
}

export function mover(db, { cuando, productoId, tipo, cantidad, motivo = '', quien, ref = '' }) {
  const p = prod(db, productoId)
  if (!p || productoId === ID_OTROS) return
  p.stock += cantidad
  db.movimientos.push({ id: 'MOV-' + pad(sig(db, 'mov')), cuando, productoId, tipo, cantidad, stockDespues: p.stock, motivo, quien, ref })
}

// ---------- Caja: bloqueos ----------
export const cierreDe = (db, fecha, vendedorId = null) => db.cierres.find(c => c.fecha === fecha && (c.vendedorId || null) === (vendedorId || null))
export const cajaBloqueada = (db, fecha, vendedorId) => [cierreDe(db, fecha, null), cierreDe(db, fecha, vendedorId)].some(c => c && c.estado === 'Cerrada')
function exigirCajaAbierta(db, fecha, vendedorId) {
  if (cajaBloqueada(db, fecha, vendedorId)) falla('La caja de ese día ya está cerrada. Solo la administradora puede reabrirla.')
}

// ---------- Ventas ----------
function armarLineas(db, items, cuando, quien, nuevas = true) {
  if (!Array.isArray(items) || !items.length) falla('Agrega al menos un producto.')
  const acumulado = {}
  const lineas = items.map(it => {
    const p = prod(db, it.productoId)
    if (!p || p.activo === false) falla('Hay un producto que ya no existe o está desactivado.')
    const cantidad = cantidadDe(p, it.cantidad)
    if (!cantidad) falla(p.decimales ? `La cantidad de "${p.nombre}" debe ser mayor que cero (hasta 3 decimales).` : `La cantidad de "${p.nombre}" debe ser un número entero mayor que cero.`)
    let precio = p.precio, detalle = '', precioLista = p.precio
    if (p.id === ID_OTROS) {
      detalle = textoLimpio(it.detalle, 80); precio = r2(it.precio); precioLista = precio
      if (!detalle) falla('En "Otros" escribe qué se vendió.')
      if (!(precio > 0)) falla('En "Otros" escribe el precio.')
    } else {
      if (!(p.precio > 0)) falla(`"${p.nombre}" todavía no tiene precio. La administradora debe fijarlo.`)
      // Precio de mostrador: se puede editar (descuento) y queda guardado el precio original de lista.
      if (it.precio !== undefined && it.precio !== null && it.precio !== '') {
        const pe = r2(String(it.precio).replace(',', '.'))
        if (!(pe > 0) || pe > 1000000) falla(`El precio de "${p.nombre}" no es válido.`)
        precio = pe
      }
      acumulado[p.id] = (acumulado[p.id] || 0) + cantidad
      if (acumulado[p.id] > p.stock) falla(`No hay stock suficiente de "${p.nombre}". Hay ${p.stock} y pediste ${acumulado[p.id]}.`)
    }
    const foto = it.foto || null
    if (foto && !fotoValida(foto)) falla(`La foto de "${p.nombre}" no es válida o pesa demasiado. Toma otra.`)
    return { productoId: p.id, nombre: detalle ? `Otros: ${detalle}` : p.nombre, cantidad, precio, precioLista, precioEditado: p.id !== ID_OTROS && precio !== precioLista, costo: p.id === ID_OTROS ? 0 : p.costo, foto, agregadoPor: nuevas ? quien : null, agregadoEn: nuevas ? cuando : null }
  })
  return lineas
}
const totalDe = lineas => r2(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0))
export const cantidadDevuelta = (db, ventaId, productoId) => db.devoluciones.filter(d => d.ventaId === ventaId && d.productoId === productoId).reduce((s, d) => s + d.cantidad, 0)

// ---------- Pagos (decisión de Sandro): cada venta guarda sus pagos, parciales o totales ----------
// pago = { id, medio, monto, operacion, foto, estado: 'Por verificar'|'Verificado', quien, caja, cuando, fecha, verificadoPor, verificadoEn, duplicado }
// Efectivo: se verifica al contar la caja (queda Verificado). Yape/Plin: nro. de operación obligatorio y la administradora lo verifica.
export const MEDIOS_CON_OPERACION = ['Yape', 'Plin']
export const pagosDe = v => (v.pagos || [])
export const pagadoDe = v => r2(pagosDe(v).reduce((s, p) => s + p.monto, 0))
export const saldoDe = v => r2(Math.max(0, v.total - pagadoDe(v)))
export const estadoCobro = v => v.estado !== 'Activa' ? 'Anulada' : saldoDe(v) <= 0 ? 'Cobrado' : pagadoDe(v) > 0 ? 'Parcial' : 'Pendiente'
export const operacionDuplicada = (db, medio, operacion, exceptoId = null) => !!operacion && db.ventas.some(v => v.estado === 'Activa' && pagosDe(v).some(p => p.id !== exceptoId && p.medio === medio && p.operacion === operacion))
function nuevoPago(d, u, v, { medio, monto, operacion, foto } = {}, ahora, caja) {
  if (!MEDIOS_CAJA.includes(medio)) falla('Elige con qué pagó: Efectivo, Yape o Plin.')
  const m = aMontoSeguro(monto); if (m === null || m <= 0) falla('El monto del pago debe ser mayor que cero.')
  if (m > saldoDe(v) + 0.001) falla(`El pago no puede ser mayor que lo que falta cobrar (${soles(saldoDe(v))}).`)
  const op = String(operacion ?? '').replace(/\s/g, '').slice(0, 20)
  if (MEDIOS_CON_OPERACION.includes(medio) && !/^[0-9A-Za-z-]{4,20}$/.test(op)) falla(`Escribe el número de operación de ${medio} (obligatorio, mínimo 4 caracteres).`)
  if (foto && !fotoValida(foto)) falla('La foto del comprobante no es válida o pesa demasiado. Toma otra.')
  const cuando = ahoraISO(ahora), fecha = fechaISO(ahora)
  const autoVerif = medio === 'Efectivo' || u.rol === 'admin'
  const pago = { id: 'PAG-' + pad(sig(d, 'pago'), 5), medio, monto: m, operacion: op, foto: foto || null, estado: autoVerif ? 'Verificado' : 'Por verificar', quien: u.id, caja: caja || u.id, cuando, fecha, verificadoPor: autoVerif ? u.id : null, verificadoEn: autoVerif ? cuando : null, duplicado: operacionDuplicada(d, medio, op) }
  v.pagos = [...pagosDe(v), pago]
  v.estadoCobro = estadoCobro(v)
  if (v.estadoCobro === 'Cobrado' && v.medio === 'Pendiente' && !v.cobro) v.cobro = { medio, fecha, quien: u.id, cuando, monto: v.total }
  v.historial.push({ cuando, quien: u.id, que: `Pago de ${soles(m)} con ${medio}${op ? ` (operación ${op})` : ''}${pago.estado === 'Por verificar' ? ', por verificar' : ''}. ${v.estadoCobro === 'Cobrado' ? 'Venta cobrada.' : `Falta ${soles(saldoDe(v))}.`}${pago.duplicado ? ' ⚠ Número de operación repetido.' : ''}` })
  return pago
}
const aMontoSeguro = x => { const n = typeof x === 'number' ? x : Number(String(x ?? '').replace(',', '.')); return Number.isFinite(n) ? r2(n) : null }
export function registrarPago(db, sesion, ventaId, datos = {}, ahora = new Date()) {
  const u = exigir(db, sesion, 'registrarPago'), d = clon(db), v = d.ventas.find(x => x.id === ventaId)
  if (!v) falla('No se encontró esa venta.')
  if (u.rol === 'vendedor' && v.vendedorId !== u.id) falla('Solo puedes cobrar tus propias ventas.')
  if (v.estado !== 'Activa') falla('Esa venta está anulada.')
  if (saldoDe(v) <= 0) falla('Esta venta ya fue cobrada.')
  exigirCajaAbierta(d, fechaISO(ahora), u.id)
  const pago = nuevoPago(d, u, v, datos, ahora, u.rol === 'vendedor' ? u.id : v.vendedorId)
  return { db: d, venta: v, pago }
}
export function verificarPago(db, sesion, ventaId, pagoId, ahora = new Date()) {
  const u = exigir(db, sesion, 'verificarPago'), d = clon(db), v = d.ventas.find(x => x.id === ventaId)
  const p = v && pagosDe(v).find(x => x.id === pagoId); if (!p) falla('No se encontró ese pago.')
  if (p.estado === 'Verificado') falla('Ese pago ya estaba verificado.')
  const cuando = ahoraISO(ahora); p.estado = 'Verificado'; p.verificadoPor = u.id; p.verificadoEn = cuando
  v.historial.push({ cuando, quien: u.id, que: `Verificó el pago de ${soles(p.monto)} con ${p.medio}${p.operacion ? ` (operación ${p.operacion})` : ''}.` })
  return { db: d, venta: v, pago: p }
}
export function guardarFotoPago(db, sesion, ventaId, pagoId, foto, ahora = new Date()) {
  const u = exigir(db, sesion, 'registrarPago'), d = clon(db), v = d.ventas.find(x => x.id === ventaId)
  const p = v && pagosDe(v).find(x => x.id === pagoId); if (!p) falla('No se encontró ese pago.')
  if (u.rol === 'vendedor' && v.vendedorId !== u.id) falla('Solo puedes cambiar tus propias ventas.')
  if (foto !== null && !fotoValida(foto)) falla('La foto del comprobante no es válida o pesa demasiado. Toma otra.')
  p.foto = foto; v.historial.push({ cuando: ahoraISO(ahora), quien: u.id, que: foto ? `Guardó la foto del comprobante de ${p.medio}.` : `Quitó la foto del comprobante de ${p.medio}.` })
  return { db: d, venta: v }
}
// Conciliación diaria por medio de pago: esperado (registrado) vs verificado, duplicados y pendientes sin cobrar.
export function conciliacion(db, fecha) {
  const filas = Object.fromEntries(MEDIOS_CAJA.map(m => [m, { medio: m, esperado: 0, verificado: 0, porVerificar: 0, n: 0 }])), pagos = []
  for (const v of db.ventas) if (v.estado === 'Activa') for (const p of pagosDe(v)) if (p.fecha === fecha) {
    const f = filas[p.medio]; f.esperado += p.monto; f.n++; if (p.estado === 'Verificado') f.verificado += p.monto; else f.porVerificar += p.monto
    pagos.push({ ...p, ventaId: v.id, cliente: v.cliente, vendedorId: v.vendedorId })
  }
  Object.values(filas).forEach(f => { f.esperado = r2(f.esperado); f.verificado = r2(f.verificado); f.porVerificar = r2(f.porVerificar) })
  const claves = {}; for (const v of db.ventas) if (v.estado === 'Activa') for (const p of pagosDe(v)) if (p.operacion) { const k = p.medio + '|' + p.operacion; (claves[k] = claves[k] || []).push({ ...p, ventaId: v.id }) }
  const duplicados = Object.values(claves).filter(g => g.length > 1)
  const pendientes = db.ventas.filter(v => v.estado === 'Activa' && saldoDe(v) > 0 && v.fecha <= fecha).map(v => ({ id: v.id, cliente: v.cliente, fecha: v.fecha, vendedorId: v.vendedorId, saldo: saldoDe(v), total: v.total, dias: Math.round((new Date(fecha + 'T12:00:00') - new Date(v.fecha + 'T12:00:00')) / 864e5) })).sort((a, b) => b.dias - a.dias)
  return { fecha, filas: Object.values(filas), pagos, porVerificar: pagos.filter(p => p.estado === 'Por verificar'), duplicados, pendientes }
}
// Quién puede figurar como vendedor de una venta: el vendedor solo a sí mismo; administración elige de la lista.
export const vendedoresPara = (db, u) => puede(u.rol, 'elegirVendedor') ? db.usuarios.filter(x => x.activo !== false) : db.usuarios.filter(x => x.id === u.id)
export function crearVenta(db, sesion, { cliente, telefono, medio, items, notas, vendedorId, foto, operacion, monto, fotoPago } = {}, ahora = new Date()) {
  const u = exigir(db, sesion, 'vender'), d = clon(db), fecha = fechaISO(ahora)
  if (!MEDIOS.includes(medio)) falla('Elige cómo pagó el cliente: Efectivo, Yape, Plin o Pendiente.')
  const vid = vendedorId || u.id
  if (vid !== u.id) {
    if (!puede(u.rol, 'elegirVendedor')) falla('Solo puedes registrar ventas a tu nombre.')
    if (!d.usuarios.some(x => x.id === vid && x.activo !== false)) falla('Elige un vendedor de la lista.')
  }
  exigirCajaAbierta(d, fecha, vid)
  const cuando = ahoraISO(ahora), lineas = armarLineas(d, items, cuando, u.id)
  const tel = String(telefono ?? '').replace(/\D/g, '')
  if (tel && !/^(51)?9\d{8}$/.test(tel)) falla('El celular del cliente debe tener 9 dígitos y empezar con 9.')
  if (foto && !fotoValida(foto)) falla('La foto no es válida o pesa demasiado. Toma otra.')
  const numero = sig(d, 'guia')
  const editadas = lineas.filter(l => l.precioEditado)
  const venta = {
    id: `${config.serieGuia}-${pad(numero)}`, serie: config.serieGuia, numero, fecha, hora: horaHM(ahora), creadoEn: cuando,
    cliente: (() => { const c = textoLimpio(cliente, 60); if (c.length < 2) falla('Escribe el nombre del cliente (mínimo 2 letras).'); return c })(), telefono: tel, vendedorId: vid, registradoPor: u.id, medio, estadoCobro: medio === 'Pendiente' ? 'Pendiente' : 'Cobrado', estado: 'Activa',
    notas: textoLimpio(notas, 160), items: lineas, total: totalDe(lineas), version: 1, foto: foto || null, cobro: null, anulacion: null, pagos: [],
    historial: [{ cuando, quien: u.id, que: `Registró la venta por ${soles(totalDe(lineas))} (${medio})${vid !== u.id ? ` a nombre de ${nombreDe(d, vid)}` : ''}.` },
      ...editadas.map(l => ({ cuando, quien: u.id, que: `Precio de mostrador en ${l.nombre}: ${soles(l.precio)} (lista ${soles(l.precioLista)}).` }))]
  }
  if (medio !== 'Pendiente') { nuevoPago(d, u, venta, { medio, monto: monto ?? venta.total, operacion, foto: fotoPago }, ahora, vid).inicial = true; venta.estadoCobro = estadoCobro(venta) }
  lineas.forEach(l => mover(d, { cuando, productoId: l.productoId, tipo: 'venta', cantidad: -l.cantidad, quien: u.id, ref: venta.id }))
  d.ventas.push(venta)
  return { db: d, venta }
}

// Favoritos de cada usuario (aparecen primero en "Nueva venta"). Máximo 12.
export const favoritosDe = (db, usuarioId) => (db.favoritos && db.favoritos[usuarioId]) || []
export function marcarFavorito(db, sesion, productoId) {
  const u = exigir(db, sesion, 'vender'), d = clon(db), p = prod(d, productoId)
  if (!p || p.id === ID_OTROS) falla('Ese producto no existe.')
  d.favoritos = d.favoritos || {}
  const act = d.favoritos[u.id] || []
  if (act.includes(p.id)) d.favoritos[u.id] = act.filter(x => x !== p.id)
  else { if (act.length >= 12) falla('Ya tienes 12 favoritos. Quita uno para agregar otro.'); d.favoritos[u.id] = [...act, p.id] }
  return { db: d, producto: p }
}
// Productos más vendidos (por unidades) en los últimos días, para los botones rápidos.
export function masVendidos(db, hoy, dias = 30, n = 8) {
  const desde = new Date(hoy + 'T00:00:00'); desde.setDate(desde.getDate() - dias); const lim = fechaISO(desde), cuenta = {}
  for (const v of db.ventas) if (v.estado === 'Activa' && v.fecha > lim && v.fecha <= hoy) for (const l of v.items) if (l.productoId !== ID_OTROS) cuenta[l.productoId] = (cuenta[l.productoId] || 0) + l.cantidad
  return Object.entries(cuenta).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id)
}

// Foto opcional de una línea de la venta (además de la foto general).
export function guardarFotoLinea(db, sesion, ventaId, indice, foto, ahora = new Date()) {
  const u = exigir(db, sesion, 'vender'), d = clon(db), v = d.ventas.find(x => x.id === ventaId)
  if (!v) falla('No se encontró esa venta.')
  if (u.rol === 'vendedor' && v.vendedorId !== u.id) falla('Solo puedes cambiar la foto de tus propias ventas.')
  const l = v.items[indice]; if (!l) falla('No se encontró esa línea de la venta.')
  if (foto !== null && !fotoValida(foto)) falla('La foto no es válida o pesa demasiado. Toma otra.')
  l.foto = foto
  v.historial.push({ cuando: ahoraISO(ahora), quien: u.id, que: foto ? `Guardó la foto de ${l.cantidad} × ${l.nombre}.` : `Quitó la foto de ${l.nombre}.` })
  return { db: d, venta: v }
}

export function guardarFotoVenta(db, sesion, ventaId, foto, ahora = new Date()) {
  const u = exigir(db, sesion, 'vender'), d = clon(db), v = d.ventas.find(x => x.id === ventaId)
  if (!v) falla('No se encontró esa venta.')
  if (u.rol === 'vendedor' && v.vendedorId !== u.id) falla('Solo puedes cambiar la foto de tus propias ventas.')
  if (foto !== null && !fotoValida(foto)) falla('La foto no es válida o pesa demasiado. Toma otra.')
  v.foto = foto
  v.historial.push({ cuando: ahoraISO(ahora), quien: u.id, que: foto ? 'Guardó la foto de la venta.' : 'Quitó la foto de la venta.' })
  return { db: d, venta: v }
}

function ventaEditable(d, u, ventaId, ahora, { propiaSolo = true } = {}) {
  const v = d.ventas.find(x => x.id === ventaId)
  if (!v) falla('No se encontró esa venta.')
  if (v.estado !== 'Activa') falla('Esa venta está anulada y ya no se puede cambiar.')
  if (u.rol === 'vendedor') {
    if (v.vendedorId !== u.id) falla('Solo puedes cambiar tus propias ventas.')
    if (v.fecha !== fechaISO(ahora)) falla('Los vendedores solo pueden agregar productos a ventas de hoy.')
  }
  exigirCajaAbierta(d, v.fecha, v.vendedorId)
  return v
}

export function agregarAVenta(db, sesion, ventaId, items, ahora = new Date()) {
  const u = exigir(db, sesion, 'agregarAVenta'), d = clon(db), v = ventaEditable(d, u, ventaId, ahora)
  const cuando = ahoraISO(ahora), lineas = armarLineas(d, items, cuando, u.id)
  v.items.push(...lineas); v.total = totalDe(v.items); v.version += 1; v.estadoCobro = estadoCobro(v)
  const resumen = lineas.map(l => `${l.cantidad} × ${l.nombre}`).join(', ')
  v.historial.push({ cuando, quien: u.id, que: `Agregó ${resumen}. Total nuevo: ${soles(v.total)}.` })
  lineas.forEach(l => mover(d, { cuando, productoId: l.productoId, tipo: 'agregado', cantidad: -l.cantidad, quien: u.id, ref: v.id }))
  return { db: d, venta: v }
}

// Cobra todo lo que falta de una venta (pendiente o con pago parcial).
export function cobrarPendiente(db, sesion, ventaId, medio, ahora = new Date(), extra = {}) {
  exigir(db, sesion, 'cobrarPendiente')
  const v = db.ventas.find(x => x.id === ventaId); if (!v) falla('No se encontró esa venta.')
  if (v.estado !== 'Activa') falla('Esta venta no está pendiente de cobro.')
  if (saldoDe(v) <= 0) falla('Esta venta ya fue cobrada.')
  return registrarPago(db, sesion, ventaId, { ...extra, medio, monto: saldoDe(v) }, ahora)
}

export function anularVenta(db, sesion, ventaId, motivo, ahora = new Date()) {
  const u = exigir(db, sesion, 'anular'), d = clon(db), v = d.ventas.find(x => x.id === ventaId)
  if (!v) falla('No se encontró esa venta.')
  if (v.estado !== 'Activa') falla('Esa venta ya estaba anulada.')
  const m = textoLimpio(motivo, 160); if (m.length < 5) falla('Escribe el motivo de la anulación (mínimo 5 letras).')
  if (d.devoluciones.some(x => x.ventaId === v.id)) falla('Esta venta ya tiene devoluciones registradas, por eso no se puede anular.')
  exigirCajaAbierta(d, v.fecha, v.vendedorId)
  if (cobroEnCajaCerrada(d, v)) falla('El cobro de esta venta ya está en una caja cerrada. Reabre esa caja primero.')
  const cuando = ahoraISO(ahora)
  v.estado = 'Anulada'; v.estadoCobro = 'Anulada'; v.anulacion = { cuando, quien: u.id, motivo: m }
  v.historial.push({ cuando, quien: u.id, que: `Anuló la venta. Motivo: ${m}.` })
  const porProducto = {}; v.items.forEach(l => { porProducto[l.productoId] = (porProducto[l.productoId] || 0) + l.cantidad })
  Object.entries(porProducto).forEach(([pid, c]) => { const dev = d.devoluciones.filter(x => x.ventaId === v.id && x.productoId === pid).reduce((s, x) => s + x.cantidad, 0); if (c - dev > 0) mover(d, { cuando, productoId: pid, tipo: 'anulacion', cantidad: c - dev, quien: u.id, ref: v.id, motivo: m }) })
  return { db: d, venta: v }
}
const cobroEnCajaCerrada = (d, v) => pagosDe(v).some(p => p.fecha !== v.fecha && cajaBloqueada(d, p.fecha, p.caja))

export function registrarDevolucion(db, sesion, { ventaId, productoId, cantidad, motivo, reingresa = true, medio, foto } = {}, ahora = new Date()) {
  const u = exigir(db, sesion, 'devolver'), d = clon(db), v = d.ventas.find(x => x.id === ventaId)
  if (!v || v.estado !== 'Activa') falla('Elige una venta activa para devolver.')
  if (foto && !fotoValida(foto)) falla('La foto no es válida o pesa demasiado. Toma otra.')
  const l = v.items.find(x => x.productoId === productoId); if (!l) falla('Ese producto no está en la venta.')
  const c = entero(cantidad); if (!c) falla('La cantidad a devolver debe ser un número entero mayor que cero.')
  const vendidas = v.items.filter(x => x.productoId === productoId).reduce((s, x) => s + x.cantidad, 0)
  if (c > vendidas - cantidadDevuelta(d, v.id, productoId)) falla('No puedes devolver más de lo que se vendió.')
  if (!MOTIVOS_DEVOLUCION.includes(motivo)) falla('Elige el motivo de la devolución.')
  const m = medio || (pagosDe(v).at(-1)?.medio ?? v.medio)
  if (!MEDIOS.includes(m)) falla('Elige cómo se devuelve el dinero.')
  const fecha = fechaISO(ahora); exigirCajaAbierta(d, fecha, v.vendedorId)
  const cuando = ahoraISO(ahora), monto = r2(c * l.precio)
  const dev = { id: 'DEV-' + pad(sig(d, 'dev'), 4), fecha, cuando, ventaId, productoId, nombre: l.nombre, cantidad: c, monto, motivo, reingresa: !!reingresa, medio: m, quien: u.id, vendedorId: v.vendedorId, foto: foto || null }
  d.devoluciones.push(dev)
  if (reingresa) mover(d, { cuando, productoId, tipo: 'devolucion', cantidad: c, quien: u.id, ref: dev.id, motivo })
  v.historial.push({ cuando, quien: u.id, que: `Devolución de ${c} × ${l.nombre} por ${soles(monto)} (${motivo}).` })
  return { db: d, devolucion: dev }
}

// ---------- Productos e inventario ----------
export function guardarProducto(db, sesion, datos, ahora = new Date()) {
  const u = actor(db, sesion), d = clon(db)
  const nuevo = !datos.id
  if (nuevo && !puede(u.rol, 'crearProducto')) falla('Tu usuario no tiene permiso para crear productos.')
  if (!nuevo && !puede(u.rol, 'editarProducto')) falla('Tu usuario no tiene permiso para editar productos.')
  const nombre = textoLimpio(datos.nombre, 70); if (nombre.length < 2) falla('Escribe el nombre del producto.')
  const minimo = Number(datos.minimo); if (!Number.isInteger(minimo) || minimo < 0) falla('El stock mínimo debe ser un número entero, cero o más.')
  const precio = datos.precio === undefined ? undefined : r2(datos.precio), costo = datos.costo === undefined ? undefined : r2(datos.costo)
  for (const [k, v] of [['precio', precio], ['costo', costo]]) if (v !== undefined && !(v >= 0)) falla(`El ${k} no es válido.`)
  if (nuevo) {
    if (d.productos.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) falla('Ya existe un producto con ese nombre.')
    if (!puede(u.rol, 'cambiarPrecio') && (precio || costo)) falla('Solo la administradora fija los precios.')
    const p = { id: 'PRD-' + pad(sig(d, 'prod') + 1000, 4), nombre, categoria: textoLimpio(datos.categoria, 30) || 'Otros', precio: precio || 0, costo: costo || 0, stock: 0, minimo, unidad: textoLimpio(datos.unidad, 12) || 'und', decimales: !!datos.decimales, codigo: '', activo: true, ultimoConteo: null }; p.codigo = codigoInterno(p.id)
    const cod = normalizarCodigo(datos.codigo || ''); if (cod) { if (d.productos.some(x => normalizarCodigo(x.codigo) === cod)) falla('Ya existe un producto con ese código.'); p.codigo = cod }
    d.productos.push(p); d.bitacora.push({ cuando: ahoraISO(ahora), quien: u.id, que: `Creó el producto ${nombre}.` })
    return { db: d, producto: p }
  }
  const p = prod(d, datos.id); if (!p) falla('No se encontró el producto.')
  if (p.id === ID_OTROS) falla('El producto "Otros" no se puede cambiar.')
  const cambios = []
  if ((precio !== undefined && precio !== p.precio) || (costo !== undefined && costo !== p.costo)) {
    if (!puede(u.rol, 'cambiarPrecio')) falla('Solo la administradora puede cambiar precios y costos.')
    if (precio !== undefined && precio !== p.precio) { cambios.push(`precio ${soles(p.precio)} a ${soles(precio)}`); p.precio = precio }
    if (costo !== undefined && costo !== p.costo) { cambios.push(`costo ${soles(p.costo)} a ${soles(costo)}`); p.costo = costo }
  }
  if (nombre !== p.nombre) { cambios.push(`nombre "${p.nombre}" a "${nombre}"`); p.nombre = nombre }
  if (minimo !== p.minimo) { cambios.push(`mínimo ${p.minimo} a ${minimo}`); p.minimo = minimo }
  if (datos.decimales !== undefined && !!datos.decimales !== !!p.decimales) { cambios.push(datos.decimales ? 'permite decimales' : 'solo cantidades enteras'); p.decimales = !!datos.decimales }
  if (datos.unidad !== undefined) { const uni = textoLimpio(datos.unidad, 12) || 'und'; if (uni !== p.unidad) { cambios.push(`unidad ${p.unidad} a ${uni}`); p.unidad = uni } }
  const cat = textoLimpio(datos.categoria, 30) || p.categoria; if (cat !== p.categoria) { cambios.push(`categoría ${p.categoria} a ${cat}`); p.categoria = cat }
  if (cambios.length) d.bitacora.push({ cuando: ahoraISO(ahora), quien: u.id, que: `Cambió ${p.nombre}: ${cambios.join('; ')}.` })
  return { db: d, producto: p }
}
export function activarProducto(db, sesion, productoId, activo, ahora = new Date()) {
  const u = exigir(db, sesion, 'desactivarProducto'), d = clon(db), p = prod(d, productoId)
  if (!p || p.id === ID_OTROS) falla('No se encontró el producto.')
  p.activo = !!activo; d.bitacora.push({ cuando: ahoraISO(ahora), quien: u.id, que: `${activo ? 'Activó' : 'Desactivó'} el producto ${p.nombre}.` })
  return { db: d, producto: p }
}
export function ajustarStock(db, sesion, productoId, nuevoStock, motivo, ahora = new Date()) {
  const u = exigir(db, sesion, 'ajustarStock'), d = clon(db), p = prod(d, productoId)
  if (!p || p.id === ID_OTROS) falla('No se encontró el producto.')
  const n = Number(nuevoStock); if (!Number.isInteger(n) || n < 0) falla('El stock debe ser un número entero, cero o más.')
  const m = textoLimpio(motivo, 120); if (m.length < 4) falla('Escribe el motivo del ajuste.')
  if (n === p.stock) falla('El stock ya es ese número. No hay nada que ajustar.')
  mover(d, { cuando: ahoraISO(ahora), productoId, tipo: 'ajuste', cantidad: n - p.stock, quien: u.id, motivo: m })
  return { db: d, producto: p }
}
export function ingresarStock(db, sesion, productoId, cantidad, motivo = 'Compra o reposición', ahora = new Date()) {
  const u = exigir(db, sesion, 'ingresarStock'), d = clon(db), p = prod(d, productoId)
  if (!p || p.id === ID_OTROS) falla('No se encontró el producto.')
  const c = entero(cantidad); if (!c) falla('La cantidad que entra debe ser un número entero mayor que cero.')
  mover(d, { cuando: ahoraISO(ahora), productoId, tipo: 'ingreso', cantidad: c, quien: u.id, motivo: textoLimpio(motivo, 120) })
  return { db: d, producto: p }
}

// ---------- Códigos de barras (etiquetas y escaneo) ----------
export const normalizarCodigo = t => String(t ?? '').trim().replace(/\s+/g, '').toUpperCase()
export const productoPorCodigo = (db, codigo) => { const c = normalizarCodigo(codigo); return c ? db.productos.find(p => p.activo !== false && p.id !== ID_OTROS && normalizarCodigo(p.codigo) === c) || null : null }
// Ingreso de mercadería por escaneo: varias líneas de una vez, cada una con su movimiento y autor.
export function ingresarVarios(db, sesion, lineas, motivo = 'Ingreso por escaneo', ahora = new Date()) {
  const u = exigir(db, sesion, 'ingresarStock'); let d = clon(db)
  if (!Array.isArray(lineas) || !lineas.length) falla('Escanea al menos un producto.')
  for (const l of lineas) d = ingresarStock(d, { id: u.id }, l.productoId, l.cantidad, motivo, ahora).db
  return { db: d, producto: null }
}

// ---------- Conteo semanal ----------
export function sugerirConteo(db, ahora = new Date(), n = config.conteoMax) {
  const hoy = fechaISO(ahora)
  const cand = db.productos.filter(p => p.activo !== false && p.id !== ID_OTROS).map(p => {
    const dias = p.ultimoConteo ? diasEntre(p.ultimoConteo, hoy) : 999
    const bajo = p.stock <= p.minimo ? 1 : 0
    return { p, puntos: dias + bajo * 40 + (p.stock > 0 ? Math.min(p.stock * p.precio / 200, 20) : 0) }
  })
  cand.sort((a, b) => b.puntos - a.puntos || a.p.id.localeCompare(b.p.id))
  return cand.slice(0, Math.max(config.conteoMin, Math.min(n, config.conteoMax))).map(x => x.p.id)
}
export function iniciarConteo(db, sesion, ahora = new Date()) {
  const u = exigir(db, sesion, 'contar'), d = clon(db)
  const abierto = d.conteos.find(c => c.estado === 'Abierto'); if (abierto) return { db, conteo: abierto }
  const ids = sugerirConteo(d, ahora), hoy = fechaISO(ahora)
  const c = { id: 'CNT-' + pad(sig(d, 'cnt'), 4), semana: semanaDe(hoy), fecha: hoy, creadoEn: ahoraISO(ahora), quien: u.id, estado: 'Abierto', lineas: ids.map(id => ({ productoId: id, nombre: prod(d, id).nombre, sistema: prod(d, id).stock, contado: null, motivo: '' })) }
  d.conteos.push(c)
  return { db: d, conteo: c }
}
export function guardarConteo(db, sesion, conteoId, contados = {}, motivos = {}) {
  exigir(db, sesion, 'contar'); const d = clon(db), c = d.conteos.find(x => x.id === conteoId)
  if (!c || c.estado !== 'Abierto') falla('Ese conteo no está abierto.')
  for (const l of c.lineas) {
    if (l.productoId in contados) {
      const t = contados[l.productoId]
      if (t === '' || t === null) l.contado = null
      else { const n = Number(t); if (!Number.isInteger(n) || n < 0) falla(`El conteo de "${l.nombre}" debe ser un número entero, cero o más.`); l.contado = n }
    }
    if (l.productoId in motivos) l.motivo = textoLimpio(motivos[l.productoId], 120)
  }
  return { db: d, conteo: c }
}
export function cerrarConteo(db, sesion, conteoId, ahora = new Date()) {
  const u = exigir(db, sesion, 'contar'), d = clon(db), c = d.conteos.find(x => x.id === conteoId)
  if (!c || c.estado !== 'Abierto') falla('Ese conteo no está abierto.')
  const faltan = c.lineas.filter(l => l.contado === null); if (faltan.length) falla(`Falta contar ${faltan.length} producto(s). Escribe 0 si no hay ninguno.`)
  const cuando = ahoraISO(ahora)
  for (const l of c.lineas) {
    const p = prod(d, l.productoId); l.sistemaFinal = p.stock; l.diferencia = l.contado - p.stock
    if (l.diferencia !== 0) {
      if (textoLimpio(l.motivo, 120).length < 4) falla(`Escribe el motivo de la diferencia en "${l.nombre}".`)
      mover(d, { cuando, productoId: l.productoId, tipo: 'conteo', cantidad: l.diferencia, quien: u.id, motivo: l.motivo, ref: c.id })
    }
    p.ultimoConteo = c.fecha
  }
  c.estado = 'Cerrado'; c.cerradoEn = cuando; c.cerradoPor = u.id
  return { db: d, conteo: c }
}

// ---------- Tiendas externas ----------
export function guardarTienda(db, sesion, { id, nombre, encargado, telefono } = {}) {
  exigir(db, sesion, 'gestionarTiendas'); const d = clon(db)
  const n = textoLimpio(nombre, 60); if (n.length < 2) falla('Escribe el nombre de la tienda.')
  const tel = String(telefono ?? '').replace(/\D/g, ''); if (tel && !/^(51)?9\d{8}$/.test(tel)) falla('El celular debe tener 9 dígitos y empezar con 9.')
  if (id) { const t = d.tiendas.find(x => x.id === id); if (!t) falla('No se encontró la tienda.'); Object.assign(t, { nombre: n, encargado: textoLimpio(encargado, 60), telefono: tel }); return { db: d, tienda: t } }
  const t = { id: 'TDA-' + pad(sig(d, 'tda'), 3), nombre: n, encargado: textoLimpio(encargado, 60), telefono: tel, activa: true }
  d.tiendas.push(t); return { db: d, tienda: t }
}
export function crearEnvio(db, sesion, { tiendaId, items, nota, llevaId = null, pago = null } = {}, ahora = new Date()) {
  const u = exigir(db, sesion, 'gestionarTiendas'), d = clon(db), t = d.tiendas.find(x => x.id === tiendaId)
  if (!t) falla('Elige la tienda.')
  if (llevaId && !d.usuarios.some(x => x.id === llevaId && x.activo !== false)) falla('Elige quién lleva el envío.')
  const cuando = ahoraISO(ahora), lineas = armarLineas(d, (items || []).filter(i => i.productoId !== ID_OTROS).map(i => ({ productoId: i.productoId, cantidad: i.cantidad })), cuando, u.id, false).map(l => ({ productoId: l.productoId, nombre: l.nombre, cantidad: l.cantidad, precio: l.precio, recibido: null }))
  if (!lineas.length) falla('Agrega al menos un producto al envío.')
  const numero = sig(d, 'envio')
  const e = { id: `${config.serieEnvio}-${pad(numero)}`, serie: config.serieEnvio, numero, tiendaId, fecha: fechaISO(ahora), creadoEn: cuando, quien: u.id, llevaId: llevaId || null, estado: 'Enviado', nota: textoLimpio(nota, 160), items: lineas, total: totalDe(lineas), recepcion: null }
  lineas.forEach(l => mover(d, { cuando, productoId: l.productoId, tipo: 'envio', cantidad: -l.cantidad, quien: u.id, ref: e.id }))
  d.envios.push(e)
  if (pago && pago.estado && pago.estado !== 'Debe') {
    const monto = pago.estado === 'Pagado' ? e.total : r2(pago.monto)
    if (!(monto > 0) || monto > e.total + 0.001) falla(`El pago parcial debe ser mayor que cero y menor que ${soles(e.total)}.`)
    if (!MEDIOS_CAJA.includes(pago.medio)) falla('Elige con qué pagó: Efectivo, Yape o Plin.')
    const fecha = fechaISO(ahora); exigirCajaAbierta(d, fecha, null)
    d.pagosTienda.push({ id: 'PAG-' + pad(sig(d, 'pago'), 4), tiendaId, envioId: e.id, fecha, cuando, monto, medio: pago.medio, nota: 'Pago al crear el envío', quien: u.id })
  }
  return { db: d, envio: e }
}
// Pagado de un envío y su estado: Pagado (verde), Parcial (ámbar) o Debe (rojo).
export function pagoEnvio(db, e) {
  const pagado = r2((db.pagosTienda || []).filter(p => p.envioId === e.id).reduce((s, p) => s + p.monto, 0)), saldo = r2(Math.max(0, e.total - pagado))
  const medios = [...new Set((db.pagosTienda || []).filter(p => p.envioId === e.id).map(p => p.medio))]
  return { pagado, saldo, medios, estado: saldo <= 0.004 ? 'Pagado' : pagado > 0 ? 'Parcial' : 'Debe' }
}
export function confirmarRecepcion(db, sesion, envioId, recibidos = {}, ahora = new Date()) {
  const u = exigir(db, sesion, 'gestionarTiendas'), d = clon(db), e = d.envios.find(x => x.id === envioId)
  if (!e) falla('No se encontró el envío.')
  if (e.recepcion) falla('Este envío ya tiene la recepción confirmada.')
  for (const l of e.items) {
    const t = recibidos[l.productoId]; if (t === undefined || t === '' || t === null) falla(`Indica cuánto recibieron de "${l.nombre}".`)
    const n = Number(t); if (!Number.isInteger(n) || n < 0 || n > l.cantidad) falla(`Lo recibido de "${l.nombre}" debe estar entre 0 y ${l.cantidad}.`)
    l.recibido = n
  }
  const dif = e.items.filter(l => l.recibido !== l.cantidad)
  e.estado = dif.length ? 'Con diferencias' : 'Recibido completo'
  e.recepcion = { cuando: ahoraISO(ahora), quien: u.id, diferencias: dif.length }
  return { db: d, envio: e }
}
export function cuentaTienda(db, tiendaId) {
  const envios = db.envios.filter(e => e.tiendaId === tiendaId), pagos = db.pagosTienda.filter(p => p.tiendaId === tiendaId), devs = db.devolucionesTienda.filter(x => x.tiendaId === tiendaId)
  const enviado = r2(envios.reduce((s, e) => s + e.total, 0)), pagado = r2(pagos.reduce((s, p) => s + p.monto, 0)), devuelto = r2(devs.reduce((s, x) => s + x.monto, 0))
  const movs = [
    ...envios.map(e => ({ fecha: e.fecha, orden: e.creadoEn, tipo: 'Envío', ref: e.id, detalle: `${e.items.length} producto(s)`, monto: e.total })),
    ...pagos.map(p => ({ fecha: p.fecha, orden: p.cuando, tipo: 'Pago', ref: p.id, detalle: p.medio + (p.nota ? ` · ${p.nota}` : ''), monto: -p.monto })),
    ...devs.map(x => ({ fecha: x.fecha, orden: x.cuando, tipo: 'Devolución', ref: x.id, detalle: x.motivo, monto: -x.monto }))
  ].sort((a, b) => a.orden.localeCompare(b.orden))
  let saldo = 0; movs.forEach(m => { saldo = r2(saldo + m.monto); m.saldo = saldo })
  const diferenciasPorRevisar = envios.filter(e => e.estado === 'Con diferencias').reduce((s, e) => s + e.items.reduce((a, l) => a + (l.cantidad - l.recibido) * l.precio, 0), 0)
  return { enviado, pagado, devuelto, deuda: r2(enviado - pagado - devuelto), movimientos: movs, diferenciasPorRevisar: r2(diferenciasPorRevisar) }
}
export function registrarPagoTienda(db, sesion, { tiendaId, monto, medio, nota, envioId = null } = {}, ahora = new Date()) {
  const u = exigir(db, sesion, 'gestionarTiendas'), d = clon(db)
  if (!d.tiendas.some(t => t.id === tiendaId)) falla('Elige la tienda.')
  const m = r2(monto); if (!(m > 0)) falla('El monto del pago debe ser mayor que cero.')
  if (!MEDIOS_CAJA.includes(medio)) falla('Elige con qué pagó la tienda: Efectivo, Yape o Plin.')
  if (m > cuentaTienda(d, tiendaId).deuda + 0.001) falla('El pago es mayor que la deuda de la tienda. Revisa el monto.')
  if (envioId) { const e = d.envios.find(x => x.id === envioId && x.tiendaId === tiendaId); if (!e) falla('No se encontró el envío.'); if (m > pagoEnvio(d, e).saldo + 0.001) falla(`El pago es mayor que lo que falta de este envío (${soles(pagoEnvio(d, e).saldo)}).`) }
  const fecha = fechaISO(ahora); exigirCajaAbierta(d, fecha, null)
  const p = { id: 'PAG-' + pad(sig(d, 'pago'), 4), tiendaId, envioId: envioId || null, fecha, cuando: ahoraISO(ahora), monto: m, medio, nota: textoLimpio(nota, 100), quien: u.id }
  d.pagosTienda.push(p); return { db: d, pago: p }
}
export function registrarDevolucionTienda(db, sesion, { tiendaId, items, motivo } = {}, ahora = new Date()) {
  const u = exigir(db, sesion, 'devolverTienda'), d = clon(db)
  if (!d.tiendas.some(t => t.id === tiendaId)) falla('Elige la tienda.')
  const m = textoLimpio(motivo, 120); if (m.length < 4) falla('Escribe el motivo de la devolución.')
  const its = (items || []).filter(i => Number(i.cantidad) > 0); if (!its.length) falla('Indica qué productos devuelve la tienda.')
  const cuando = ahoraISO(ahora), lineas = its.map(i => {
    const p = prod(d, i.productoId), c = entero(i.cantidad); if (!p || !c) falla('Revisa los productos y cantidades devueltos.')
    const recibido = d.envios.filter(e => e.tiendaId === tiendaId).flatMap(e => e.items).filter(l => l.productoId === p.id).reduce((s, l) => s + (l.recibido ?? l.cantidad), 0)
    const ya = d.devolucionesTienda.filter(x => x.tiendaId === tiendaId).flatMap(x => x.items).filter(l => l.productoId === p.id).reduce((s, l) => s + l.cantidad, 0)
    if (c > recibido - ya) falla(`La tienda no puede devolver más "${p.nombre}" de lo que recibió.`)
    const ult = d.envios.filter(e => e.tiendaId === tiendaId).flatMap(e => e.items).filter(l => l.productoId === p.id).pop()
    return { productoId: p.id, nombre: p.nombre, cantidad: c, precio: ult ? ult.precio : p.precio }
  })
  const x = { id: 'DVT-' + pad(sig(d, 'dvt'), 4), tiendaId, fecha: fechaISO(ahora), cuando, items: lineas, monto: totalDe(lineas), motivo: m, quien: u.id }
  lineas.forEach(l => mover(d, { cuando, productoId: l.productoId, tipo: 'devolucion', cantidad: l.cantidad, quien: u.id, ref: x.id, motivo: 'Devolución de tienda' }))
  d.devolucionesTienda.push(x); return { db: d, devolucion: x }
}

// ---------- Caja ----------
export const ventasDe = (db, fecha, vendedorId = null) => db.ventas.filter(v => v.fecha === fecha && (!vendedorId || v.vendedorId === vendedorId))
// La caja cuadra SOLO con pagos verificados (decisión de Sandro); lo que está por verificar se muestra aparte.
export function calcularCaja(db, fecha, vendedorId = null) {
  const esp = { Efectivo: 0, Yape: 0, Plin: 0 }, porVer = { Efectivo: 0, Yape: 0, Plin: 0 }
  let ventasTotal = 0, anuladas = 0, cobrosPendientes = 0
  for (const v of ventasDe(db, fecha, vendedorId)) { if (v.estado !== 'Activa') { anuladas++; continue } ventasTotal += v.total }
  for (const v of db.ventas) if (v.estado === 'Activa') for (const p of pagosDe(v)) if (p.fecha === fecha && (!vendedorId || p.caja === vendedorId)) {
    if (p.estado === 'Verificado') esp[p.medio] += p.monto; else porVer[p.medio] += p.monto
    if (!p.inicial) cobrosPendientes += p.monto
  }
  let devoluciones = 0
  for (const x of db.devoluciones) if (x.fecha === fecha && (!vendedorId || x.vendedorId === vendedorId) && MEDIOS_CAJA.includes(x.medio)) { esp[x.medio] -= x.monto; devoluciones += x.monto }
  let cobrosTiendas = 0
  if (!vendedorId) for (const p of db.pagosTienda) if (p.fecha === fecha) { esp[p.medio] += p.monto; cobrosTiendas += p.monto }
  const pend = db.ventas.filter(v => v.estado === 'Activa' && saldoDe(v) > 0 && (!vendedorId || v.vendedorId === vendedorId) && v.fecha <= fecha)
  const porMedio = Object.fromEntries(MEDIOS_CAJA.map(m => [m, r2(esp[m])])), porVerificar = Object.fromEntries(MEDIOS_CAJA.map(m => [m, r2(porVer[m])]))
  return {
    fecha, vendedorId, esperado: porMedio, porVerificar, totalPorVerificar: r2(Object.values(porVerificar).reduce((a, b) => a + b, 0)), totalEsperado: r2(Object.values(porMedio).reduce((a, b) => a + b, 0)), ventasTotal: r2(ventasTotal), devoluciones: r2(devoluciones),
    cobrosPendientes: r2(cobrosPendientes), cobrosTiendas: r2(cobrosTiendas), anuladas,
    pendientes: { cantidad: pend.length, monto: r2(pend.reduce((s, v) => s + saldoDe(v), 0)) }, nVentas: ventasDe(db, fecha, vendedorId).filter(v => v.estado === 'Activa').length
  }
}
export function cerrarCaja(db, sesion, { fecha, vendedorId = null, contado, nota } = {}, ahora = new Date()) {
  const u = actor(db, sesion), d = clon(db)
  if (!esFechaISO(fecha)) falla('La fecha no es válida.')
  if (fecha > fechaISO(ahora)) falla('No se puede cerrar la caja de un día que todavía no llega.')
  const propia = vendedorId === u.id
  if (!(propia ? puede(u.rol, 'cerrarCajaPropia') : puede(u.rol, 'cerrarCajaDia'))) falla('Solo puedes cerrar tu propia caja.')
  if (vendedorId && !d.usuarios.some(x => x.id === vendedorId)) falla('No se encontró al vendedor.')
  const previo = cierreDe(d, fecha, vendedorId); if (previo && previo.estado === 'Cerrada') falla('Esa caja ya está cerrada.')
  const calc = calcularCaja(d, fecha, vendedorId), cont = {}, dif = {}
  for (const m of MEDIOS_CAJA) {
    const t = contado?.[m]; const n = t === undefined || t === '' ? NaN : r2(t)
    if (!(n >= 0)) falla(`Escribe cuánto contaste en ${m} (puede ser 0).`)
    cont[m] = n; dif[m] = r2(n - calc.esperado[m])
  }
  const hayDif = Object.values(dif).some(x => Math.abs(x) >= 0.005), nt = textoLimpio(nota, 200)
  if (hayDif && nt.length < 4) falla('Hay diferencia entre lo esperado y lo contado. Explica el motivo en la nota.')
  const cuando = ahoraISO(ahora)
  const reg = { id: `CAJ-${fecha}-${vendedorId || 'dia'}`, fecha, vendedorId: vendedorId || null, esperado: calc.esperado, contado: cont, diferencia: dif, diferenciaTotal: r2(Object.values(dif).reduce((a, b) => a + b, 0)), pendientes: calc.pendientes, ventasTotal: calc.ventasTotal, devoluciones: calc.devoluciones, nota: nt, estado: 'Cerrada', cerradoPor: u.id, cerradoEn: cuando, historial: [...(previo?.historial || []), { cuando, quien: u.id, que: 'Cerró la caja.' }] }
  if (previo) Object.assign(previo, reg); else d.cierres.push(reg)
  return { db: d, cierre: reg }
}
export function reabrirCaja(db, sesion, cierreId, motivo, ahora = new Date()) {
  const u = exigir(db, sesion, 'reabrirCaja'), d = clon(db), c = d.cierres.find(x => x.id === cierreId)
  if (!c || c.estado !== 'Cerrada') falla('Esa caja no está cerrada.')
  const m = textoLimpio(motivo, 160); if (m.length < 5) falla('Escribe el motivo de la reapertura (mínimo 5 letras).')
  c.estado = 'Reabierta'; c.historial.push({ cuando: ahoraISO(ahora), quien: u.id, que: `Reabrió la caja. Motivo: ${m}.` })
  d.bitacora.push({ cuando: ahoraISO(ahora), quien: u.id, que: `Reabrió la caja ${c.fecha}${c.vendedorId ? ' de ' + nombreDe(d, c.vendedorId) : ''}. Motivo: ${m}.` })
  return { db: d, cierre: c }
}

// ---------- Vista por rol (los vendedores nunca reciben costos ni datos de otros) ----------
export function vistaPara(db, sesion) {
  const u = actor(db, sesion)
  const quitarCosto = ({ costo, ...r }) => r
  if (u.rol === 'admin') return { ...db, usuarios: db.usuarios.map(({ hash, ...r }) => r) }
  // El co-administrador no ve costos ni utilidad (solo la administradora).
  if (u.rol === 'coadmin') return { ...db, usuarios: db.usuarios.map(({ hash, ...r }) => r), productos: db.productos.map(quitarCosto), ventas: db.ventas.map(v => ({ ...v, items: v.items.map(quitarCosto) })) }
  // El vendedor ve solo los envíos a tiendas que él lleva (solo lectura).
  const envios = db.envios.filter(e => e.llevaId === u.id), tids = new Set(envios.map(e => e.tiendaId)), eids = new Set(envios.map(e => e.id))
  return {
    ...db,
    usuarios: db.usuarios.map(({ id, nombre, rol }) => ({ id, nombre, rol: id === u.id ? rol : 'otro' })),
    favoritos: { [u.id]: favoritosDe(db, u.id) },
    productos: db.productos.map(quitarCosto),
    ventas: db.ventas.filter(v => v.vendedorId === u.id).map(v => ({ ...v, items: v.items.map(quitarCosto) })),
    devoluciones: db.devoluciones.filter(x => x.vendedorId === u.id),
    movimientos: [], conteos: [], devolucionesTienda: [], bitacora: [],
    tiendas: db.tiendas.filter(t => tids.has(t.id)).map(({ id, nombre, encargado, telefono }) => ({ id, nombre, encargado, telefono })),
    envios, pagosTienda: db.pagosTienda.filter(p => eids.has(p.envioId)),
    cierres: db.cierres.filter(c => c.vendedorId === u.id || !c.vendedorId).map(c => c.vendedorId ? c : { id: c.id, fecha: c.fecha, vendedorId: null, estado: c.estado })
  }
}
export const alertasStock = db => db.productos.filter(p => p.activo !== false && p.id !== ID_OTROS && p.stock <= p.minimo).sort((a, b) => (a.stock - a.minimo) - (b.stock - b.minimo))
