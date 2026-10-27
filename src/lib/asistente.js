// Respuestas del asistente de voz. Trabaja SOLO sobre la vista del rol (vistaPara): un vendedor nunca recibe costos,
// utilidad ni ventas de otros, así que el asistente tampoco puede mostrarlos. Además se revisa el permiso de cada pregunta.
import { puede } from './permisos.js'
import { calcularCaja, cuentaTienda, alertasStock, saldoDe, estadoCobro, ID_OTROS } from './dominio.js'
import { utilidadVenta } from './metricas.js'
import { soles } from './dinero.js'
import { sumarDias } from './fechas.js'
import { sinTilde, tokens, puntaje } from './voz.js'

const NO = t => ({ ok: false, titulo: 'Tu usuario no puede ver esto', texto: t })
const und = n => `${n} ${n === 1 ? 'unidad' : 'unidades'}`
export function responder(vista, sesion, orden, hoy) {
  const rol = sesion.rol, fecha = orden.ayer ? sumarDias(hoy, -1) : hoy, cuando = orden.ayer ? 'ayer' : 'hoy'
  const prod = id => vista.productos.find(p => p.id === id)
  switch (orden.que) {
    case 'stock': {
      const p = orden.producto?.producto && prod(orden.producto.producto.id)
      if (!p) return sinProducto(orden)
      return { ok: true, titulo: p.nombre, texto: p.stock > 0 ? `Quedan ${und(p.stock)}.` : 'No queda stock.', lineas: [`Precio: ${soles(p.precio)}`, p.stock <= p.minimo ? `Está en stock bajo (mínimo ${p.minimo}).` : `Mínimo: ${p.minimo}`], duda: orden.producto.duda, opciones: orden.producto.opciones }
    }
    case 'precio': {
      const p = orden.producto?.producto && prod(orden.producto.producto.id)
      if (!p) return sinProducto(orden)
      return { ok: true, titulo: p.nombre, texto: `Precio de venta: ${soles(p.precio)}.`, lineas: [`Stock: ${und(p.stock)}`], duda: orden.producto.duda, opciones: orden.producto.opciones }
    }
    case 'costo': {
      if (!puede(rol, 'verCostos')) return NO('Los costos solo los ve la administradora.')
      const p = orden.producto?.producto && prod(orden.producto.producto.id)
      if (!p) return sinProducto(orden)
      return { ok: true, titulo: p.nombre, texto: `Costo: ${soles(p.costo)}. Precio: ${soles(p.precio)}.`, lineas: [`Margen por unidad: ${soles(p.precio - p.costo)}`] }
    }
    case 'ventas': {
      const vs = vista.ventas.filter(v => v.fecha === fecha && v.estado === 'Activa' && (rol !== 'vendedor' || v.vendedorId === sesion.id))
      const total = vs.reduce((s, v) => s + v.total, 0), pend = vs.filter(v => estadoCobro(v) !== 'Cobrado')
      const porMedio = ['Efectivo', 'Yape', 'Plin', 'Pendiente'].map(m => [m, vs.filter(v => v.medio === m).reduce((s, v) => s + v.total, 0)]).filter(x => x[1] > 0)
      return { ok: true, titulo: rol === 'vendedor' ? `Tus ventas de ${cuando}` : `Ventas de ${cuando}`, texto: `${soles(total)} en ${vs.length} venta${vs.length === 1 ? '' : 's'}.`, lineas: [...porMedio.map(([m, x]) => `${m}: ${soles(x)}`), ...(pend.length ? [`Por cobrar: ${pend.length} (${soles(pend.reduce((s, v) => s + saldoDe(v), 0))})`] : [])] }
    }
    case 'utilidad': {
      if (!puede(rol, 'verUtilidad')) return NO('La utilidad solo la ve la administradora.')
      const vs = vista.ventas.filter(v => v.fecha === fecha && v.estado === 'Activa')
      return { ok: true, titulo: `Utilidad de ${cuando}`, texto: soles(vs.reduce((s, v) => s + utilidadVenta(v), 0)), lineas: [`Vendido: ${soles(vs.reduce((s, v) => s + v.total, 0))}`, 'Precio menos costo, antes de devoluciones.'] }
    }
    case 'caja': {
      const todo = puede(rol, 'cerrarCajaDia'), c = calcularCaja(vista, fecha, todo ? null : sesion.id)
      return { ok: true, titulo: todo ? `Caja del día (${cuando})` : `Tu caja de ${cuando}`, texto: `Debe haber ${soles(c.totalEsperado)} verificados.`, lineas: [`Efectivo: ${soles(c.esperado.Efectivo)}`, `Yape: ${soles(c.esperado.Yape)}`, `Plin: ${soles(c.esperado.Plin)}`, ...(c.totalPorVerificar > 0 ? [`Por verificar: ${soles(c.totalPorVerificar)}`] : []), `Pendientes por cobrar: ${c.pendientes.cantidad} (${soles(c.pendientes.monto)})`] }
    }
    case 'stockBajo': {
      if (!puede(rol, 'verStockCompleto')) return NO('La lista de stock bajo la ve la administración. Puedes preguntar por un producto: «¿Cuántos interruptores simples quedan?»')
      const b = alertasStock(vista)
      return { ok: true, titulo: 'Stock bajo', texto: b.length ? `${b.length} producto${b.length === 1 ? '' : 's'} por reponer.` : 'Ningún producto está en stock bajo.', lineas: b.slice(0, 8).map(p => `${p.nombre}: quedan ${p.stock} (mínimo ${p.minimo})`) }
    }
    case 'deuda': {
      if (!puede(rol, 'verTiendas')) return NO('Las cuentas de las tiendas las ve la administración.')
      const ts = vista.tiendas
      if (!ts.length) return { ok: true, titulo: 'Tiendas', texto: 'No hay tiendas registradas.' }
      const t = tiendaDe(ts, orden.tienda)
      if (!t) return { ok: true, titulo: 'Deudas de las tiendas', texto: `Total: ${soles(ts.reduce((s, x) => s + cuentaTienda(vista, x.id).deuda, 0))}.`, lineas: ts.map(x => `${x.nombre}: ${soles(cuentaTienda(vista, x.id).deuda)}`) }
      const c = cuentaTienda(vista, t.id)
      return { ok: true, titulo: t.nombre, texto: `Debe ${soles(c.deuda)}.`, lineas: [`Enviado: ${soles(c.enviado)}`, `Pagado: ${soles(c.pagado)}`, `Devuelto: ${soles(c.devuelto)}`] }
    }
    case 'pendientes': {
      const ps = vista.ventas.filter(v => v.estado === 'Activa' && saldoDe(v) > 0 && (rol !== 'vendedor' || v.vendedorId === sesion.id)).sort((a, b) => a.fecha.localeCompare(b.fecha))
      return { ok: true, titulo: 'Ventas por cobrar', texto: ps.length ? `${ps.length} venta${ps.length === 1 ? '' : 's'} por ${soles(ps.reduce((s, v) => s + saldoDe(v), 0))}.` : 'No hay ventas por cobrar.', lineas: ps.slice(0, 8).map(v => `${v.id} · ${v.cliente}: falta ${soles(saldoDe(v))}`) }
    }
    default: return { ok: false, titulo: 'No entendí la pregunta', texto: 'Prueba: «¿Cuántos interruptores simples quedan?», «¿Cuánto vendí hoy?» o «¿Cómo va la caja?».' }
  }
}
const sinProducto = o => ({ ok: false, titulo: 'No encontré ese producto', texto: o.producto?.dicho ? `Escuché «${o.producto.dicho}», pero no está en el catálogo.` : 'Di el nombre del producto.', opciones: o.producto?.opciones || [] })
const NUM_T = { uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5' }
export function tiendaDe(tiendas, dicho) {
  const d = sinTilde(dicho || '').trim(); if (!d) return null
  const n = NUM_T[d.split(' ')[0]] || (/^\d+/.exec(d) || [])[0]
  if (n) { const t = tiendas.find(x => new RegExp(`\\btienda\\s+${n}\\b`).test(sinTilde(x.nombre))) || tiendas[Number(n) - 1]; if (t) return t }
  const q = tokens(d); let mejor = null, ms = 0
  for (const t of tiendas) { const s = puntaje(q, tokens(t.nombre)); if (s > ms) { ms = s; mejor = t } }
  return ms >= 0.5 ? mejor : null
}
// Ventas para "buscar" o "cobrar": por número de guía o por cliente, solo dentro de la vista del rol.
export function buscarVentas(vista, sesion, { numero = null, cliente = '' } = {}, { soloPorCobrar = false } = {}) {
  let vs = vista.ventas.filter(v => (sesion.rol !== 'vendedor' || v.vendedorId === sesion.id) && (!soloPorCobrar || (v.estado === 'Activa' && saldoDe(v) > 0)))
  if (numero) return vs.filter(v => v.numero === numero || Number(String(v.id).split('-').pop()) === numero)
  if (cliente) { const q = tokens(cliente); vs = vs.map(v => ({ v, s: puntaje(q, tokens(v.cliente)) })).filter(x => x.s >= 0.6).sort((a, b) => b.s - a.s || b.v.creadoEn.localeCompare(a.v.creadoEn)).map(x => x.v) }
  else if (!soloPorCobrar) return []
  return vs.slice(0, 6)
}
export const EJEMPLOS = {
  admin: ['¿Cuántos interruptores simples quedan?', '¿Cuánto vendí hoy?', '¿Cuál es la utilidad de hoy?', '¿Cuánto debe la Tienda 1?', 'Llegaron 50 interruptores simples', 'Juan ya pagó su pendiente en efectivo'],
  coadmin: ['¿Cuántos interruptores simples quedan?', '¿Cuánto se vendió hoy?', '¿Qué productos están por acabarse?', '¿Cuánto debe la Tienda 1?', 'Llegaron 50 interruptores simples', 'Busca la venta de Juan'],
  vendedor: ['¿Cuántos interruptores simples quedan?', '¿Cuánto vendí hoy?', '¿Cómo va mi caja?', '¿Quiénes me deben?', 'Juan ya pagó su pendiente en efectivo', 'Busca la venta de Juan']
}
export { ID_OTROS }
