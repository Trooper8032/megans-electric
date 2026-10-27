// Sesión con vencimiento por inactividad y bloqueo persistente tras intentos fallidos.
import { sesionValida } from './permisos.js'
export const VENCE_MS = 15 * 60 * 1000
export const crearSesion = (datos, ahora = Date.now()) => ({ ...datos, inicio: ahora, ultimo: ahora })
export const vencida = (s, ahora = Date.now(), max = VENCE_MS) => !s || !Number.isFinite(s.ultimo) || ahora - s.ultimo > max
export const tocar = (s, ahora = Date.now()) => (s ? { ...s, ultimo: ahora } : s)
export const minutosRestantes = (s, ahora = Date.now(), max = VENCE_MS) => Math.max(0, Math.ceil((s.ultimo + max - ahora) / 60000))
// Devuelve { sesion, motivo }: motivo = 'vencida' | 'invalida' | null
export function leerSesion(almacen, clave, ahora = Date.now(), max = VENCE_MS) {
  let crudo = null
  try { crudo = almacen.getItem(clave) } catch { return { sesion: null, motivo: null } }
  if (!crudo) return { sesion: null, motivo: null }
  let s = null
  try { s = JSON.parse(crudo) } catch { s = null }
  if (!sesionValida(s)) { borrarSesion(almacen, clave); return { sesion: null, motivo: 'invalida' } }
  if (vencida(s, ahora, max)) { borrarSesion(almacen, clave); return { sesion: null, motivo: 'vencida' } }
  return { sesion: s, motivo: null }
}
export const guardarSesion = (almacen, clave, s) => { try { almacen.setItem(clave, JSON.stringify(s)) } catch { /* sin espacio: la sesión sigue en memoria */ } }
export const borrarSesion = (almacen, clave) => { try { almacen.removeItem(clave) } catch { /* nada */ } }
export const MENSAJE_VENCIDA = 'Tu sesión se cerró por inactividad. Ingresa de nuevo.'
// Intentos fallidos guardados en el navegador para que recargar la página no los reinicie.
export function leerIntentos(almacen, clave) {
  try { const o = JSON.parse(almacen.getItem(clave) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {} } catch { return {} }
}
export const guardarIntentos = (almacen, clave, intentos) => { try { almacen.setItem(clave, JSON.stringify(intentos)) } catch { /* nada */ } }
