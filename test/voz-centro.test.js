import { describe, it, expect } from 'vitest'
import { demo, S, AHORA, quien } from './ayuda.js'
import { entenderVenta, entenderComando, buscarUsuario } from '../src/lib/voz.js'
import { crearVenta, crearAdicional, solicitarDevolucion, aprobarDevolucion, rechazarDevolucion, ventaPorNumero, ultimaVentaDe, adicionalesDe, saldoDe, calcularCaja, vistaPara } from '../src/lib/dominio.js'
import { fechaISO } from '../src/lib/fechas.js'

const extra = [{ id: 'PRD-F1', nombre: 'Foco LED 9W', stock: 50, precio: 6, activo: true }, { id: 'PRD-C1', nombre: 'Cable 14', stock: 300, precio: 2, decimales: true, activo: true }, { id: 'PRD-C2', nombre: 'Cinta aislante', stock: 40, precio: 3, activo: true }]
const L = v => v.lineas.map(l => [l.cantidad, l.nombre || '?'])

describe('venta dicha en cualquier orden', async () => {
  const db = await demo(), P = [...db.productos, ...extra]
  it('«vendí 3 focos led y 2 interruptores a Juan en efectivo»', () => {
    const v = entenderVenta('vendí 3 focos led y 2 interruptores a Juan en efectivo', P)
    expect(v.cliente).toBe('Juan'); expect(v.medio).toBe('Efectivo')
    expect(L(v)).toEqual([[3, 'Foco LED 9W'], [2, 'Interruptor simple']])
  })
  it('cantidad después del producto y cliente suelto: «focos led tres, efectivo, Juan, interruptor dos»', () => {
    const v = entenderVenta('focos led tres, efectivo, Juan, interruptor dos', P)
    expect(v.cliente).toBe('Juan'); expect(v.medio).toBe('Efectivo')
    expect(L(v).map(x => x[0])).toEqual([3, 2]); expect(v.lineas[0].nombre).toBe('Foco LED 9W'); expect(v.lineas[1].nombre).toMatch(/^Interruptor/)
  })
  it('«en efectivo Juan me compró cinco metros de cable»', () => {
    const v = entenderVenta('en efectivo Juan me compró cinco metros de cable', P)
    expect(v).toMatchObject({ cliente: 'Juan', medio: 'Efectivo' }); expect(L(v)).toEqual([[5, 'Cable 14']])
  })
  it('el número que es parte del nombre no se toma como cantidad', () => {
    const v = entenderVenta('cable 14, yape', P); expect(L(v)).toEqual([[1, 'Cable 14']])
    expect(L(entenderVenta('caja de 24 polos', P))).toEqual([[1, 'Caja de 24 polos']])
  })
  it('el nombre del cliente no ensucia el producto, ni «a 4 soles» es cliente', () => {
    const v = entenderVenta('dos interruptores simples a 4 soles para Rosa con yape', P)
    expect(v.cliente).toBe('Rosa'); expect(v.lineas).toHaveLength(1); expect(v.lineas[0]).toMatchObject({ cantidad: 2, nombre: 'Interruptor simple', precio: 4 })
    expect(entenderVenta('tres interruptores simples a cuenta', P)).toMatchObject({ cliente: '', medio: 'Pendiente' })
  })
})

