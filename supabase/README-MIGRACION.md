# Migración a Supabase (guía para cuando se decida)

Estado actual: **no existe ningún proyecto Supabase**. La demostración guarda todo en el navegador (localStorage). Este archivo explica cómo pasar a una base real sin cambiar las pantallas.

## Pasos
1. Crear un proyecto en Supabase (región cercana) y guardar la URL y la clave pública (anon) en `.env` (copiar de `.env.example`). La clave de servicio nunca va en el navegador.
2. En el editor SQL, ejecutar `supabase/schema.sql` completo. Crea tablas, reglas, RLS por rol y los buckets privados `firmas` y `respaldos`.
3. En Authentication crear los usuarios y llenar `perfiles` (usuario, nombre, rol: admin, coadmin, vendedor). Cambiar las claves de demostración por claves reales.
4. Implementar `src/data/repoSupabase.js` con la misma interfaz que `repoLocal.js` (cargar, guardar, restablecerDemo). Cada acción de `src/lib/dominio.js` se vuelve una función RPC en la base, para que stock, caja y correlativos se calculen en el servidor.
5. Importar los datos reales: descargar el respaldo JSON desde la pantalla Más y cargarlo con un script que inserte en el orden: perfiles, productos, productos_costos, tiendas, ventas, venta_items, movimientos, envios, pagos, devoluciones, cierres.
6. Probar cada rol con el mismo guion del E2E (`scripts/e2e.py`) apuntando a la versión conectada.

## Qué cubre el esquema
- **Roles por política (RLS):** vendedor solo ve y crea sus ventas, sin costos; coadmin ve y edita pero no borra ni cambia precios (trigger); admin hace todo.
- **Nada se borra:** no hay políticas DELETE y hay triggers que bloquean borrar o editar historial, bitácora, movimientos, devoluciones y pagos.
- **Anular, devolver y reabrir caja:** solo administradora; la reapertura exige motivo.
- **Caja cerrada:** bloquea ventas nuevas de ese día.
- **Buckets privados:** `firmas` (PNG, 256 KB) y `respaldos` (JSON, 8 MB), sin acceso público.

## Pendientes para producción
- Mover el descuento de stock y la numeración de guías a funciones RPC (hoy la aplicación local los calcula).
- Limitar con una RPC la actualización de stock por vendedores (la política actual deja actualizar productos al personal para descontar stock).
- Envío automático de WhatsApp (API oficial), notificaciones push y facturación SUNAT requieren servidor y proveedor.
- Respaldos programados y registro de intentos de acceso en el servidor.
