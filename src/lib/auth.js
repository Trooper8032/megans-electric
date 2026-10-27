// Autenticación de demostración (los datos viven en el navegador). En producción: servidor + bcrypt + sesión del servidor.
import { config } from '../config/app.config.js'
export async function hashClave(clave, sal = '') {
  const datos = new TextEncoder().encode(sal + ':' + clave)
  const h = await globalThis.crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')
}
export const normUsuario = u => String(u ?? '').trim().toLowerCase()
// intentos: { [usuario]: { n, hasta } }. Devuelve { ok, usuario?, error?, intentos }
export async function iniciarSesion(usuarios, usuario, clave, intentos = {}, ahora = Date.now()) {
  const u = normUsuario(usuario)
  if (!u || !String(clave ?? '')) return { ok: false, error: 'Escribe tu usuario y tu contraseña.', intentos }
  const reg = { ...(intentos[u] || { n: 0, hasta: 0 }) }
  if (reg.hasta > ahora) return { ok: false, error: `Demasiados intentos. Espera ${Math.ceil((reg.hasta - ahora) / 60000)} minuto(s) e inténtalo de nuevo.`, intentos }
  const p = usuarios.find(x => normUsuario(x.usuario) === u && x.activo !== false)
  if (p && p.hash === await hashClave(clave, normUsuario(p.usuario))) {
    const { [u]: _quitado, ...resto } = intentos
    return { ok: true, usuario: { id: p.id, usuario: p.usuario, nombre: p.nombre, rol: p.rol }, intentos: resto }
  }
  reg.n += 1
  if (reg.n >= config.maxIntentos) { reg.n = 0; reg.hasta = ahora + config.bloqueoMin * 60000 }
  return { ok: false, error: 'Usuario o contraseña incorrectos.', intentos: { ...intentos, [u]: reg } }
}
