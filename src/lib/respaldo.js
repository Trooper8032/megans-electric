// Copia de seguridad en un clic (JSON): formato, validación estricta y lectura segura.
import { TABLAS, VERSION_DATOS } from '../data/seed.js'
import { migrar } from '../data/migraciones.js'
import { ROLES } from './permisos.js'
export const MAX_RESPALDO_BYTES = 8 * 1024 * 1024
const esObj = x => x && typeof x === 'object' && !Array.isArray(x)
export function validarCopia(d) {
  if (!esObj(d)) return 'El archivo no tiene el formato esperado.'
  for (const t of TABLAS) {
    if (!Array.isArray(d[t])) return `Falta la sección "${t}" en la copia.`
    const ids = new Set()
    for (const f of d[t]) { if (t === 'bitacora') { if (!esObj(f)) return 'La bitácora tiene un registro no válido.'; continue } if (!esObj(f) || typeof f.id !== 'string' || !f.id) return `La sección "${t}" tiene un registro sin identificador.`; if (t !== 'bitacora' && ids.has(f.id)) return `La sección "${t}" repite el identificador ${f.id}.`; ids.add(f.id) }
  }
  const ids = t => new Set(d[t].map(x => x.id))
  const us = ids('usuarios'), ps = ids('productos'), vs = ids('ventas'), ts = ids('tiendas')
  if (d.usuarios.some(u => !ROLES.includes(u.rol) || !u.usuario || !u.hash)) return 'Hay usuarios con rol o datos no válidos.'
  if (!d.usuarios.some(u => u.rol === 'admin' && u.activo !== false)) return 'La copia no tiene una administradora activa.'
  if (d.ventas.some(v => !us.has(v.vendedorId) || !Array.isArray(v.items) || !v.items.length || typeof v.total !== 'number')) return 'Hay ventas con datos incompletos o de un vendedor inexistente.'
  if (d.ventas.some(v => v.items.some(l => !ps.has(l.productoId)))) return 'Hay ventas con productos inexistentes.'
  if (d.ventas.some(v => Math.abs(v.items.reduce((s, l) => s + l.cantidad * l.precio, 0) - v.total) > 0.011)) return 'Hay ventas cuyo total no coincide con sus productos.'
  if (d.devoluciones.some(x => !vs.has(x.ventaId))) return 'Hay devoluciones de ventas inexistentes.'
  if (d.envios.some(e => !ts.has(e.tiendaId)) || d.pagosTienda.some(p => !ts.has(p.tiendaId)) || d.devolucionesTienda.some(x => !ts.has(x.tiendaId))) return 'Hay movimientos de una tienda inexistente.'
  if (d.movimientos.some(m => !ps.has(m.productoId))) return 'Hay movimientos de stock de productos inexistentes.'
  if (d.productos.some(p => !Number.isFinite(p.stock) || p.stock < -1e-9 || (!p.decimales && !Number.isInteger(p.stock)))) return 'Hay productos con stock no válido.'
  return null
}
export const crearRespaldo = (db, ahora = new Date()) => ({ app: 'megans-v2', version: VERSION_DATOS, fecha: ahora.toISOString(), datos: db })
export const resumenCopia = d => ({ productos: d.productos.length, ventas: d.ventas.length, tiendas: d.tiendas.length, cierres: d.cierres.length, movimientos: d.movimientos.length })
export function leerRespaldo(texto) {
  if (typeof texto !== 'string' || !texto.trim()) throw new Error('El archivo está vacío.')
  if (texto.length > MAX_RESPALDO_BYTES) throw new Error('El archivo es demasiado grande para ser una copia de MEGANS ELECTRIC.')
  let o; try { o = JSON.parse(texto) } catch { throw new Error('El archivo no es una copia válida (no se pudo leer).') }
  if (!esObj(o) || o.app !== 'megans-v2' || !esObj(o.datos)) throw new Error('Este archivo no es una copia de MEGANS ELECTRIC.')
  let datos; try { datos = migrar(o.datos) } catch (e) { throw new Error(e.message) }
  const problema = validarCopia(datos); if (problema) throw new Error(problema)
  return { datos, fecha: o.fecha, resumen: resumenCopia(datos) }
}
