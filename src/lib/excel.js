// Exportación a Excel (SheetJS). Los costos solo salen si el rol puede verlos.
import * as XLSX from 'xlsx'
import { puede } from './permisos.js'
import { cuentaTienda, calcularCaja } from './dominio.js'
import { MEDIOS_CAJA } from '../config/app.config.js'
export { descargar } from './descarga.js'
const nombre = (db, id) => db.usuarios.find(u => u.id === id)?.nombre || ''
const hoja = (cab, filas, anchos) => { const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]); ws['!cols'] = (anchos || cab.map(() => 16)).map(w => ({ wch: w })); return ws }
export function filasVentas(db, costos) {
  const out = []
  for (const v of [...db.ventas].sort((a, b) => b.numero - a.numero)) for (const l of v.items) out.push([v.id, v.fecha, v.hora, v.cliente, nombre(db, v.vendedorId), v.medio, v.cobro ? v.cobro.medio : '', v.estado, l.nombre, l.cantidad, l.precio, +(l.cantidad * l.precio).toFixed(2), ...(costos ? [l.costo ?? 0] : []), v.total])
  return out
}
export function libroCompleto(db, rol) {
  if (!puede(rol, 'exportar')) throw new Error('Tu usuario no puede exportar a Excel.')
  const costos = puede(rol, 'verCostos'), wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, hoja(['Guía', 'Fecha', 'Hora', 'Cliente', 'Vendedor', 'Medio de pago', 'Cobrado con', 'Estado', 'Producto', 'Cantidad', 'Precio', 'Subtotal', ...(costos ? ['Costo unitario'] : []), 'Total de la venta'], filasVentas(db, costos), [14, 12, 8, 24, 18, 14, 12, 10, 34, 9, 9, 10, ...(costos ? [12] : []), 14]), 'Ventas')
  XLSX.utils.book_append_sheet(wb, hoja(['Código', 'Producto', 'Categoría', 'Precio', ...(costos ? ['Costo'] : []), 'Stock', 'Stock mínimo', 'Estado'], db.productos.filter(p => p.id !== 'PRD-999').map(p => [p.id, p.nombre, p.categoria, p.precio, ...(costos ? [p.costo] : []), p.stock, p.minimo, p.stock <= p.minimo ? 'STOCK BAJO' : 'Normal']), [10, 36, 14, 9, ...(costos ? [9] : []), 8, 12, 12]), 'Stock')
  XLSX.utils.book_append_sheet(wb, hoja(['Fecha y hora', 'Producto', 'Tipo', 'Cantidad', 'Stock después', 'Quién', 'Motivo', 'Referencia'], db.movimientos.map(m => [m.cuando.replace('T', ' ').slice(0, 16), db.productos.find(p => p.id === m.productoId)?.nombre || m.productoId, m.tipo, m.cantidad, m.stockDespues, nombre(db, m.quien), m.motivo, m.ref]), [18, 34, 12, 9, 12, 18, 30, 14]), 'Movimientos de stock')
  const filasT = []
  for (const t of db.tiendas) { const c = cuentaTienda(db, t.id); filasT.push([t.nombre, c.enviado, c.pagado, c.devuelto, c.deuda, c.diferenciasPorRevisar]) }
  XLSX.utils.book_append_sheet(wb, hoja(['Tienda', 'Enviado', 'Pagado', 'Devuelto', 'Deuda', 'Diferencias por revisar'], filasT, [34, 12, 12, 12, 12, 20]), 'Tiendas')
  const movT = []
  for (const t of db.tiendas) for (const m of cuentaTienda(db, t.id).movimientos) movT.push([t.nombre, m.fecha, m.tipo, m.ref, m.detalle, m.monto, m.saldo])
  XLSX.utils.book_append_sheet(wb, hoja(['Tienda', 'Fecha', 'Tipo', 'Referencia', 'Detalle', 'Monto (suma los envíos, resta pagos y devoluciones)', 'Deuda acumulada'], movT, [30, 12, 12, 14, 30, 22, 16]), 'Cuenta corriente')
  const cierres = [...db.cierres].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(c => [c.fecha, c.vendedorId ? nombre(db, c.vendedorId) : 'Todo el día', ...MEDIOS_CAJA.flatMap(m => [c.esperado[m], c.contado[m], c.diferencia[m]]), c.diferenciaTotal, c.pendientes.monto, c.estado, nombre(db, c.cerradoPor), c.nota])
  XLSX.utils.book_append_sheet(wb, hoja(['Fecha', 'Caja de', ...MEDIOS_CAJA.flatMap(m => [`${m} esperado`, `${m} contado`, `${m} diferencia`]), 'Diferencia total', 'Pendientes por cobrar', 'Estado', 'Cerró', 'Nota'], cierres, [12, 18, ...MEDIOS_CAJA.flatMap(() => [12, 12, 12]), 12, 14, 10, 18, 40]), 'Caja')
  XLSX.utils.book_append_sheet(wb, hoja(['Fecha', 'Guía', 'Producto', 'Cantidad', 'Monto', 'Motivo', 'Vuelve al stock', 'Devuelto en', 'Quién'], db.devoluciones.map(d => [d.fecha, d.ventaId, d.nombre, d.cantidad, d.monto, d.motivo, d.reingresa ? 'Sí' : 'No', d.medio, nombre(db, d.quien)]), [12, 14, 32, 9, 10, 22, 12, 12, 18]), 'Devoluciones')
  return wb
}
export const bytesLibro = (db, rol) => XLSX.write(libroCompleto(db, rol), { type: 'array', bookType: 'xlsx' })
export const leerLibro = buf => { const wb = XLSX.read(buf, { type: 'array' }); return Object.fromEntries(wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })])) }
export const hojasDe = (db, rol) => libroCompleto(db, rol).SheetNames
export { calcularCaja }
export function bytesHoja(db, rol, nombreHoja) {
  const wb = libroCompleto(db, rol), nuevo = XLSX.utils.book_new()
  const nombres = nombreHoja === 'Tiendas' ? ['Tiendas', 'Cuenta corriente'] : [nombreHoja]
  nombres.forEach(n => { if (!wb.Sheets[n]) throw new Error('Esa hoja no existe.'); XLSX.utils.book_append_sheet(nuevo, wb.Sheets[n], n) })
  return XLSX.write(nuevo, { type: 'array', bookType: 'xlsx' })
}
