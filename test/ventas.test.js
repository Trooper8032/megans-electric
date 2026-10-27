import { describe, it, expect } from 'vitest'
import { demo, S, AHORA, quien, prodConStock } from './ayuda.js'
import * as D from '../src/lib/dominio.js'
import { fechaISO, sumarDias } from '../src/lib/fechas.js'
import { codigoGuia, verificarGuia } from '../src/lib/verificacion.js'

const hoy = fechaISO(AHORA)
describe('catálogo y demo', () => {
  it('replica los 68 productos de la base anterior', async () => {
    const db = await demo()
    expect(db.productos.length).toBe(68); expect(db.productos.find(p => p.id === 'PRD-001').nombre).toBe('Caja de 2 polos')
    expect(db.productos.find(p => p.id === 'PRD-067').nombre).toBe('Interruptor triple'); expect(db.productos.find(p => p.id === 'PRD-999').nombre).toBe('Otros')
    expect(db.productos.every(p => p.stock >= 0)).toBe(true); expect(db.usuarios.map(u => u.usuario)).toEqual(['admin', 'coadmin', 'vendedor1', 'vendedor2'])
  })
  it('hay ventas de varios días, vendedores, medios, tiendas y cierres', async () => {
    const db = await demo()
    expect(new Set(db.ventas.map(v => v.fecha)).size).toBeGreaterThan(60); expect(new Set(db.ventas.map(v => v.vendedorId)).size).toBeGreaterThanOrEqual(3)
    for (const m of ['Efectivo', 'Yape', 'Plin', 'Pendiente']) expect(db.ventas.some(v => v.medio === m)).toBe(true)
    expect(db.tiendas.length).toBe(2); expect(db.envios.length).toBeGreaterThan(6); expect(db.pagosTienda.length).toBeGreaterThan(3); expect(db.devolucionesTienda.length).toBeGreaterThan(0)
    expect(db.conteos.length).toBe(3); expect(db.devoluciones.length).toBeGreaterThan(1); expect(db.ventas.some(v => v.estado === 'Anulada')).toBe(true)
    expect(db.ventas.filter(v => v.fecha === hoy).length).toBeGreaterThan(2)
  })
  it('el stock del demo coincide con la suma de sus movimientos', async () => {
    const db = await demo()
    for (const p of db.productos.filter(p => p.id !== 'PRD-999')) expect(db.movimientos.filter(m => m.productoId === p.id).reduce((s, m) => s + m.cantidad, 0), p.id).toBe(p.stock)
  })
})
describe('ventas', () => {
  it('registra una venta con correlativo, descuenta stock y deja movimiento con autor', async () => {
    const db = await demo(), p = prodConStock(db), ult = db.contadores.guia
    const { db: d, venta } = D.crearVenta(db, S.v1, { cliente: 'Prueba', medio: 'Yape', operacion: '10000008', items: [{ productoId: p.id, cantidad: 2 }] }, AHORA)
    expect(venta.id).toBe(`G001-${String(ult + 1).padStart(6, '0')}`); expect(venta.total).toBe(Math.round(p.precio * 2 * 100) / 100)
    expect(d.productos.find(x => x.id === p.id).stock).toBe(p.stock - 2)
    const m = d.movimientos.at(-1); expect(m).toMatchObject({ tipo: 'venta', cantidad: -2, quien: 'U-V01', ref: venta.id })
    expect(db.productos.find(x => x.id === p.id).stock).toBe(p.stock) // la base original no se muta
  })
  it('valida medio, cantidad, stock, precio y celular', async () => {
    const db = await demo(), p = prodConStock(db)
    const it = [{ productoId: p.id, cantidad: 1 }]
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Tarjeta', items: it }, AHORA))).toMatch(/Elige cómo pagó/)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000009', items: [] }, AHORA))).toMatch(/al menos un producto/)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000010', items: [{ productoId: p.id, cantidad: 0 }] }, AHORA))).toMatch(/entero mayor/)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000011', items: [{ productoId: p.id, cantidad: 1.5 }] }, AHORA))).toMatch(/entero mayor/)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000012', items: [{ productoId: p.id, cantidad: p.stock + 1 }] }, AHORA))).toMatch(/No hay stock suficiente/)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000013', items: [{ productoId: p.id, cantidad: p.stock }, { productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/No hay stock suficiente/)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000014', items: [{ productoId: 'NOEXISTE', cantidad: 1 }] }, AHORA))).toMatch(/ya no existe/)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000015', telefono: '123', items: it }, AHORA))).toMatch(/celular/)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000016', items: [{ productoId: 'PRD-999', cantidad: 1 }] }, AHORA))).toMatch(/Otros/)
    const r = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: 'PRD-999', cantidad: 2, detalle: 'Cable 2 m', precio: 4.5 }] }, AHORA)
    expect(r.venta.total).toBe(9); expect(r.venta.items[0].nombre).toBe('Otros: Cable 2 m')
  })
  it('limpia textos peligrosos del cliente', async () => {
    const db = await demo(), p = prodConStock(db)
    const r = D.crearVenta(db, S.v1, { cliente: '<img src=x onerror=1>  Juan\n', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    expect(r.venta.cliente).not.toMatch(/[<>]/)
  })
  it('AGREGAR productos después: total, stock, versión e historial (quién, cuándo, qué)', async () => {
    const db = await demo(), p = prodConStock(db, 6), q = db.productos.find(x => x.id !== p.id && x.id !== 'PRD-999' && x.stock > 3 && x.precio > 0)
    const a = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Plin', operacion: '10000017', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    const luego = new Date(AHORA.getTime() + 3600000)
    const b = D.agregarAVenta(a.db, S.v1, a.venta.id, [{ productoId: q.id, cantidad: 2 }], luego)
    const v = b.venta
    expect(v.items.length).toBe(2); expect(v.total).toBe(Math.round((p.precio + 2 * q.precio) * 100) / 100); expect(v.version).toBe(2)
    expect(v.id).toBe(a.venta.id); expect(v.numero).toBe(a.venta.numero)
    expect(v.historial.at(-1)).toMatchObject({ quien: 'U-V01', cuando: luego.toISOString() }); expect(v.historial.at(-1).que).toMatch(/Agregó 2 ×/)
    expect(b.db.productos.find(x => x.id === q.id).stock).toBe(q.stock - 2)
    expect(b.db.movimientos.at(-1)).toMatchObject({ tipo: 'agregado', quien: 'U-V01', ref: v.id })
    expect(codigoGuia(v)).not.toBe(codigoGuia(a.venta)) // el código cambia al cambiar la venta
    // el co-administrador también puede agregar y queda su nombre
    const c = D.agregarAVenta(b.db, S.coadmin, v.id, [{ productoId: q.id, cantidad: 1 }], luego)
    expect(c.venta.historial.at(-1).quien).toBe('U-COA'); expect(c.venta.items.at(-1).agregadoPor).toBe('U-COA')
  })
  it('reglas de agregado: solo propias y de hoy para vendedores; anuladas no', async () => {
    const db = await demo(), p = prodConStock(db, 6)
    const a = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Plin', operacion: '10000018', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    expect(quien(() => D.agregarAVenta(a.db, S.v2, a.venta.id, [{ productoId: p.id, cantidad: 1 }], AHORA))).toMatch(/propias/)
    const manana = new Date(AHORA.getTime() + 86400000)
    expect(quien(() => D.agregarAVenta(a.db, S.v1, a.venta.id, [{ productoId: p.id, cantidad: 1 }], manana))).toMatch(/de hoy/)
    const an = D.anularVenta(a.db, S.admin, a.venta.id, 'Se registró mal', AHORA)
    expect(quien(() => D.agregarAVenta(an.db, S.admin, a.venta.id, [{ productoId: p.id, cantidad: 1 }], AHORA))).toMatch(/anulada/)
    expect(quien(() => D.agregarAVenta(a.db, S.v1, 'G001-999999', [{ productoId: p.id, cantidad: 1 }], AHORA))).toMatch(/No se encontró/)
  })
  it('anular no borra: queda registrada, devuelve el stock y exige motivo', async () => {
    const db = await demo(), p = prodConStock(db, 6)
    const a = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: 3 }] }, AHORA)
    expect(quien(() => D.anularVenta(a.db, S.admin, a.venta.id, 'x', AHORA))).toMatch(/motivo/)
    const n = a.db.ventas.length, r = D.anularVenta(a.db, S.admin, a.venta.id, 'Cliente se arrepintió', AHORA)
    expect(r.db.ventas.length).toBe(n); expect(r.venta.estado).toBe('Anulada'); expect(r.venta.anulacion.quien).toBe('U-ADM')
    expect(r.db.productos.find(x => x.id === p.id).stock).toBe(p.stock)
    expect(quien(() => D.anularVenta(r.db, S.admin, a.venta.id, 'otra vez más', AHORA))).toMatch(/ya estaba anulada/)
  })
  it('devolución: registrada, con tope, motivo y reingreso opcional', async () => {
    const db = await demo(), p = prodConStock(db, 6)
    const a = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: 3 }] }, AHORA)
    const arg = { ventaId: a.venta.id, productoId: p.id, cantidad: 2, motivo: 'Defectuoso', reingresa: true }
    const r = D.registrarDevolucion(a.db, S.admin, arg, AHORA)
    expect(r.devolucion.monto).toBe(Math.round(2 * p.precio * 100) / 100); expect(r.db.productos.find(x => x.id === p.id).stock).toBe(p.stock - 1)
    expect(quien(() => D.registrarDevolucion(r.db, S.admin, { ...arg, cantidad: 2 }, AHORA))).toMatch(/más de lo que se vendió/)
    expect(quien(() => D.registrarDevolucion(r.db, S.admin, { ...arg, cantidad: 1, motivo: 'Capricho' }, AHORA))).toMatch(/motivo/)
    const sin = D.registrarDevolucion(r.db, S.admin, { ...arg, cantidad: 1, reingresa: false }, AHORA)
    expect(sin.db.productos.find(x => x.id === p.id).stock).toBe(p.stock - 1)
    expect(quien(() => D.anularVenta(sin.db, S.admin, a.venta.id, 'Se anula todo lo demás', AHORA))).toMatch(/devoluciones registradas/)
  })
  it('cobrar una venta pendiente la pasa al medio de cobro y queda en el historial', async () => {
    const db = await demo(), p = prodConStock(db, 6)
    const a = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Pendiente', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    expect(quien(() => D.cobrarPendiente(a.db, S.v1, a.venta.id, 'Pendiente', AHORA))).toMatch(/Efectivo, Yape o Plin/)
    const c = D.cobrarPendiente(a.db, S.v1, a.venta.id, 'Yape', AHORA, { operacion: '10000019' })
    expect(c.venta.cobro.medio).toBe('Yape'); expect(quien(() => D.cobrarPendiente(c.db, S.v1, a.venta.id, 'Yape', AHORA, { operacion: '10000020' }))).toMatch(/ya fue cobrada/)
    expect(D.calcularCaja(c.db, hoy, 'U-V01').cobrosPendientes).toBeGreaterThanOrEqual(c.venta.total)
  })
  it('guía: verificación detecta cambios y anulación', async () => {
    const db = await demo(), p = prodConStock(db, 6)
    const a = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    const cod = codigoGuia(a.venta)
    expect(verificarGuia(a.db, a.venta.id, cod).ok).toBe(true); expect(verificarGuia(a.db, a.venta.id.toLowerCase(), cod.toLowerCase()).ok).toBe(true)
    expect(verificarGuia(a.db, a.venta.id, 'AAAA-BBBB-CCCC').ok).toBe(false); expect(verificarGuia(a.db, 'G001-000000', cod).mensaje).toMatch(/No existe/)
    const b = D.agregarAVenta(a.db, S.v1, a.venta.id, [{ productoId: p.id, cantidad: 1 }], AHORA)
    expect(verificarGuia(b.db, a.venta.id, cod).mensaje).toMatch(/cambiada/)
    const an = D.anularVenta(a.db, S.admin, a.venta.id, 'Prueba de anulación', AHORA); expect(verificarGuia(an.db, a.venta.id, cod).mensaje).toMatch(/ANULADA/)
  })
})

describe('demo a cualquier hora', () => {
  it.each([[0, 2], [0, 30], [6, 0], [23, 59]])('se crea sin errores a las %i:%i', async (h, m) => {
    const { crearDemo } = await import('../src/data/seed.js')
    const db = await crearDemo(new Date(2026, 9, 19, h, m))
    expect(db.ventas.length).toBeGreaterThan(300)
  })
})