describe('comandos de inicio del centro de voz', async () => {
  const db = await demo(), P = [...db.productos, ...extra], U = db.usuarios
  const C = (t, o = {}) => entenderComando(t, P, { usuarios: U, ...o })
  it('Venta con vendedor dicho', () => {
    const o = C('Venta: 3 focos led, 2 interruptores simples, cliente Juan, efectivo, vendedor dos')
    expect(o.tipo).toBe('venta'); expect(o.venta).toMatchObject({ cliente: 'Juan', medio: 'Efectivo' }); expect(o.vendedor).toMatchObject({ id: 'U-V02' })
    expect(buscarUsuario('administradora', U).id).toBe('U-ADM')
  })
  it('Ingreso, Cobrar, Consulta, Ir a', () => {
    expect(C('Ingreso: 50 metros de cable 14')).toMatchObject({ tipo: 'ingreso', lineas: [{ cantidad: 50, nombre: 'Cable 14' }] })
    expect(C('Cobrar: Don Alberto, efectivo')).toMatchObject({ tipo: 'cobrar', medio: 'Efectivo', cliente: 'alberto' })
    expect(C('Cobrar: venta 609 con yape operación 12345678')).toMatchObject({ tipo: 'cobrar', numero: 609, medio: 'Yape', operacion: '12345678' })
    expect(C('Consulta: stock de interruptor simple')).toMatchObject({ tipo: 'pregunta', que: 'stock', producto: { producto: { id: 'PRD-065' } } })
    expect(C('Consulta: ¿quién me debe?')).toMatchObject({ tipo: 'pregunta', que: 'pendientes' })
    expect(C('Ir a: inventario')).toMatchObject({ tipo: 'ir', ruta: 'inventario' })
    expect(C('Ir a: caja')).toMatchObject({ tipo: 'ir', ruta: 'caja' })
  })
  it('Devolución con número de venta, cliente y motivo', () => {
    expect(C('Devolución: 1 interruptor simple de la venta 609, cliente Don Alberto, motivo estaba malogrado')).toMatchObject({ tipo: 'devolucion', numero: 609, cliente: 'Don Alberto', motivo: 'Defectuoso', lineas: [{ cantidad: 1, productoId: 'PRD-065' }] })
  })
  it('Agregar a una venta cerrada: por número o «la última de Juan»', () => {
    expect(C('Agregar a la venta 45: 2 cintas aislantes')).toMatchObject({ tipo: 'adicional', numero: 45, venta: { lineas: [{ cantidad: 2, productoId: 'PRD-C2' }] } })
    expect(C('agregar a la última venta de Juan dos interruptores simples')).toMatchObject({ tipo: 'adicional', ultima: true, cliente: 'Juan', venta: { lineas: [{ cantidad: 2 }] } })
  })
  it('con venta abierta: agregar, quitar, cerrar, cancelar', () => {
    expect(C('agregar 2 cintas', { abierta: true })).toMatchObject({ tipo: 'agregar', venta: { lineas: [{ cantidad: 2, productoId: 'PRD-C2' }] } })
    expect(C('quitar los focos', { abierta: true })).toMatchObject({ tipo: 'quitar', lineas: [{ productoId: 'PRD-F1' }] })
    expect(C('cerrar venta').tipo).toBe('cerrar'); expect(C('cancelar').tipo).toBe('cancelar')
  })
  it('sin comando de inicio sigue entendiendo (asistente de siempre o venta libre)', () => {
    expect(C('¿Cuántos interruptores simples quedan?')).toMatchObject({ tipo: 'pregunta', que: 'stock' })
    expect(C('vendí 2 interruptores simples a Juan en efectivo')).toMatchObject({ tipo: 'venta', venta: { cliente: 'Juan', medio: 'Efectivo' } })
    expect(C('hola qué tal').tipo).toBe('nada')
  })
})

describe('venta adicional enlazada (no cambia la original)', async () => {
  it('crea una venta nueva, descuenta stock y cobra solo lo nuevo', async () => {
    let db = await demo()
    const r1 = crearVenta(db, S.v1, { cliente: 'Juan Quispe', medio: 'Efectivo', items: [{ productoId: 'PRD-067', cantidad: 2 }] }, AHORA); db = r1.db
    const antes = structuredClone(db.ventas.find(v => v.id === r1.venta.id)), stock = db.productos.find(p => p.id === 'PRD-067').stock
    const r2 = crearAdicional(db, S.v1, r1.venta.id, { medio: 'Yape', operacion: '99887766', items: [{ productoId: 'PRD-067', cantidad: 3 }] }, AHORA); db = r2.db
    expect(r2.venta).toMatchObject({ adicionalDe: r1.venta.id, cliente: 'Juan Quispe' }); expect(r2.venta.total).toBeCloseTo(9.6)
    expect(db.ventas.find(v => v.id === r1.venta.id)).toEqual(antes)
    expect(db.productos.find(p => p.id === 'PRD-067').stock).toBe(stock - 3)
    expect(adicionalesDe(db, r1.venta.id).map(v => v.id)).toEqual([r2.venta.id])
    expect(ventaPorNumero(db, r1.venta.numero).id).toBe(r1.venta.id)
    expect(ultimaVentaDe(db, 'juan').id).toBe(r2.venta.id)
  })
  it('un vendedor no puede agregar a ventas de otro', async () => {
    const db = await demo(), otra = db.ventas.find(v => v.vendedorId === 'U-V02' && v.estado === 'Activa')
    expect(quien(() => crearAdicional(db, S.v1, otra.id, { medio: 'Efectivo', items: [{ productoId: 'PRD-067', cantidad: 1 }] }, AHORA))).toMatch(/propias/)
  })
  it('el vendedor por voz respeta permisos: un vendedor no registra a nombre de otro', async () => {
    const db = await demo()
    expect(quien(() => crearVenta(db, S.v1, { cliente: 'Juan', medio: 'Efectivo', vendedorId: 'U-V02', items: [{ productoId: 'PRD-067', cantidad: 1 }] }, AHORA))).toMatch(/a tu nombre/)
    expect(crearVenta(db, S.admin, { cliente: 'Juan', medio: 'Efectivo', vendedorId: 'U-V02', items: [{ productoId: 'PRD-067', cantidad: 1 }] }, AHORA).venta.vendedorId).toBe('U-V02')
  })
})

