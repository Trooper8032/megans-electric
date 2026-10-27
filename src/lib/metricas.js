// Cálculos del panel. Todo sale de los registros: no hay números guardados aparte.
import { r2 } from './dinero.js'
import { sumarDias, fechaISO, diaCorto, mesCorto, diasEntre } from './fechas.js'
import { cuentaTienda, alertasStock, ID_OTROS } from './dominio.js'
const activas = db => db.ventas.filter(v => v.estado === 'Activa')
export const utilidadVenta = v => v.items.reduce((s, l) => s + l.cantidad * (l.precio - (l.costo || 0)), 0)
export function ventasPorDia(db, hoy, n = 14) {
  const mapa = {}; activas(db).forEach(v => { mapa[v.fecha] = (mapa[v.fecha] || 0) + v.total })
  return Array.from({ length: n }, (_, i) => { const f = sumarDias(hoy, i - n + 1); return { fecha: f, etiqueta: diaCorto(f).replace('.', ''), valor: r2(mapa[f] || 0) } })
}
export function ventasPorMes(db, hoy, n = 4) {
  const [y, m] = hoy.split('-').map(Number), meses = []
  for (let i = n - 1; i >= 0; i--) { const d = new Date(y, m - 1 - i, 1); meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  return meses.map(ym => {
    const vs = activas(db).filter(v => v.fecha.startsWith(ym)), dev = db.devoluciones.filter(x => x.fecha.startsWith(ym))
    const util = vs.reduce((s, v) => s + utilidadVenta(v), 0) - dev.reduce((s, x) => { const v = db.ventas.find(a => a.id === x.ventaId), l = v?.items.find(i => i.productoId === x.productoId); return s + (x.reingresa ? (l ? x.cantidad * (l.precio - l.costo) : 0) : x.monto) }, 0)
    return { mes: ym, etiqueta: mesCorto(ym), valor: r2(vs.reduce((s, v) => s + v.total, 0)), utilidad: r2(util), ventas: vs.length }
  })
}
export function ranking(db, hoy, dias = 30, n = 8) {
  const desde = sumarDias(hoy, -dias + 1), m = {}
  activas(db).filter(v => v.fecha >= desde).forEach(v => v.items.forEach(l => { if (l.productoId === ID_OTROS) return; const x = m[l.productoId] ||= { nombre: l.nombre, unidades: 0, monto: 0 }; x.unidades += l.cantidad; x.monto += l.cantidad * l.precio }))
  return Object.values(m).sort((a, b) => b.unidades - a.unidades).slice(0, n).map(x => ({ ...x, monto: r2(x.monto) }))
}
export function deudasTiendas(db) { return db.tiendas.map(t => ({ id: t.id, nombre: t.nombre, ...cuentaTienda(db, t.id) })).sort((a, b) => b.deuda - a.deuda) }
export function cuadreCaja(db, hoy, n = 7) {
  return Array.from({ length: n }, (_, i) => { const f = sumarDias(hoy, i - n), c = db.cierres.find(x => x.fecha === f && !x.vendedorId); return { fecha: f, etiqueta: diaCorto(f).replace('.', ''), cerrada: !!c && c.estado === 'Cerrada', diferencia: c ? c.diferenciaTotal : null } })
}
export function stockBajoLista(db) { return alertasStock(db).map(p => ({ id: p.id, nombre: p.nombre, stock: p.stock, minimo: p.minimo })) }
export function alertas(db, hoy) {
  const out = [], bajos = alertasStock(db)
  if (bajos.length) out.push({ tipo: 'stock', tono: 'rojo', texto: `${bajos.length} producto(s) con stock bajo o agotado.`, ruta: 'inventario' })
  const ayer = sumarDias(hoy, -1), ca = db.cierres.find(c => c.fecha === ayer && !c.vendedorId)
  if (!ca || ca.estado !== 'Cerrada') out.push({ tipo: 'caja', tono: 'rojo', texto: 'La caja de ayer no está cerrada.', ruta: 'caja' })
  else if (ca.diferenciaTotal !== 0) out.push({ tipo: 'caja', tono: 'rojo', texto: `La caja de ayer cerró con diferencia de ${ca.diferenciaTotal > 0 ? 'sobrante' : 'faltante'}.`, ruta: 'caja' })
  const pend = db.ventas.filter(v => v.estado === 'Activa' && (v.total - (v.pagos || []).reduce((a, p) => a + p.monto, 0)) > 0.004), viejos = pend.filter(v => diasEntre(v.fecha, hoy) > 7)
  if (pend.length) out.push({ tipo: 'cobro', tono: viejos.length ? 'rojo' : 'ambar', texto: `${pend.length} venta(s) pendientes de cobro${viejos.length ? `; ${viejos.length} con más de 7 días` : ''}.`, ruta: 'ventas' })
  const sinConfirmar = db.envios.filter(e => !e.recepcion), difs = db.envios.filter(e => e.estado === 'Con diferencias')
  if (sinConfirmar.length) out.push({ tipo: 'envio', tono: 'ambar', texto: `${sinConfirmar.length} envío(s) a tiendas sin confirmar recepción.`, ruta: 'tiendas' })
  if (difs.length) out.push({ tipo: 'envio', tono: 'rojo', texto: `${difs.length} envío(s) con diferencias por revisar.`, ruta: 'tiendas' })
  const ult = db.conteos.filter(c => c.estado === 'Cerrado').map(c => c.fecha).sort().pop()
  if (!ult || diasEntre(ult, hoy) > 7) out.push({ tipo: 'conteo', tono: 'ambar', texto: 'Toca el conteo rápido semanal de stock.', ruta: 'inventario' })
  return out
}
export function resumenDia(db, fecha, vendedorId = null) {
  const vs = db.ventas.filter(v => v.fecha === fecha && v.estado === 'Activa' && (!vendedorId || v.vendedorId === vendedorId))
  return { cantidad: vs.length, total: r2(vs.reduce((s, v) => s + v.total, 0)), utilidad: r2(vs.reduce((s, v) => s + utilidadVenta(v), 0)) }
}
export const hoyISO = () => fechaISO(new Date())
