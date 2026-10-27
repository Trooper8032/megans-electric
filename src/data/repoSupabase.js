// Capa de datos para la versión real (Supabase). NO está activa: la demostración usa repoLocal.js.
// Misma interfaz: cargar(), guardar(), restablecerDemo(). En la versión real cada acción de dominio.js se
// convierte en una función de base de datos (RPC) que valida el rol con las políticas RLS de supabase/schema.sql.
import { ErrorApp } from '../lib/dominio.js'
const noListo = () => { throw new ErrorApp('La conexión a Supabase todavía no está configurada. Lee supabase/README-MIGRACION.md.') }
export const repoSupabase = {
  nombre: 'supabase', cargar: noListo, guardar: noListo, restablecerDemo: noListo,
  // Preparado para Supabase Realtime: al conectar el cliente, escucha cambios en ventas/pagos y avisa a la app.
  // Uso: repoSupabase.suscribir(alCambiar, { cliente }) → cliente.channel('ventas').on('postgres_changes', …).subscribe()
  suscribir(alCambiar, { cliente = null } = {}) {
    if (!cliente) return () => {}
    const canal = cliente.channel('megans-ventas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, () => alCambiar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => alCambiar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venta_items' }, () => alCambiar())
      .subscribe()
    return () => cliente.removeChannel(canal)
  }
}
