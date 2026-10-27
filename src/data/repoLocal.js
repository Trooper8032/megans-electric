// Capa de datos para la demostración: todo en localStorage (~5 MB por navegador). Misma interfaz que repoSupabase.js.
import { config } from '../config/app.config.js'
import { crearDemo } from './seed.js'
import { migrar, versionDe } from './migraciones.js'
import { validarCopia } from '../lib/respaldo.js'
import { ErrorApp } from '../lib/dominio.js'
const K = c => `${config.clave}:${c}`
const almacen = () => globalThis.localStorage
let cache = null, ultimo = null // ultimo: texto guardado que corresponde a la caché
const leerTexto = () => { try { return almacen().getItem(K('datos')) } catch { return null } }
export const repoLocal = {
  nombre: 'local',
  async cargar() {
    // Si otra pestaña (p. ej. la administradora asignando una venta) guardó cambios, se recargan antes de usar la caché.
    const t = leerTexto()
    if (cache && t === ultimo) return cache
    let db = null
    try { if (t) db = migrar(JSON.parse(t)); if (db && validarCopia(db)) db = null } catch { db = null }
    if (!db) { db = await crearDemo(new Date()); await this.guardar(db); return db }
    cache = db; ultimo = t; return db
  },
  async guardar(db) {
    const t = JSON.stringify(db)
    try { almacen().setItem(K('datos'), t) } catch { throw new ErrorApp('No hay espacio en este navegador para guardar. Descarga un respaldo y libera datos.') }
    cache = db; ultimo = t
  },
  async restablecerDemo() { cache = null; try { almacen().removeItem(K('datos')) } catch { /* nada */ } return this.cargar() },
  espacioUsado() { try { return (almacen().getItem(K('datos')) || '').length * 2 } catch { return 0 } },
  versionGuardada() { try { return versionDe(JSON.parse(almacen().getItem(K('datos')))) } catch { return null } },
  olvidarCache() { cache = null; ultimo = null },
  // Cambios al instante entre pestañas/apps del mismo navegador: evento "storage" + sondeo de respaldo cada pocos segundos.
  // En producción, repoSupabase.suscribir usa Supabase Realtime (ver supabase/schema.sql: publicación supabase_realtime).
  suscribir(alCambiar, cadaMs = 3000) {
    const revisar = () => { const t = leerTexto(); if (t && t !== ultimo) { cache = null; alCambiar() } }
    const alStorage = e => { if (!e.key || e.key === K('datos')) revisar() }
    globalThis.addEventListener?.('storage', alStorage)
    const iv = setInterval(revisar, cadaMs)
    return () => { globalThis.removeEventListener?.('storage', alStorage); clearInterval(iv) }
  }
}
