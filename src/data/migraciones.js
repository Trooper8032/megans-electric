import { codigoInterno } from '../lib/codigoBarras.js'
// Migraciones de datos: cada paso lleva la base de una versión a la siguiente sin perder nada.
import { VERSION_DATOS, TABLAS } from './seed.js'
export const versionDe = d => (d && Number.isInteger(d.version) ? d.version : 1)
const PASOS = {
  1: d => { d.ultimoRespaldo ??= null; d.contadores ??= {}; return d },
  2: d => { d.bitacora ??= []; d.devolucionesTienda ??= []; d.productos?.forEach(p => { p.ultimoConteo ??= null }); return d },
  // Decisión de Sandro: cantidades enteras por defecto, con opción por producto; fotos por línea; cliente obligatorio.
  3: d => { d.favoritos ??= {}; d.productos?.forEach(p => { p.decimales ??= false; p.codigo ??= ''; p.unidad ??= 'und' }); d.ventas?.forEach(v => { v.items?.forEach(l => { l.foto ??= null }); if (String(v.cliente || '').trim().length < 2) v.cliente = 'Cliente de mostrador' }); return d },
  // Decisión de Sandro: pagos por venta (parciales, nro. de operación, verificación). Lo histórico queda Verificado.
  4: d => { let n = d.contadores?.pago || 0; d.ventas?.forEach(v => { if (v.pagos) return; v.pagos = []; const pg = (medio, monto, fecha, cuando, quien, caja) => v.pagos.push({ id: 'PAG-' + String(++n).padStart(5, '0'), medio, monto, operacion: '', foto: null, estado: 'Verificado', quien, caja, cuando, fecha, verificadoPor: quien, verificadoEn: cuando, duplicado: false }); if (v.medio && v.medio !== 'Pendiente') { pg(v.medio, v.total, v.fecha, v.creadoEn, v.registradoPor || v.vendedorId, v.vendedorId); v.pagos[0].inicial = true } else if (v.cobro) pg(v.cobro.medio, v.cobro.monto, v.cobro.fecha, v.cobro.cuando, v.cobro.quien, v.cobro.quien) }); d.contadores = { ...(d.contadores || {}), pago: n }; d.productos?.forEach(p => { if (!p.codigo && p.id !== 'PRD-999') p.codigo = codigoInterno(p.id) }); return d }
}
export function migrar(datos) {
  let d = structuredClone(datos), v = versionDe(d)
  if (v > VERSION_DATOS) throw new Error('Esta copia viene de una versión más nueva de la aplicación.')
  while (v < VERSION_DATOS) { d = PASOS[v](d); v += 1; d.version = v }
  TABLAS.forEach(t => { d[t] ??= [] })
  d.contadores ??= {}
  return d
}
