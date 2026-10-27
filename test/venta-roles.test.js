// La esencia de la venta (recuperada del Apps Script): los 3 roles venden igual; reglas de precio, stock, Otros, devoluciones y anulación.
import { describe, it, expect } from 'vitest'
import { demo, S, AHORA, quien, prodConStock } from './ayuda.js'
import * as D from '../src/lib/dominio.js'
import { puede, navPara } from '../src/lib/permisos.js'
import { fechaISO } from '../src/lib/fechas.js'

const hoy = fechaISO(AHORA)
const FOTO = 'data:image/jpeg;base64,' + 'A'.repeat(2000)
const stock = (db, id) => db.productos.find(p => p.id === id).stock

describe('vender: los 3 roles', () => {
  it('administradora, co-administrador y vendedor registran una venta (capa de datos)', async () => {
    const db = await demo(), p = prodConStock(db, 10)
    for (const [ses, id] of [[S.admin, 'U-ADM'], [S.coadmin, 'U-COA'], [S.v1, 'U-V01']]) {
      const { db: d, venta } = D.crearVenta(db, ses, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: 2 }] }, AHORA)
      expect(venta.vendedorId).toBe(id); expect(venta.registradoPor).toBe(id); expect(venta.estadoCobro).toBe('Cobrado')
      expect(stock(d, p.id)).toBe(p.stock - 2)
    }
    for (const r of ['admin', 'coadmin', 'vendedor']) { expect(puede(r, 'vender')).toBe(true); expect(navPara(r)[1]).toMatchObject({ ruta: 'vender', texto: 'Nueva venta', destacado: true }) }
  })
  it('vendedor elegido de la lista: administración puede elegir; el vendedor solo a su nombre', async () => {
    const db = await demo(), p = prodConStock(db)
    const { venta } = D.crearVenta(db, S.admin, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000027', vendedorId: 'U-V02', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    expect(venta.vendedorId).toBe('U-V02'); expect(venta.registradoPor).toBe('U-ADM'); expect(venta.historial[0].que).toMatch(/a nombre de Vendedor 2/)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000028', vendedorId: 'U-V02', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/a tu nombre/)
    expect(quien(() => D.crearVenta(db, S.coadmin, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000029', vendedorId: 'U-NADIE', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/de la lista/)
    expect(D.vendedoresPara(db, { id: 'U-V01', rol: 'vendedor' }).map(u => u.id)).toEqual(['U-V01'])
    expect(D.vendedoresPara(db, { id: 'U-ADM', rol: 'admin' }).length).toBe(4)
  })
  it('el vendedor sigue sin ver costos ni anular', async () => {
    const db = await demo(), v = D.vistaPara(db, S.v1)
    expect(v.productos.every(p => !('costo' in p))).toBe(true); expect(puede('vendedor', 'anular')).toBe(false); expect(puede('vendedor', 'verCostos')).toBe(false)
  })
})

describe('reglas de la venta', () => {
  it('"Otros" con texto "Qué se vendió" no mueve stock', async () => {
    const db = await demo(), antes = stock(db, 'PRD-999'), nMov = db.movimientos.length
    const { db: d, venta } = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: 'PRD-999', cantidad: 3, precio: 2.5, detalle: 'Cinta aislante' }] }, AHORA)
    expect(venta.items[0].nombre).toBe('Otros: Cinta aislante'); expect(venta.total).toBe(7.5)
    expect(stock(d, 'PRD-999')).toBe(antes); expect(d.movimientos.length).toBe(nMov)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: 'PRD-999', cantidad: 1, precio: 2 }] }, AHORA))).toMatch(/qué se vendió/)
  })
  it('precio editado (descuento de mostrador) guarda el precio original y queda en el historial', async () => {
    const db = await demo(), p = prodConStock(db), nuevo = Math.round((p.precio - 0.5) * 100) / 100
    const { venta } = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Plin', operacion: '10000030', items: [{ productoId: p.id, cantidad: 2, precio: nuevo }] }, AHORA)
    expect(venta.items[0]).toMatchObject({ precio: nuevo, precioLista: p.precio, precioEditado: true }); expect(venta.total).toBe(Math.round(nuevo * 2 * 100) / 100)
    expect(venta.historial.some(h => /Precio de mostrador/.test(h.que))).toBe(true)
    const sin = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Plin', operacion: '10000031', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA).venta.items[0]
    expect(sin).toMatchObject({ precio: p.precio, precioEditado: false })
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Plin', operacion: '10000032', items: [{ productoId: p.id, cantidad: 1, precio: 0 }] }, AHORA))).toMatch(/no es válido/)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Plin', operacion: '10000033', items: [{ productoId: p.id, cantidad: 1, precio: 'abc' }] }, AHORA))).toMatch(/no es válido/)
  })
  it('rechaza la venta si no hay stock, con mensaje claro, y no cambia nada', async () => {
    const db = await demo(), p = prodConStock(db)
    const msg = quien(() => D.crearVenta(db, S.coadmin, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: p.stock + 1 }] }, AHORA))
    expect(msg).toBe(`No hay stock suficiente de "${p.nombre}". Hay ${p.stock} y pediste ${p.stock + 1}.`)
    expect(quien(() => D.crearVenta(db, S.admin, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: p.stock }, { productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/No hay stock suficiente/)
    expect(stock(db, p.id)).toBe(p.stock)
  })
  it('foto de la venta: se guarda comprimida y se rechaza si no es imagen o pesa demasiado', async () => {
    const db = await demo(), p = prodConStock(db)
    expect(D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000034', foto: FOTO, items: [{ productoId: p.id, cantidad: 1 }] }, AHORA).venta.foto).toBe(FOTO)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000035', foto: 'javascript:alert(1)', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/foto/)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000036', foto: 'data:image/jpeg;base64,' + 'A'.repeat(D.FOTO_MAX), items: [{ productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/foto/)
    const { db: d, venta } = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000037', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    expect(D.guardarFotoVenta(d, S.v1, venta.id, FOTO, AHORA).venta.foto).toBe(FOTO)
    expect(quien(() => D.guardarFotoVenta(d, S.v2, venta.id, FOTO, AHORA))).toMatch(/propias/)
  })
  it('pendiente pasa a cobrado (estado de cobro)', async () => {
    const db = await demo(), p = prodConStock(db)
    const { db: d, venta } = D.crearVenta(db, S.v1, { cliente: 'Don Luis', medio: 'Pendiente', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    expect(venta.estadoCobro).toBe('Pendiente'); expect(D.estadoCobro(venta)).toBe('Pendiente')
    const r = D.cobrarPendiente(d, S.v1, venta.id, 'Yape', AHORA, { operacion: '10000040' })
    expect(r.venta.estadoCobro).toBe('Cobrado'); expect(D.estadoCobro(r.venta)).toBe('Cobrado'); expect(r.venta.cobro.medio).toBe('Yape')
    expect(quien(() => D.cobrarPendiente(r.db, S.v1, venta.id, 'Yape', AHORA, { operacion: '10000041' }))).toMatch(/no está pendiente|ya fue cobrada/)
  })
  it('devolución: solo la administradora, ligada a una venta, con motivo y reingreso de stock', async () => {
    const db = await demo(), p = prodConStock(db)
    const { db: d, venta } = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: 3 }] }, AHORA)
    const r = D.registrarDevolucion(d, S.admin, { ventaId: venta.id, productoId: p.id, cantidad: 2, motivo: 'Defectuoso', reingresa: true, foto: FOTO }, AHORA)
    expect(stock(r.db, p.id)).toBe(p.stock - 3 + 2); expect(r.devolucion).toMatchObject({ ventaId: venta.id, motivo: 'Defectuoso', reingresa: true, cantidad: 2, foto: FOTO })
    expect(r.db.movimientos.at(-1)).toMatchObject({ tipo: 'devolucion', cantidad: 2, quien: 'U-ADM' })
    expect(stock(D.registrarDevolucion(d, S.admin, { ventaId: venta.id, productoId: p.id, cantidad: 1, motivo: 'Otro', reingresa: false }, AHORA).db, p.id)).toBe(p.stock - 3)
    for (const ses of [S.v1, S.v2, S.coadmin]) expect(quien(() => D.registrarDevolucion(d, ses, { ventaId: venta.id, productoId: p.id, cantidad: 1, motivo: 'Defectuoso' }, AHORA))).toMatch(/permiso/)
    expect(quien(() => D.registrarDevolucion(d, S.admin, { productoId: p.id, cantidad: 1, motivo: 'Defectuoso' }, AHORA))).toMatch(/venta activa/)
    expect(quien(() => D.registrarDevolucion(d, S.admin, { ventaId: venta.id, productoId: p.id, cantidad: 1, motivo: 'X' }, AHORA))).toMatch(/motivo/)
  })
  it('anular: solo la administradora, sin borrar, y el stock vuelve', async () => {
    const db = await demo(), p = prodConStock(db)
    const { db: d, venta } = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: 2 }] }, AHORA)
    expect(quien(() => D.anularVenta(d, S.v1, venta.id, 'motivo largo', AHORA))).toMatch(/permiso/)
    expect(quien(() => D.anularVenta(d, S.coadmin, venta.id, 'motivo largo', AHORA))).toMatch(/permiso/)
    const r = D.anularVenta(d, S.admin, venta.id, 'Cliente se arrepintió', AHORA)
    expect(r.db.ventas.length).toBe(d.ventas.length); expect(r.venta).toMatchObject({ estado: 'Anulada', estadoCobro: 'Anulada' }); expect(stock(r.db, p.id)).toBe(p.stock)
  })
  it('agregar productos a la venta del día con precio editado conserva el historial', async () => {
    const db = await demo(), p = prodConStock(db, 6)
    const { db: d, venta } = D.crearVenta(db, S.coadmin, { cliente: 'Cliente prueba', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    const r = D.agregarAVenta(d, S.admin, venta.id, [{ productoId: p.id, cantidad: 1, precio: p.precio - 0.1 }], AHORA)
    expect(r.venta.items.length).toBe(2); expect(r.venta.items[1].precioEditado).toBe(true); expect(r.venta.historial.at(-1).quien).toBe('U-ADM')
  })
})

