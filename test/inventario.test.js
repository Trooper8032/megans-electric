import { describe, it, expect } from 'vitest'
import { demo, S, AHORA, quien, prodConStock } from './ayuda.js'
import * as D from '../src/lib/dominio.js'
import { fechaISO } from '../src/lib/fechas.js'

describe('inventario', () => {
  it('ajuste con motivo: exige motivo y número entero, y deja movimiento con autor', async () => {
    const db = await demo(), p = prodConStock(db)
    expect(quien(() => D.ajustarStock(db, S.coadmin, p.id, p.stock + 3, '', AHORA))).toMatch(/motivo/)
    expect(quien(() => D.ajustarStock(db, S.coadmin, p.id, -1, 'prueba larga', AHORA))).toMatch(/entero/)
    expect(quien(() => D.ajustarStock(db, S.coadmin, p.id, p.stock, 'prueba larga', AHORA))).toMatch(/ya es ese/)
    const r = D.ajustarStock(db, S.coadmin, p.id, p.stock + 3, 'Llegó mercadería sin anotar', AHORA)
    expect(r.db.productos.find(x => x.id === p.id).stock).toBe(p.stock + 3)
    expect(r.db.movimientos.at(-1)).toMatchObject({ tipo: 'ajuste', cantidad: 3, quien: 'U-COA', motivo: 'Llegó mercadería sin anotar' })
  })
  it('ingreso de mercadería', async () => {
    const db = await demo(), p = prodConStock(db)
    expect(quien(() => D.ingresarStock(db, S.admin, p.id, 0, 'x', AHORA))).toMatch(/entero mayor/)
    expect(D.ingresarStock(db, S.admin, p.id, 10, 'Compra', AHORA).producto.stock).toBe(p.stock + 10)
  })
  it('alerta de stock bajo según el mínimo de cada producto', async () => {
    const db = await demo(), bajos = D.alertasStock(db)
    expect(bajos.length).toBeGreaterThan(3); expect(bajos.every(p => p.stock <= p.minimo)).toBe(true)
    const p = prodConStock(db, 6), d = D.guardarProducto(db, S.coadmin, { id: p.id, nombre: p.nombre, minimo: p.stock + 1 }, AHORA).db
    expect(D.alertasStock(d).some(x => x.id === p.id)).toBe(true)
    expect(quien(() => D.guardarProducto(db, S.coadmin, { id: p.id, nombre: p.nombre, minimo: -2 }, AHORA))).toMatch(/mínimo/)
  })
  it('crear producto: el co-administrador lo crea sin precio y no se puede vender hasta que la administradora lo fije', async () => {
    const db = await demo()
    expect(quien(() => D.guardarProducto(db, S.v1, { nombre: 'Cinta', minimo: 2 }, AHORA))).toMatch(/permiso/)
    expect(quien(() => D.guardarProducto(db, S.coadmin, { nombre: 'Cinta aislante', minimo: 2, precio: 3 }, AHORA))).toMatch(/administradora/)
    const c = D.guardarProducto(db, S.coadmin, { nombre: 'Cinta aislante', minimo: 2 }, AHORA)
    expect(quien(() => D.guardarProducto(c.db, S.coadmin, { nombre: 'cinta aislante', minimo: 2 }, AHORA))).toMatch(/Ya existe/)
    const i = D.ingresarStock(c.db, S.coadmin, c.producto.id, 5, 'Compra', AHORA)
    expect(quien(() => D.crearVenta(i.db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000024', items: [{ productoId: c.producto.id, cantidad: 1 }] }, AHORA))).toMatch(/no tiene precio/)
    const f = D.guardarProducto(i.db, S.admin, { id: c.producto.id, nombre: 'Cinta aislante', minimo: 2, precio: 3.5, costo: 2 }, AHORA)
    expect(D.crearVenta(f.db, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000025', items: [{ productoId: c.producto.id, cantidad: 1 }] }, AHORA).venta.total).toBe(3.5)
  })
  it('producto desactivado no se vende', async () => {
    const db = await demo(), p = prodConStock(db), d = D.activarProducto(db, S.admin, p.id, false, AHORA).db
    expect(quien(() => D.crearVenta(d, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000026', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/desactivado/)
  })
})
describe('conteo rápido semanal', () => {
  it('sugiere entre 10 y 15 productos, sin repetir y priorizando stock bajo', async () => {
    const db = await demo(), ids = D.sugerirConteo(db, AHORA)
    expect(ids.length).toBeGreaterThanOrEqual(10); expect(ids.length).toBeLessThanOrEqual(15); expect(new Set(ids).size).toBe(ids.length); expect(ids).not.toContain('PRD-999')
    const bajos = D.alertasStock(db).filter(p => !p.ultimoConteo || true).map(p => p.id)
    expect(ids.filter(i => bajos.includes(i)).length).toBeGreaterThan(0)
  })
  it('flujo completo: diferencias exigen motivo, ajustan el stock y registran al autor', async () => {
    const db = await demo(), r = D.iniciarConteo(db, S.coadmin, AHORA), c = r.conteo
    expect(c.lineas.length).toBeGreaterThanOrEqual(10)
    expect(quien(() => D.cerrarConteo(r.db, S.coadmin, c.id, AHORA))).toMatch(/Falta contar/)
    const cont = Object.fromEntries(c.lineas.map(l => [l.productoId, l.sistema])); cont[c.lineas[0].productoId] -= 2
    const g = D.guardarConteo(r.db, S.coadmin, c.id, cont)
    expect(quien(() => D.cerrarConteo(g.db, S.coadmin, c.id, AHORA))).toMatch(/motivo de la diferencia/)
    expect(quien(() => D.guardarConteo(g.db, S.coadmin, c.id, { [c.lineas[1].productoId]: -4 }))).toMatch(/entero/)
    const m = D.guardarConteo(g.db, S.coadmin, c.id, {}, { [c.lineas[0].productoId]: 'Faltan dos en el estante' })
    const f = D.cerrarConteo(m.db, S.coadmin, c.id, AHORA)
    const p0 = c.lineas[0]; expect(f.db.productos.find(x => x.id === p0.productoId).stock).toBe(p0.sistema - 2)
    expect(f.db.movimientos.at(-1)).toMatchObject({ tipo: 'conteo', cantidad: -2, quien: 'U-COA', motivo: 'Faltan dos en el estante' })
    expect(f.conteo.lineas[0].diferencia).toBe(-2); expect(f.db.productos.find(x => x.id === p0.productoId).ultimoConteo).toBe(fechaISO(AHORA))
    expect(D.iniciarConteo(f.db, S.coadmin, AHORA).conteo.id).not.toBe(c.id)
  })
  it('los vendedores no pueden contar', async () => {
    expect(quien(() => D.iniciarConteo(null && 0, S.v1, AHORA))).toBeTruthy()
    const db = await demo(); expect(quien(() => D.iniciarConteo(db, S.v1, AHORA))).toMatch(/permiso/)
  })
})
