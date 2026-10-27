// Roles y permisos: única regla que usan la interfaz, las rutas y la capa de datos.
export const ROLES = ['admin', 'coadmin', 'vendedor']
export const NOMBRE_ROL = { admin: 'Administradora', coadmin: 'Co-administrador', vendedor: 'Vendedor' }
const TODOS = ROLES, ADM = ['admin', 'coadmin'], SOLO_ADMIN = ['admin']
// acción -> roles que pueden. Nada se borra. Los 3 roles VENDEN igual; "anular" es solo de la administradora.
// Devoluciones y anulación: solo la administradora (decisión de Sandro). Elegir vendedor: administración.
export const ACCIONES = {
  vender: TODOS, agregarAVenta: TODOS, cobrarPendiente: TODOS, registrarPago: TODOS, verGuia: TODOS, verificarGuia: TODOS, editarPrecioVenta: TODOS, fotoVenta: TODOS,
  elegirVendedor: ADM, verTodasLasVentas: ADM, anular: SOLO_ADMIN, devolver: SOLO_ADMIN, verificarPago: SOLO_ADMIN, verConciliacion: SOLO_ADMIN, etiquetas: ADM,
  verCostos: SOLO_ADMIN, verUtilidad: SOLO_ADMIN, verPanel: ADM, verStockCompleto: ADM, verMovimientos: ADM,
  editarProducto: ADM, cambiarPrecio: SOLO_ADMIN, crearProducto: ADM, desactivarProducto: SOLO_ADMIN,
  ajustarStock: ADM, ingresarStock: ADM, contar: ADM,
  verTiendas: ADM, gestionarTiendas: ADM, verMisEnvios: ['vendedor'], devolverTienda: SOLO_ADMIN,
  cerrarCajaPropia: TODOS, cerrarCajaDia: ADM, reabrirCaja: SOLO_ADMIN,
  verCuaderno: ADM, exportar: ADM, respaldar: SOLO_ADMIN, restaurar: SOLO_ADMIN, restablecerDemo: SOLO_ADMIN, verUsuarios: SOLO_ADMIN
}
export const puede = (rol, accion) => !!ACCIONES[accion]?.includes(rol)
export const sesionValida = s => !!s && typeof s.id === 'string' && ROLES.includes(s.rol)
export const RUTAS = {
  inicio: TODOS, vender: TODOS, ventas: TODOS, inventario: ADM, tiendas: ADM, misenvios: ['vendedor'], caja: TODOS, cuaderno: ADM, conciliacion: SOLO_ADMIN, etiquetas: ADM, mas: TODOS
}
export const NAV = [
  { ruta: 'inicio', texto: 'Inicio', icono: 'grafico' },
  { ruta: 'vender', texto: 'Nueva venta', icono: 'carrito', destacado: true },
  { ruta: 'ventas', texto: 'Ventas del día', icono: 'archivo' },
  { ruta: 'inventario', texto: 'Inventario', icono: 'caja' },
  { ruta: 'tiendas', texto: 'Tiendas', icono: 'tienda' },
  { ruta: 'misenvios', texto: 'Mis envíos', icono: 'camion' },
  { ruta: 'caja', texto: 'Caja', icono: 'billete' },
  { ruta: 'cuaderno', texto: 'Cuaderno', icono: 'libro' },
  { ruta: 'conciliacion', texto: 'Conciliación de pagos', icono: 'escudo' },
  { ruta: 'etiquetas', texto: 'Etiquetas y escaneo', icono: 'escaner' },
  { ruta: 'mas', texto: 'Más', icono: 'ajustes' }
]
export const navPara = rol => NAV.filter(n => RUTAS[n.ruta].includes(rol)).map(n => rol === 'vendedor' && n.ruta === 'ventas' ? { ...n, texto: 'Mis ventas' } : rol === 'vendedor' && n.ruta === 'caja' ? { ...n, texto: 'Mi caja' } : n)
export const leerRuta = hash => { const m = /^#\/([a-z]+)(?:\/([A-Za-z0-9_-]{1,40}))?$/.exec(hash || ''); return m ? { ruta: m[1], id: m[2] || null } : { ruta: null, id: null } }
export const hashDe = (ruta, id = null) => `#/${ruta}${id ? '/' + id : ''}`
export function resolverRuta(sesion, hash) {
  const { ruta, id } = leerRuta(hash)
  if (!sesionValida(sesion)) return { permitido: false }
  if (!ruta) return { permitido: true, ruta: 'inicio', id: null }
  if (!RUTAS[ruta]) return { permitido: false, destino: 'inicio', mensaje: 'Esa página no existe. Te llevamos al inicio.' }
  if (!RUTAS[ruta].includes(sesion.rol)) return { permitido: false, destino: 'inicio', mensaje: 'Tu usuario no tiene permiso para ver esa página.' }
  return { permitido: true, ruta, id }
}
