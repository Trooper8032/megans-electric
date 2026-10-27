import { describe, it, expect } from 'vitest'
import { demo, S, AHORA, quien, prodConStock } from './ayuda.js'
import * as D from '../src/lib/dominio.js'
import { puede, resolverRuta, navPara } from '../src/lib/permisos.js'
import { fechaISO, sumarDias } from '../src/lib/fechas.js'

describe('permisos por rol (capa de datos)', () => {
  it('tabla de permisos: vendedor solo vende; coadmin no borra ni cambia precios', () => {
    expect(puede('vendedor', 'vender')).toBe(true)
    for (const a of ['anular', 'devolver', 'elegirVendedor', 'verCostos', 'verUtilidad', 'verPanel', 'cambiarPrecio', 'ajustarStock', 'verTiendas', 'exportar', 'reabrirCaja', 'verCuaderno']) expect(puede('vendedor', a), a).toBe(false)
    expect(puede('coadmin', 'verUtilidad')).toBe(false); expect(puede('coadmin', 'verCostos')).toBe(false); expect(puede('admin', 'verCostos')).toBe(true)
    for (const a of ['anular', 'devolver', 'cambiarPrecio', 'desactivarProducto', 'reabrirCaja', 'restaurar', 'devolverTienda']) expect(puede('coadmin', a), a).toBe(false)
    for (const a of ['anular', 'devolver', 'cambiarPrecio', 'reabrirCaja', 'restaurar', 'verUsuarios']) expect(puede('admin', a), a).toBe(true)
  })
  it('el vendedor no puede anular, devolver ventas ajenas ni cambiar precios aunque llame a la capa de datos', async () => {
    const db = await demo(), v = db.ventas.find(x => x.estado === 'Activa' && x.fecha === fechaISO(AHORA) && x.vendedorId !== 'U-V01')
    expect(quien(() => D.anularVenta(db, S.v1, v.id, 'quiero anularla', AHORA))).toMatch(/permiso/)
    expect(quien(() => D.registrarDevolucion(db, S.v1, { ventaId: v.id, productoId: v.items[0].productoId, cantidad: 1, motivo: 'Defectuoso' }, AHORA))).toMatch(/permiso/)
    const p = prodConStock(db)
    expect(quien(() => D.guardarProducto(db, S.v1, { id: p.id, nombre: p.nombre, minimo: p.minimo, precio: 1 }, AHORA))).toMatch(/permiso/)
    expect(quien(() => D.ajustarStock(db, S.v1, p.id, 3, 'prueba de ajuste', AHORA))).toMatch(/permiso/)
    expect(quien(() => D.crearEnvio(db, S.v1, { tiendaId: db.tiendas[0].id, items: [{ productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/permiso/)
  })
  it('el co-administrador edita pero no cambia precios, no anula ni reabre cajas', async () => {
    const db = await demo(), p = prodConStock(db)
    const r = D.guardarProducto(db, S.coadmin, { id: p.id, nombre: p.nombre + ' X', minimo: p.minimo + 1, categoria: p.categoria }, AHORA)
    expect(r.producto.nombre.endsWith(' X')).toBe(true); expect(r.producto.precio).toBe(p.precio)
    expect(quien(() => D.guardarProducto(db, S.coadmin, { id: p.id, nombre: p.nombre, minimo: p.minimo, precio: p.precio + 1 }, AHORA))).toMatch(/administradora/)
    expect(quien(() => D.guardarProducto(db, S.coadmin, { id: p.id, nombre: p.nombre, minimo: p.minimo, costo: p.costo + 1 }, AHORA))).toMatch(/administradora/)
    expect(quien(() => D.anularVenta(db, S.coadmin, db.ventas.at(-1).id, 'motivo largo', AHORA))).toMatch(/permiso/)
    expect(quien(() => D.reabrirCaja(db, S.coadmin, db.cierres[0].id, 'motivo largo', AHORA))).toMatch(/permiso/)
    expect(quien(() => D.activarProducto(db, S.coadmin, p.id, false, AHORA))).toMatch(/permiso/)
  })
  it('la administradora sí cambia precios y queda en la bitácora', async () => {
    const db = await demo(), p = prodConStock(db)
    const r = D.guardarProducto(db, S.admin, { id: p.id, nombre: p.nombre, minimo: p.minimo, precio: p.precio + 1 }, AHORA)
    expect(r.producto.precio).toBe(p.precio + 1); expect(r.db.bitacora.at(-1).que).toMatch(/precio/)
  })
  it('sesión de usuario inexistente o desactivado se rechaza', async () => {
    const db = await demo()
    expect(quien(() => D.vistaPara(db, { id: 'U-NADIE' }))).toMatch(/sesión/)
    const d2 = structuredClone(db); d2.usuarios.find(u => u.id === 'U-V01').activo = false
    expect(quien(() => D.crearVenta(d2, S.v1, { cliente: 'Cliente prueba', medio: 'Yape', operacion: '10000001', items: [] }, AHORA))).toMatch(/sesión/)
  })
  it('la vista del vendedor no trae costos, movimientos, ventas ajenas ni envíos que no lleva', async () => {
    const db = await demo(), v = D.vistaPara(db, S.v1)
    expect(v.productos.every(p => !('costo' in p))).toBe(true)
    expect(v.ventas.length).toBeGreaterThan(0); expect(v.ventas.every(x => x.vendedorId === 'U-V01')).toBe(true)
    expect(v.ventas.every(x => x.items.every(l => !('costo' in l)))).toBe(true)
    expect(v.envios.length).toBeGreaterThan(0); expect(v.envios.every(e => e.llevaId === 'U-V01')).toBe(true); expect(v.tiendas.every(t => v.envios.some(e => e.tiendaId === t.id))).toBe(true); expect(v.movimientos).toEqual([]); expect(v.pagosTienda.every(p => v.envios.some(e => e.id === p.envioId))).toBe(true)
    const co = D.vistaPara(db, S.coadmin); expect(co.productos.every(p => !('costo' in p))).toBe(true); expect(co.ventas.every(x => x.items.every(l => !('costo' in l)))).toBe(true)
    expect(v.usuarios.every(u => !('hash' in u))).toBe(true)
    const a = D.vistaPara(db, S.admin); expect(a.productos[0]).toHaveProperty('costo'); expect(a.usuarios.every(u => !('hash' in u))).toBe(true)
  })
  it('rutas por rol', () => {
    expect(resolverRuta({ id: 'x', rol: 'vendedor' }, '#/inventario').permitido).toBe(false)
    expect(resolverRuta({ id: 'x', rol: 'vendedor' }, '#/vender').permitido).toBe(true)
    expect(resolverRuta({ id: 'x', rol: 'coadmin' }, '#/tiendas').permitido).toBe(true)
    expect(resolverRuta(null, '#/vender').permitido).toBe(false)
    expect(navPara('vendedor').map(n => n.ruta)).toEqual(['inicio', 'vender', 'ventas', 'misenvios', 'caja', 'mas'])
    expect(navPara('admin').length).toBe(10); expect(navPara('coadmin').map(n => n.ruta)).not.toContain('conciliacion'); expect(navPara('coadmin').map(n => n.ruta)).toContain('etiquetas')
    expect(resolverRuta({ id: 'x', rol: 'coadmin' }, '#/conciliacion').permitido).toBe(false); expect(resolverRuta({ id: 'x', rol: 'vendedor' }, '#/etiquetas').permitido).toBe(false)
  })
})
