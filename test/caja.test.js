import { describe, it, expect } from 'vitest'
import { demo, S, AHORA, quien, prodConStock } from './ayuda.js'
import * as D from '../src/lib/dominio.js'
import { fechaISO, sumarDias } from '../src/lib/fechas.js'
import { alertas, ventasPorDia, ventasPorMes, ranking, deudasTiendas, cuadreCaja } from '../src/lib/metricas.js'
import { cuadernoDelDia, reporteCuadre } from '../src/lib/cuaderno.js'

const hoy = fechaISO(AHORA)
describe('caja y conciliación', () => {
  it('esperado por medio: ventas por medio − devoluciones + cobros; pendientes aparte', async () => {
    const db = await demo(), p = prodConStock(db, 10)
    const a = D.crearVenta(db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000002', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    const b = D.crearVenta(a.db, S.v1, { cliente: 'Cliente prueba', medio: 'Pendiente', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA)
    const antes = D.calcularCaja(db, hoy, 'U-V01'), c = D.calcularCaja(b.db, hoy, 'U-V01')
    // la caja cuadra solo con pagos verificados: el Yape del vendedor queda por verificar hasta que la administradora lo verifica
    expect(c.esperado.Yape).toBeCloseTo(antes.esperado.Yape, 2); expect(c.porVerificar.Yape).toBeCloseTo(antes.porVerificar.Yape + a.venta.total, 2); expect(c.pendientes.cantidad).toBe(antes.pendientes.cantidad + 1)
    const vf = D.verificarPago(b.db, S.admin, a.venta.id, a.venta.pagos[0].id, AHORA), c2 = D.calcularCaja(vf.db, hoy, 'U-V01')
    expect(c2.esperado.Yape).toBeCloseTo(antes.esperado.Yape + a.venta.total, 2); expect(c2.porVerificar.Yape).toBeCloseTo(antes.porVerificar.Yape, 2)
    expect(c.esperado.Efectivo).toBe(antes.esperado.Efectivo); expect(c.ventasTotal).toBeCloseTo(antes.ventasTotal + a.venta.total + b.venta.total, 2)
  })
  it('cierre de vendedor: exige contado y nota si hay diferencia, y queda bloqueado', async () => {
    const db = await demo(), c = D.calcularCaja(db, hoy, 'U-V01'), cont = { ...c.esperado }
    expect(quien(() => D.cerrarCaja(db, S.v1, { fecha: hoy, vendedorId: 'U-V01', contado: { Efectivo: 1 } }, AHORA))).toMatch(/cuánto contaste/)
    expect(quien(() => D.cerrarCaja(db, S.v1, { fecha: hoy, vendedorId: 'U-V01', contado: { ...cont, Efectivo: cont.Efectivo + 2 } }, AHORA))).toMatch(/diferencia/)
    expect(quien(() => D.cerrarCaja(db, S.v1, { fecha: hoy, vendedorId: 'U-V02', contado: cont }, AHORA))).toMatch(/propia/)
    expect(quien(() => D.cerrarCaja(db, S.v1, { fecha: sumarDias(hoy, 1), vendedorId: 'U-V01', contado: cont }, AHORA))).toMatch(/todavía no llega/)
    const r = D.cerrarCaja(db, S.v1, { fecha: hoy, vendedorId: 'U-V01', contado: { ...cont, Efectivo: cont.Efectivo - 2 }, nota: 'Sencillo dado de más' }, AHORA)
    expect(r.cierre.diferencia.Efectivo).toBe(-2); expect(r.cierre.diferenciaTotal).toBe(-2); expect(r.cierre.estado).toBe('Cerrada')
    const p = prodConStock(r.db, 5)
    expect(quien(() => D.crearVenta(r.db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000003', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/ya está cerrada/)
    expect(D.crearVenta(r.db, S.v2, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000004', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA).venta.id).toBeTruthy() // el otro vendedor sigue
    const v1 = r.db.ventas.find(v => v.vendedorId === 'U-V01' && v.fecha === hoy)
    expect(quien(() => D.agregarAVenta(r.db, S.v1, v1.id, [{ productoId: p.id, cantidad: 1 }], AHORA))).toMatch(/cerrada/)
    expect(quien(() => D.cerrarCaja(r.db, S.v1, { fecha: hoy, vendedorId: 'U-V01', contado: cont }, AHORA))).toMatch(/ya está cerrada/)
  })
  it('cierre del día bloquea a todos; solo la administradora reabre con motivo y queda registrado', async () => {
    const db = await demo(), c = D.calcularCaja(db, hoy, null)
    const r = D.cerrarCaja(db, S.coadmin, { fecha: hoy, contado: c.esperado }, AHORA), p = prodConStock(r.db, 5)
    expect(quien(() => D.crearVenta(r.db, S.v2, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000005', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/cerrada/)
    expect(quien(() => D.reabrirCaja(r.db, S.coadmin, r.cierre.id, 'Faltó una venta', AHORA))).toMatch(/permiso/)
    expect(quien(() => D.reabrirCaja(r.db, S.admin, r.cierre.id, 'x', AHORA))).toMatch(/motivo/)
    const ab = D.reabrirCaja(r.db, S.admin, r.cierre.id, 'Faltó anotar una venta', AHORA)
    expect(ab.cierre.estado).toBe('Reabierta'); expect(ab.cierre.historial.at(-1).que).toMatch(/Motivo: Faltó anotar/); expect(ab.db.bitacora.at(-1).quien).toBe('U-ADM')
    expect(D.crearVenta(ab.db, S.v2, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000006', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA).venta.id).toBeTruthy()
    expect(quien(() => D.reabrirCaja(ab.db, S.admin, r.cierre.id, 'otra vez más', AHORA))).toMatch(/no está cerrada/)
  })
  it('los pagos de tiendas suman al esperado del día y devoluciones lo restan', async () => {
    const db = await demo(), t = db.tiendas[1], antes = D.calcularCaja(db, hoy, null)
    const p = D.registrarPagoTienda(db, S.coadmin, { tiendaId: t.id, monto: 10, medio: 'Plin', operacion: '10000007' }, AHORA)
    expect(D.calcularCaja(p.db, hoy, null).esperado.Plin).toBeCloseTo(antes.esperado.Plin + 10, 2); expect(D.calcularCaja(p.db, hoy, 'U-V01').cobrosTiendas).toBe(0)
    const v = db.ventas.find(x => x.fecha === hoy && x.medio === 'Efectivo' && x.estado === 'Activa'), pr = v.items[0]
    const d = D.registrarDevolucion(db, S.admin, { ventaId: v.id, productoId: pr.productoId, cantidad: 1, motivo: 'Defectuoso', medio: 'Efectivo' }, AHORA)
    expect(D.calcularCaja(d.db, hoy, null).esperado.Efectivo).toBeCloseTo(antes.esperado.Efectivo - pr.precio, 2)
  })
  it('el demo trae días cerrados con diferencias, una reapertura y el día de hoy abierto', async () => {
    const db = await demo()
    expect(db.cierres.some(c => c.diferenciaTotal !== 0 && c.nota)).toBe(true); expect(db.cierres.some(c => c.historial.some(h => /Reabrió/.test(h.que)))).toBe(true)
    expect(D.cierreDe(db, hoy, null)).toBeUndefined(); expect(D.cierreDe(db, sumarDias(hoy, -1), null).estado).toBe('Cerrada')
  })
})
describe('panel, alertas y cuaderno', () => {
  it('series y rankings tienen datos coherentes', async () => {
    const db = await demo(), dias = ventasPorDia(db, hoy, 14), meses = ventasPorMes(db, hoy, 4)
    expect(dias.length).toBe(14); expect(dias.at(-1).fecha).toBe(hoy); expect(dias.some(d => d.valor > 0)).toBe(true)
    expect(meses.length).toBe(4); expect(meses.at(-1).valor).toBeGreaterThan(0); expect(meses.every(m => m.utilidad < m.valor)).toBe(true)
    const r = ranking(db, hoy); expect(r.length).toBe(8); expect(r[0].unidades).toBeGreaterThanOrEqual(r[7].unidades)
    expect(deudasTiendas(db)[0].deuda).toBeGreaterThanOrEqual(deudasTiendas(db)[1].deuda); expect(cuadreCaja(db, hoy, 7).length).toBe(7)
    const al = alertas(db, hoy); expect(al.some(a => a.tipo === 'stock')).toBe(true); expect(al.some(a => a.tipo === 'caja')).toBe(true)
  })
  it('cuaderno del día lista cada venta y su total coincide con las ventas activas', async () => {
    const db = await demo(), c = cuadernoDelDia(db, sumarDias(hoy, -3))
    const act = db.ventas.filter(v => v.fecha === sumarDias(hoy, -3) && v.estado === 'Activa')
    expect(c.filas.length).toBe(db.ventas.filter(v => v.fecha === sumarDias(hoy, -3)).length)
    expect(c.totalDia).toBeCloseTo(act.reduce((s, v) => s + v.total, 0), 2)
    expect(Object.values(c.porMedio).reduce((a, b) => a + b, 0)).toBeCloseTo(c.totalDia, 2)
    const rc = reporteCuadre(db, hoy, 7); expect(rc.length).toBe(7); expect(rc.some(f => f.diferencia !== 0 && f.diferencia !== null)).toBe(true)
  })
})