describe('devolución: siempre con aprobación manual de la administradora', async () => {
  const preparar = async (medio = 'Efectivo') => { const db = await demo(); const r = crearVenta(db, S.v1, { cliente: 'Juan', medio, items: [{ productoId: 'PRD-067', cantidad: 4 }] }, AHORA); return { db: r.db, v: r.venta } }
  it('la solicitud no mueve stock ni dinero', async () => {
    const { db, v } = await preparar(), st = db.productos.find(p => p.id === 'PRD-067').stock
    const r = solicitarDevolucion(db, S.v1, { ventaId: v.id, items: [{ productoId: 'PRD-067', cantidad: 1 }], motivo: 'Defectuoso' }, AHORA)
    expect(r.solicitud).toMatchObject({ estado: 'Pendiente', monto: 3.2 })
    expect(r.db.productos.find(p => p.id === 'PRD-067').stock).toBe(st); expect(r.db.devoluciones.length).toBe(db.devoluciones.length)
    expect(vistaPara(r.db, S.v1).solicitudesDev).toHaveLength(1); expect(vistaPara(r.db, S.v2).solicitudesDev).toHaveLength(0)
  })
  it('vendedor y co-administrador no pueden aprobar; la administradora sí: reingresa stock y ajusta caja', async () => {
    const { db, v } = await preparar(), st = db.productos.find(p => p.id === 'PRD-067').stock
    const s = solicitarDevolucion(db, S.v1, { ventaId: v.id, items: [{ productoId: 'PRD-067', cantidad: 2 }], motivo: 'Defectuoso' }, AHORA)
    expect(quien(() => aprobarDevolucion(s.db, S.v1, s.solicitud.id, {}, AHORA))).toMatch(/permiso/)
    expect(quien(() => aprobarDevolucion(s.db, S.coadmin, s.solicitud.id, {}, AHORA))).toMatch(/permiso/)
    const cajaAntes = calcularCaja(s.db, fechaISO(AHORA), 'U-V01').devoluciones
    const a = aprobarDevolucion(s.db, S.admin, s.solicitud.id, { medio: 'Efectivo' }, AHORA)
    expect(a.solicitud.estado).toBe('Aprobada')
    expect(a.db.productos.find(p => p.id === 'PRD-067').stock).toBe(st + 2)
    expect(calcularCaja(a.db, fechaISO(AHORA), 'U-V01').devoluciones).toBeCloseTo(cajaAntes + 6.4)
    expect(quien(() => aprobarDevolucion(a.db, S.admin, s.solicitud.id, {}, AHORA))).toMatch(/resuelta/)
  })
  it('si la venta era fiada, la devolución rebaja la deuda (no sale dinero de caja)', async () => {
    const { db, v } = await preparar('Pendiente')
    const s = solicitarDevolucion(db, S.v1, { ventaId: v.id, items: [{ productoId: 'PRD-067', cantidad: 1 }], motivo: 'Equivocación' }, AHORA)
    const a = aprobarDevolucion(s.db, S.admin, s.solicitud.id, { medio: 'Efectivo' }, AHORA)
    expect(saldoDe(a.db.ventas.find(x => x.id === v.id))).toBeCloseTo(4 * 3.2 - 3.2)
    expect(calcularCaja(a.db, fechaISO(AHORA), 'U-V01').devoluciones).toBe(calcularCaja(s.db, fechaISO(AHORA), 'U-V01').devoluciones)
  })
  it('no se puede pedir más de lo vendido (contando pendientes) y se puede rechazar', async () => {
    const { db, v } = await preparar()
    const s = solicitarDevolucion(db, S.v1, { ventaId: v.id, items: [{ productoId: 'PRD-067', cantidad: 3 }], motivo: 'Otro' }, AHORA)
    expect(quien(() => solicitarDevolucion(s.db, S.v1, { ventaId: v.id, items: [{ productoId: 'PRD-067', cantidad: 2 }], motivo: 'Otro' }, AHORA))).toMatch(/más/)
    expect(quien(() => solicitarDevolucion(db, S.v2, { ventaId: v.id, items: [{ productoId: 'PRD-067', cantidad: 1 }], motivo: 'Otro' }, AHORA))).toMatch(/propias/)
    const x = rechazarDevolucion(s.db, S.admin, s.solicitud.id, 'no corresponde', AHORA)
    expect(x.solicitud.estado).toBe('Rechazada'); expect(x.db.devoluciones.length).toBe(db.devoluciones.length)
  })
})
