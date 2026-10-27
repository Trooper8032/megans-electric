// Lo dictado en el asistente que debe terminar en otra pantalla (venta → Nueva venta, ingreso → Inventario). Solo en memoria.
let pendiente = null
const oyentes = new Set()
export const dejarPendiente = x => { pendiente = x; oyentes.forEach(f => f()) }
export const tomarPendiente = tipo => { const x = pendiente; if (x && x.tipo === tipo) { pendiente = null; return x } return null }
export const alPendiente = f => { oyentes.add(f); return () => oyentes.delete(f) }
