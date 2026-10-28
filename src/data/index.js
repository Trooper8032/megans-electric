// Punto único de acceso a los datos. Para pasar a Supabase, cambia esta línea por repoSupabase.
import { repoLocal } from './repoLocal.js'
import { vistaPara, actor, exigir, clon } from '../lib/dominio.js'
import { crearRespaldo, leerRespaldo } from '../lib/respaldo.js'
export const repo = repoLocal
// Ejecuta una acción de dominio con permisos, la guarda y devuelve la vista que corresponde al rol.
export async function ejecutar(accion, sesion, ...args) {
  const db = await repo.cargar()
  const r = accion(db, sesion, ...args)
  await repo.guardar(r.db)
  const ref = (r.venta || r.envio || r.conteo || r.cierre || r.pago || r.devolucion || r.solicitud || r.producto || r.tienda)?.id
  return { ref, vista: vistaPara(r.db, sesion) }
}
export async function leer(sesion) { return vistaPara(await repo.cargar(), sesion) }
export async function dbCompleta(sesion, accion = null) { const db = await repo.cargar(); return accion ? (exigir(db, sesion, accion), db) : (actor(db, sesion), db) }
export async function exportarRespaldo(sesion, ahora = new Date()) {
  const db = await repo.cargar(); exigir(db, sesion, 'respaldar')
  const d = clon(db); d.ultimoRespaldo = ahora.toISOString(); await repo.guardar(d)
  return crearRespaldo(d, ahora)
}
export async function restaurarRespaldo(sesion, texto) {
  const db = await repo.cargar(); exigir(db, sesion, 'restaurar')
  const { datos, resumen } = leerRespaldo(texto)
  if (!datos.usuarios.some(u => u.id === sesion.id && u.rol === 'admin')) throw new Error('La copia no incluye a tu usuario como administradora. No se restauró nada.')
  await repo.guardar(datos); return { resumen, vista: vistaPara(datos, sesion) }
}
export async function restablecerDemo(sesion) {
  const db = await repo.cargar(); exigir(db, sesion, 'restablecerDemo')
  const nuevo = await repo.restablecerDemo(); return vistaPara(nuevo, sesion)
}
// ---- Sesión: acceso con bloqueo por intentos (guardado en el navegador) ----
import { iniciarSesion } from '../lib/auth.js'
import { crearSesion, guardarSesion, leerIntentos, guardarIntentos } from '../lib/sesion.js'
import { config } from '../config/app.config.js'
export const CLAVE_SESION = `${config.clave}:sesion`, CLAVE_INTENTOS = `${config.clave}:intentos`
export async function autenticar(usuario, clave, almacen = globalThis.localStorage, ahora = Date.now()) {
  const db = await repo.cargar()
  const r = await iniciarSesion(db.usuarios, usuario, clave, leerIntentos(almacen, CLAVE_INTENTOS), ahora)
  guardarIntentos(almacen, CLAVE_INTENTOS, r.intentos)
  if (!r.ok) return { ok: false, error: r.error }
  const sesion = crearSesion(r.usuario, ahora); guardarSesion(almacen, CLAVE_SESION, sesion)
  return { ok: true, sesion }
}
