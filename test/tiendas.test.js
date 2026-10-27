import { describe, it, expect } from 'vitest'
import { demo, S, AHORA, quien, prodConStock } from './ayuda.js'
import * as D from '../src/lib/dominio.js'

describe('tiendas externas y deuda', () => {
  it('envío: correlativo, descuenta stock, valor y deuda = enviado − pagado − devuelto', async () => {
    const db = await demo(), t = db.tiendas[0], p = prodConStock(db, 10), antes = D.cuentaTienda(db, t.id)
    const r = D.crearEnvio(db, S.coadmin, { tiendaId: t.id, items: [{ productoId: p.id, cantidad: 4 }], nota: 'Reposición' }, AHORA)
    expect(r.envio.id).toMatch(/^H001-\d{6}$/); expect(r.envio.estado).toBe('Enviado'); expect(r.envio.total).toBe(Math.round(4 * p.precio * 100) / 100)
    expect(r.db.productos.find(x => x.id === p.id).stock).toBe(p.stock - 4); expect(r.db.movimientos.at(-1)).toMatchObject({ tipo: 'envio', quien: 'U-COA' })
    const c = D.cuentaTienda(r.db, t.id)
    expect(c.enviado).toBeCloseTo(antes.enviado + r.envio.total, 2); expect(c.deuda).toBeCloseTo(c.enviado - c.pagado - c.devuelto, 2)
  })
  it('valida stock, tienda y productos', async () => {
    const db = await demo(), t = db.tiendas[0], p = prodConStock(db, 5)
    expect(quien(() => D.crearEnvio(db, S.admin, { tiendaId: 'X', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/Elige la tienda/)
    expect(quien(() => D.crearEnvio(db, S.admin, { tiendaId: t.id, items: [] }, AHORA))).toMatch(/al menos un producto/)
    expect(quien(() => D.crearEnvio(db, S.admin, { tiendaId: t.id, items: [{ productoId: p.id, cantidad: p.stock + 1 }] }, AHORA))).toMatch(/No hay stock suficiente/)
  })
  it('recepción por producto: marca diferencias, no se confirma dos veces', async () => {
    const db = await demo(), t = db.tiendas[0], base = D.cuentaTienda(db, t.id).diferenciasPorRevisar, a = prodConStock(db, 10), b = db.productos.find(x => x.id !== a.id && x.id !== 'PRD-999' && x.stock >= 10 && x.precio > 0)
    const e = D.crearEnvio(db, S.coadmin, { tiendaId: t.id, items: [{ productoId: a.id, cantidad: 5 }, { productoId: b.id, cantidad: 3 }] }, AHORA)
    expect(quien(() => D.confirmarRecepcion(e.db, S.coadmin, e.envio.id, { [a.id]: 5 }, AHORA))).toMatch(/Indica cuánto/)
    expect(quien(() => D.confirmarRecepcion(e.db, S.coadmin, e.envio.id, { [a.id]: 6, [b.id]: 3 }, AHORA))).toMatch(/entre 0 y 5/)
    const r = D.confirmarRecepcion(e.db, S.coadmin, e.envio.id, { [a.id]: 5, [b.id]: 1 }, AHORA)
    expect(r.envio.estado).toBe('Con diferencias'); expect(r.envio.recepcion.diferencias).toBe(1); expect(r.envio.items[1].recibido).toBe(1)
    expect(D.cuentaTienda(r.db, t.id).diferenciasPorRevisar).toBeCloseTo(base + 2 * b.precio, 2)
    expect(quien(() => D.confirmarRecepcion(r.db, S.coadmin, e.envio.id, { [a.id]: 5, [b.id]: 3 }, AHORA))).toMatch(/ya tiene/)
    const ok = D.confirmarRecepcion(e.db, S.coadmin, e.envio.id, { [a.id]: 5, [b.id]: 3 }, AHORA); expect(ok.envio.estado).toBe('Recibido completo')
  })
  it('pagos: validan monto, medio y no superan la deuda; devoluciones de tienda solo la administradora y vuelven al stock', async () => {
    const db = await demo(), t = db.tiendas[1], c0 = D.cuentaTienda(db, t.id)
    expect(c0.deuda).toBeGreaterThan(0)
    expect(quien(() => D.registrarPagoTienda(db, S.coadmin, { tiendaId: t.id, monto: 0, medio: 'Yape', operacion: '10000021' }, AHORA))).toMatch(/mayor que cero/)
    expect(quien(() => D.registrarPagoTienda(db, S.coadmin, { tiendaId: t.id, monto: 5, medio: 'Cheque' }, AHORA))).toMatch(/Efectivo, Yape o Plin/)
    expect(quien(() => D.registrarPagoTienda(db, S.coadmin, { tiendaId: t.id, monto: c0.deuda + 1, medio: 'Yape', operacion: '10000022' }, AHORA))).toMatch(/mayor que la deuda/)
    const p = D.registrarPagoTienda(db, S.coadmin, { tiendaId: t.id, monto: 10, medio: 'Yape', operacion: '10000023', nota: 'Abono' }, AHORA)
    expect(D.cuentaTienda(p.db, t.id).deuda).toBeCloseTo(c0.deuda - 10, 2); expect(D.cuentaTienda(p.db, t.id).pagado).toBeCloseTo(c0.pagado + 10, 2)
    const env = db.envios.find(e => e.tiendaId === t.id && e.recepcion), it = env.items[0], antes = db.productos.find(x => x.id === it.productoId).stock
    expect(quien(() => D.registrarDevolucionTienda(p.db, S.coadmin, { tiendaId: t.id, items: [{ productoId: it.productoId, cantidad: 1 }], motivo: 'Producto fallado' }, AHORA))).toMatch(/permiso/)
    expect(quien(() => D.registrarDevolucionTienda(p.db, S.admin, { tiendaId: t.id, items: [{ productoId: it.productoId, cantidad: 9999 }], motivo: 'Producto fallado' }, AHORA))).toMatch(/más/)
    const dv = D.registrarDevolucionTienda(p.db, S.admin, { tiendaId: t.id, items: [{ productoId: it.productoId, cantidad: 1 }], motivo: 'Producto fallado' }, AHORA)
    expect(dv.db.productos.find(x => x.id === it.productoId).stock).toBe(antes + 1); expect(dv.devolucion.monto).toBeGreaterThan(0)
    const c = D.cuentaTienda(dv.db, t.id); expect(c.deuda).toBeCloseTo(c.enviado - c.pagado - c.devuelto, 2)
    expect(c.movimientos.at(-1).saldo).toBeCloseTo(c.deuda, 2)
  })
  it('cuenta corriente de cada tienda cuadra con su saldo acumulado', async () => {
    const db = await demo()
    for (const t of db.tiendas) { const c = D.cuentaTienda(db, t.id); expect(c.movimientos.at(-1).saldo).toBeCloseTo(c.deuda, 2); expect(c.deuda).toBeGreaterThanOrEqual(0) }
  })
  it('guardar tienda valida nombre y celular', async () => {
    const db = await demo()
    expect(quien(() => D.guardarTienda(db, S.coadmin, { nombre: '' }))).toMatch(/nombre/)
    expect(quien(() => D.guardarTienda(db, S.coadmin, { nombre: 'Nueva', telefono: '12' }))).toMatch(/celular/)
    expect(D.guardarTienda(db, S.coadmin, { nombre: 'Nueva', telefono: '987 654 321' }).tienda.telefono).toBe('987654321')
    expect(quien(() => D.guardarTienda(db, S.v1, { nombre: 'Nueva' }))).toMatch(/permiso/)
  })
})