describe('favoritos y más vendidos', () => {
  it('cada usuario marca sus favoritos (máx. 12) y la vista del vendedor solo trae los suyos', async () => {
    const db = await demo(), p = prodConStock(db)
    const r = D.marcarFavorito(db, S.v1, p.id); expect(D.favoritosDe(r.db, 'U-V01')).toEqual([p.id])
    expect(D.favoritosDe(D.marcarFavorito(r.db, S.v1, p.id).db, 'U-V01')).toEqual([])
    const r2 = D.marcarFavorito(r.db, S.admin, p.id); expect(D.vistaPara(r2.db, S.v1).favoritos).toEqual({ 'U-V01': [p.id] })
    expect(quien(() => D.marcarFavorito(db, S.v1, 'PRD-999'))).toMatch(/no existe/)
  })
  it('más vendidos: productos con más unidades en 30 días, sin "Otros"', async () => {
    const db = await demo(), top = D.masVendidos(db, hoy, 30, 8)
    expect(top.length).toBe(8); expect(top).not.toContain('PRD-999')
  })
})

describe('decisiones de Sandro (etapa A)', () => {
  it('cantidades enteras por defecto; "permite decimales" por producto, desactivado en todos', async () => {
    const db = await demo(), p = prodConStock(db)
    expect(db.productos.every(x => x.decimales === false)).toBe(true)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Ana', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: 1.5 }] }, AHORA))).toMatch(/entero/)
    const d2 = D.guardarProducto(db, S.admin, { id: p.id, nombre: p.nombre, minimo: p.minimo, unidad: 'metro', decimales: true }, AHORA).db
    const { venta, db: d3 } = D.crearVenta(d2, S.v1, { cliente: 'Ana', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: '2,5' }] }, AHORA)
    expect(venta.items[0].cantidad).toBe(2.5); expect(stock(d3, p.id)).toBeCloseTo(p.stock - 2.5)
    expect(quien(() => D.crearVenta(d2, S.v1, { cliente: 'Ana', medio: 'Efectivo', items: [{ productoId: p.id, cantidad: 1.2345 }] }, AHORA))).toMatch(/3 decimales/)
  })
  it('foto opcional por cada línea, además de la foto general, y se puede poner después', async () => {
    const db = await demo(), [a, b] = db.productos.filter(x => x.id !== 'PRD-999' && x.stock > 2 && x.precio > 0)
    const { venta, db: d } = D.crearVenta(db, S.v1, { cliente: 'Ana', medio: 'Yape', operacion: '10000038', foto: FOTO, items: [{ productoId: a.id, cantidad: 1, foto: FOTO }, { productoId: b.id, cantidad: 1 }] }, AHORA)
    expect(venta.foto).toBe(FOTO); expect(venta.items[0].foto).toBe(FOTO); expect(venta.items[1].foto).toBe(null)
    expect(quien(() => D.crearVenta(db, S.v1, { cliente: 'Ana', medio: 'Yape', operacion: '10000039', items: [{ productoId: a.id, cantidad: 1, foto: 'data:text/html,x' }] }, AHORA))).toMatch(/foto/)
    const r = D.guardarFotoLinea(d, S.v1, venta.id, 1, FOTO, AHORA); expect(r.venta.items[1].foto).toBe(FOTO)
    expect(quien(() => D.guardarFotoLinea(d, S.v2, venta.id, 1, FOTO, AHORA))).toMatch(/propias/)
  })
  it('el nombre del comprador es obligatorio en todas las ventas', async () => {
    const db = await demo(), p = prodConStock(db)
    for (const c of [undefined, '', ' ', 'A', '<>']) expect(quien(() => D.crearVenta(db, S.admin, { cliente: c, medio: 'Efectivo', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/nombre del cliente/)
    expect(db.ventas.every(v => v.cliente.trim().length >= 2)).toBe(true)
  })
})

describe('decisiones de Sandro (etapas B y D): pagos, verificación y conciliación', () => {
  it('pagos parciales con medio, nro. de operación obligatorio en Yape/Plin y foto opcional; la guía guarda todo en el historial', async () => {
    const db = await demo(), p = prodConStock(db)
    const { db: d, venta } = D.crearVenta(db, S.v1, { cliente: 'Ana', medio: 'Pendiente', items: [{ productoId: p.id, cantidad: 2 }] }, AHORA)
    expect(D.estadoCobro(venta)).toBe('Pendiente')
    expect(quien(() => D.registrarPago(d, S.v1, venta.id, { medio: 'Yape', monto: 1 }, AHORA))).toMatch(/número de operación de Yape/)
    expect(quien(() => D.registrarPago(d, S.v1, venta.id, { medio: 'Efectivo', monto: venta.total + 1 }, AHORA))).toMatch(/mayor que lo que falta/)
    expect(quien(() => D.registrarPago(d, S.v2, venta.id, { medio: 'Efectivo', monto: 1 }, AHORA))).toMatch(/propias/)
    const r1 = D.registrarPago(d, S.v1, venta.id, { medio: 'Yape', monto: 1, operacion: '55554444', foto: FOTO }, AHORA)
    expect(r1.pago).toMatchObject({ medio: 'Yape', monto: 1, operacion: '55554444', foto: FOTO, estado: 'Por verificar', quien: 'U-V01' })
    expect(D.estadoCobro(r1.venta)).toBe('Parcial'); expect(D.saldoDe(r1.venta)).toBeCloseTo(venta.total - 1, 2)
    const r2 = D.registrarPago(r1.db, S.v1, venta.id, { medio: 'Efectivo', monto: D.saldoDe(r1.venta) }, AHORA)
    expect(r2.pago.estado).toBe('Verificado'); expect(D.estadoCobro(r2.venta)).toBe('Cobrado')
    expect(r2.venta.historial.filter(h => /^Pago de/.test(h.que)).length).toBe(2)
    expect(quien(() => D.registrarPago(r2.db, S.v1, venta.id, { medio: 'Efectivo', monto: 1 }, AHORA))).toMatch(/ya fue cobrada/)
  })
  it('solo la administradora verifica pagos; la caja cuadra solo con pagos verificados', async () => {
    const db = await demo(), p = prodConStock(db), hoy = '2026-10-18'
    const { db: d, venta } = D.crearVenta(db, S.v1, { cliente: 'Ana', medio: 'Plin', operacion: '777111', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    const pg = venta.pagos[0]; expect(pg.estado).toBe('Por verificar')
    for (const s of [S.v1, S.coadmin]) expect(quien(() => D.verificarPago(d, s, venta.id, pg.id, AHORA))).toMatch(/permiso/)
    const antes = D.calcularCaja(d, hoy, 'U-V01'), v = D.verificarPago(d, S.admin, venta.id, pg.id, AHORA), despues = D.calcularCaja(v.db, hoy, 'U-V01')
    expect(v.pago).toMatchObject({ estado: 'Verificado', verificadoPor: 'U-ADM' }); expect(despues.esperado.Plin).toBeCloseTo(antes.esperado.Plin + venta.total, 2)
    expect(quien(() => D.verificarPago(v.db, S.admin, venta.id, pg.id, AHORA))).toMatch(/ya estaba verificado/)
  })
  it('conciliación diaria por medio: esperado vs verificado, operaciones duplicadas y pendientes sin cobrar', async () => {
    const db = await demo(), p = prodConStock(db), hoy = '2026-10-18'
    const a = D.crearVenta(db, S.v1, { cliente: 'Ana', medio: 'Yape', operacion: '99990000', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    const b = D.crearVenta(a.db, S.v2, { cliente: 'Luis', medio: 'Yape', operacion: '99990000', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    expect(b.venta.pagos[0].duplicado).toBe(true); expect(b.venta.historial.at(-1).que).toMatch(/repetido/)
    const c = D.conciliacion(b.db, hoy), y = c.filas.find(f => f.medio === 'Yape')
    expect(y.esperado).toBeCloseTo(y.verificado + y.porVerificar, 2); expect(y.porVerificar).toBeGreaterThanOrEqual(a.venta.total + b.venta.total - 0.001)
    expect(c.duplicados.some(g => g[0].operacion === '99990000' && g.length === 2)).toBe(true)
    expect(c.pendientes.every(x => x.saldo > 0)).toBe(true); expect(c.pendientes.length).toBeGreaterThan(0)
  })
  it('migración: ventas antiguas reciben su pago histórico como Verificado', async () => {
    const { migrar } = await import('../src/data/migraciones.js')
    const db = await demo(), viejo = structuredClone(db); viejo.version = 4; viejo.ventas.forEach(v => { delete v.pagos })
    const m = migrar(viejo), cob = m.ventas.filter(v => v.estado === 'Activa' && (v.medio !== 'Pendiente' || v.cobro))
    expect(cob.every(v => v.pagos.length === 1 && v.pagos[0].estado === 'Verificado')).toBe(true)
  })
})
