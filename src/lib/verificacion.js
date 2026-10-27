// Código de verificación de la guía de venta: depende del contenido, así que cambia si la venta se modifica.
import { config } from '../config/app.config.js'
import { soles } from './dinero.js'
function fnv(texto, semilla) { let h = semilla >>> 0; for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 } return h.toString(16).toUpperCase().padStart(8, '0') }
export function codigoGuia(v) {
  const base = [v.id, v.fecha, v.total.toFixed(2), v.cliente, v.items.map(l => `${l.productoId}:${l.cantidad}:${l.precio}`).join(','), v.estado].join('|')
  const a = fnv(base, 2166136261) + fnv(base, 84696351)
  return `${a.slice(0, 4)}-${a.slice(4, 8)}-${a.slice(8, 12)}`
}
export const textoQR = v => `${config.nombre} | Guía de venta ${v.id} | ${v.fecha} | ${soles(v.total)} | Código ${codigoGuia(v)}`
export function verificarGuia(db, id, codigo) {
  const v = db.ventas.find(x => x.id === String(id ?? '').trim().toUpperCase())
  if (!v) return { ok: false, mensaje: 'No existe una guía con ese número.' }
  if (v.estado !== 'Activa') return { ok: false, mensaje: `La guía ${v.id} existe pero fue ANULADA.`, venta: v }
  const c = String(codigo ?? '').trim().toUpperCase()
  if (c !== codigoGuia(v)) return { ok: false, mensaje: 'El código no coincide: la guía fue cambiada después de imprimirla o el código está mal escrito.', venta: v }
  return { ok: true, mensaje: `La guía ${v.id} es auténtica y coincide con lo registrado.`, venta: v }
}
