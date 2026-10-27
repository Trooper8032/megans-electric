import { describe, it, expect } from 'vitest'
import { demo, AHORA } from './ayuda.js'
import { parsearPago, compararPago, parsearFactura } from '../src/lib/ocr.js'

const YAPE = `MUESTRA
¡Yapeaste!
S/ 25.50
Juan P.
27 oct. 2026 | 10:42 a. m.
DATOS DE LA TRANSACCIÓN
Nro. de operación
07345612`
describe('captura de Yape / Plin (solo sugerencia)', () => {
  it('lee monto, fecha, hora, operación y app', () => {
    expect(parsearPago(YAPE)).toMatchObject({ monto: 25.5, fecha: '2026-10-27', hora: '10:42 a. m.', operacion: '07345612', app: 'Yape', muestra: true })
    expect(parsearPago('Plin\nMonto S/ 1,250.00\nFecha 26/10/2026 18:05\nCódigo de operación 99887766')).toMatchObject({ monto: 1250, fecha: '2026-10-26', operacion: '99887766', app: 'Plin' })
  })
  it('no confunde el celular con la operación', () => { expect(parsearPago('Yape S/ 10.00 Celular 987654321 27/10/2026').operacion).toBeUndefined() })
  const pago = { id: 'PAG-1', medio: 'Yape', monto: 25.5, operacion: '07345612', fecha: '2026-10-27' }
  it('coincide cuando todo cuadra (la marca MUESTRA obliga a revisar)', () => {
    const sin = parsearPago(YAPE.replace('MUESTRA', '')); expect(compararPago(sin, pago).estado).toBe('Coincide')
    expect(compararPago(parsearPago(YAPE), pago).estado).toBe('Revisar')
  })
  it('revisar si el monto, la operación, la fecha o la app no cuadran', () => {
    const l = parsearPago(YAPE.replace('MUESTRA', ''))
    expect(compararPago({ ...l, monto: 20 }, pago).motivos[0]).toMatch(/monto/)
    expect(compararPago(l, { ...pago, operacion: '11112222' }).motivos.join(' ')).toMatch(/operación/)
    expect(compararPago(l, { ...pago, fecha: '2026-10-20' }).motivos.join(' ')).toMatch(/fecha/)
    expect(compararPago(l, { ...pago, medio: 'Plin' }).motivos.join(' ')).toMatch(/parece de Yape/)
  })
  it('detecta número de operación repetido en otra venta', async () => {
    const db = await demo(); const v = db.ventas.find(x => x.estado === 'Activa' && x.pagos?.some(p => p.medio === 'Yape' && p.operacion)); const otro = v.pagos.find(p => p.medio === 'Yape')
    const r = compararPago({ monto: 5, operacion: otro.operacion, fecha: '2026-10-18', app: 'Yape' }, { id: 'PAG-X', medio: 'Yape', monto: 5, operacion: otro.operacion, fecha: '2026-10-18' }, db)
    expect(r.estado).toBe('Revisar'); expect(r.chk.duplicado).toBe(true)
  })
  it('nunca devuelve una orden de verificar: solo estado y motivos', () => { expect(Object.keys(compararPago(parsearPago(YAPE), pago)).sort()).toEqual(['chk', 'estado', 'motivos']) })
})

const FACTURA = `DISTRIBUIDORA ELECTRO NORTE S.A.C.
R.U.C. 20123456789
FACTURA ELECTRÓNICA
F001-000482
Fecha de emisión: 26/10/2026
CANT. UND DESCRIPCIÓN P.UNIT IMPORTE
50 UND INTERRUPTOR SIMPLE 3.20 160.00
20 UND CAJA DE 2 POLOS 1.90 38.00
12 UND TOMACORRIENTE DOBLE EMPOTRADO 2.25 27.00
10 UND SOCKET WALL LOZA 2.80 28.00
5 UND CABLE MELLIZO 2X14 1.50 7.50
SUB TOTAL 220.76
IGV 18% 39.74
TOTAL S/ 260.50`
describe('factura del proveedor', async () => {
  const db = await demo()
  it('arma la tabla con producto, cantidad y costo; marca lo que no está en el catálogo', () => {
    const r = parsearFactura(FACTURA, db.productos)
    expect(r.doc).toMatchObject({ numero: 'F001-000482', ruc: '20123456789', fecha: '2026-10-26', total: 260.5 })
    expect(r.filas.map(f => [f.cantidad, f.nombre, f.costo])).toEqual([[50, 'Interruptor simple', 3.2], [20, 'Caja de 2 polos', 1.9], [12, 'Toma corriente doble empotrado', 2.25], [10, 'Socket Wall loza', 2.8], [5, '', 1.5]])
    expect(r.filas[4].usar).toBe(false)
    expect(r.suma).toBe(260.5); expect(r.cuadra).toBe(true)
  })
  it('acepta otro orden de columnas (descripción primero) y comas decimales', () => {
    const r = parsearFactura('1 Interruptor doble 24 3,10 74,40\n2 Enchufe reversible 6 2,00 12,00', db.productos)
    expect(r.filas.map(f => [f.cantidad, f.nombre, f.costo])).toEqual([[24, 'Interruptor doble', 3.1], [6, 'Enchufe reversible', 2]])
  })
})
