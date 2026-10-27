const saldoV = v => Math.max(0, Math.round((v.total - (v.pagos || []).reduce((a, p) => a + p.monto, 0)) * 100) / 100)
// Enlaces wa.me con mensaje prellenado. La aplicación solo abre WhatsApp; el envío lo hace la persona.
import { config } from '../config/app.config.js'
import { soles } from './dinero.js'
import { codigoGuia } from './verificacion.js'
export function normalizarTelefono(t, pais = '51') {
  const d = String(t ?? '').replace(/\D/g, '')
  if (d.length === 9 && d.startsWith('9')) return pais + d
  if (d.length === 11 && d.startsWith(pais)) return d
  return null
}
export const enlaceWhatsApp = (telefono, mensaje) => `https://wa.me/${normalizarTelefono(telefono) || ''}?text=${encodeURIComponent(mensaje)}`
export const mensajeGuia = v => [`Hola ${String(v.cliente).split(' ')[0]}, te saluda ${config.nombre}.`, `Te envío tu guía de venta ${v.id} por ${soles(v.total)} (${v.cobro ? v.cobro.medio : v.medio}).`, `Código de verificación: ${codigoGuia(v)}.`, 'Este documento es una guía de venta interna, no es guía de remisión ni comprobante SUNAT.', 'Gracias por tu compra.'].join('\n')
export const mensajeEnvio = (e, t) => [`Hola ${String(t.encargado || t.nombre).split(' ')[0]}, te saluda ${config.nombre}.`, `Te envío la hoja de envío de stock ${e.id} por ${soles(e.total)}.`, 'Por favor cuenta cada producto al recibir y avísame si falta algo.', 'Es un control interno, no una guía de remisión de la SUNAT.'].join('\n')
// Resumen del cierre del día en texto (como "Compartir resumen" del Apps Script).
export function textoResumenDia({ fecha, titulo, calc, ventas, cerrada, nombreDe }) {
  const pend = ventas.filter(v => v.estado === 'Activa' && saldoV(v) > 0).reduce((s, v) => s + saldoV(v), 0)
  const l = [config.nombre, titulo, `Fecha: ${fecha}`, `Estado: ${cerrada ? 'Cerrada' : 'Abierta'}`, `Efectivo: ${soles(calc.esperado.Efectivo)}`, `Yape: ${soles(calc.esperado.Yape)}`, `Plin: ${soles(calc.esperado.Plin)}`, `Pendiente (por cobrar): ${soles(pend)}`, `Total de ventas: ${soles(calc.ventasTotal)}`, `Total de devoluciones: ${soles(calc.devoluciones)}`, '', 'Ventas']
  const act = ventas.filter(v => v.estado === 'Activa').sort((a, b) => a.numero - b.numero)
  if (!act.length) l.push('No hay ventas activas.')
  act.forEach((v, i) => { l.push(`${i + 1}. ${v.hora} · ${v.id} · ${v.cliente} · ${v.cobro ? v.cobro.medio : v.medio} · ${soles(v.total)}${nombreDe ? ' · ' + nombreDe(v.vendedorId) : ''}`); v.items.forEach(x => l.push(`   - ${x.nombre} x ${x.cantidad} · ${soles(x.precio)} · ${soles(x.cantidad * x.precio)}`)) })
  return l.join('\n')
}
