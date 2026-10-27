// Vista de cuaderno diario: lo mismo que se escribe a mano, listo para imprimir y comparar.
import { MEDIOS } from '../config/app.config.js'
import { r2 } from './dinero.js'
import { calcularCaja, cierreDe } from './dominio.js'
import { sumarDias, diaCorto } from './fechas.js'
export function cuadernoDelDia(db, fecha) {
  const nombre = id => db.usuarios.find(u => u.id === id)?.nombre || '—'
  const filas = db.ventas.filter(v => v.fecha === fecha).sort((a, b) => a.numero - b.numero).map(v => ({
    id: v.id, hora: v.hora, cliente: v.cliente, vendedor: nombre(v.vendedorId), detalle: v.items.map(l => `${l.cantidad} ${l.nombre}`).join(', '),
    medio: v.cobro ? `Pendiente, cobrado con ${v.cobro.medio}` : v.medio, total: v.total, estado: v.estado, agregados: v.version > 1
  }))
  const porMedio = Object.fromEntries(MEDIOS.map(m => [m, 0]))
  filas.filter(f => f.estado === 'Activa').forEach(f => { const v = db.ventas.find(x => x.id === f.id); porMedio[v.medio] = r2(porMedio[v.medio] + v.total) })
  const devs = db.devoluciones.filter(d => d.fecha === fecha).map(d => ({ id: d.id, detalle: `${d.cantidad} ${d.nombre}`, motivo: d.motivo, monto: d.monto, medio: d.medio }))
  const caja = calcularCaja(db, fecha, null), cierre = cierreDe(db, fecha, null)
  return { fecha, filas, porMedio, totalDia: r2(filas.filter(f => f.estado === 'Activa').reduce((s, f) => s + f.total, 0)), devs, caja, cierre }
}
export function reporteCuadre(db, hasta, dias = 7) {
  return Array.from({ length: dias }, (_, i) => { const f = sumarDias(hasta, i - dias + 1), c = cierreDe(db, f, null), calc = calcularCaja(db, f, null)
    return { fecha: f, etiqueta: diaCorto(f), esperado: calc.totalEsperado, contado: c ? r2(Object.values(c.contado).reduce((a, b) => a + b, 0)) : null, diferencia: c ? c.diferenciaTotal : null, estado: c ? c.estado : 'Sin cerrar', pendientes: calc.pendientes } })
}
