import { describe, it, expect } from 'vitest'
import * as D from '../src/lib/dominio.js'
import { demo, S, AHORA, quien, prodConStock } from './ayuda.js'

describe('v3: tiendas, envíos y códigos', () => {
  it('hay 2 tiendas de ejemplo y se pueden renombrar y agregar', async () => {
    const db = await demo(); expect(db.tiendas.length).toBe(2)
    const r = D.guardarTienda(db, S.admin, { id: db.tiendas[0].id, nombre: 'Tienda Centro', encargado: 'Ana', telefono: '987654321' })
    expect(r.tienda.nombre).toBe('Tienda Centro')
    expect(D.guardarTienda(r.db, S.admin, { nombre: 'Tienda 3' }).db.tiendas.length).toBe(3)
  })
  it('envío con quién lo lleva y estado de pago', async () => {
    const db = await demo(), p = prodConStock(db, 4), t = db.tiendas[0]
    const debe = D.crearEnvio(db, S.admin, { tiendaId: t.id, items: [{ productoId: p.id, cantidad: 2 }], llevaId: 'U-V02', pago: { estado: 'Debe' } }, AHORA)
    expect(debe.envio.llevaId).toBe('U-V02'); expect(D.pagoEnvio(debe.db, debe.envio).estado).toBe('Debe')
    const par = D.crearEnvio(db, S.admin, { tiendaId: t.id, items: [{ productoId: p.id, cantidad: 2 }], llevaId: 'U-V02', pago: { estado: 'Parcial', monto: 1, medio: 'Yape' } }, AHORA)
    expect(D.pagoEnvio(par.db, par.envio).estado).toBe('Parcial')
    const saldo = D.pagoEnvio(par.db, par.envio).saldo
    expect(quien(() => D.registrarPagoTienda(par.db, S.admin, { tiendaId: t.id, envioId: par.envio.id, monto: saldo + 50, medio: 'Efectivo' }, AHORA))).toBeTruthy()
    const fin = D.registrarPagoTienda(par.db, S.admin, { tiendaId: t.id, envioId: par.envio.id, monto: saldo, medio: 'Efectivo' }, AHORA)
    expect(D.pagoEnvio(fin.db, par.envio).estado).toBe('Pagado')
    const v = D.vistaPara(fin.db, S.v2); expect(v.envios.some(e => e.id === par.envio.id)).toBe(true)
    expect(D.vistaPara(fin.db, S.v1).envios.some(e => e.id === par.envio.id)).toBe(false)
    expect(quien(() => D.crearEnvio(db, S.v2, { tiendaId: t.id, items: [{ productoId: p.id, cantidad: 1 }] }, AHORA))).toMatch(/permiso/)
  })
  it('crear producto con el código escaneado', async () => {
    const db = await demo(), r = D.guardarProducto(db, S.admin, { nombre: 'Producto escaneado', minimo: 1, codigo: '7750001234567' }, AHORA)
    expect(r.producto.codigo).toBe('7750001234567'); expect(D.productoPorCodigo(r.db, '7750001234567').id).toBe(r.producto.id)
    expect(quien(() => D.guardarProducto(r.db, S.admin, { nombre: 'Otro igual', minimo: 1, codigo: '7750001234567' }, AHORA))).toMatch(/código/)
  })
  it('ya no existen las firmas', () => { expect(D.guardarFirma).toBeUndefined() })
})
