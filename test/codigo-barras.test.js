// Code128 propio: ida y vuelta, compatibilidad con un codificador de referencia y lectura desde imagen.
import { describe, it, expect } from 'vitest'
import { codificar, decodificarAnchos, anchosDeFila, leerImagen, codigoInterno, barras } from '../src/lib/codigoBarras.js'
const anchos = mod => { const r = []; let n = 1; for (let i = 1; i <= mod.length; i++) { if (mod[i] === mod[i - 1]) n++; else { r.push(n); n = 1 } } return r }
const imagen = (mod, esc = 3, alto = 40, ruido = 0) => { const width = mod.length * esc, data = new Uint8ClampedArray(width * alto * 4); let s = 7
  for (let y = 0; y < alto; y++) for (let x = 0; x < width; x++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const v = (mod[Math.floor(x / esc)] === '1' ? 20 : 235) + (ruido ? (s % (2 * ruido)) - ruido : 0); const o = (y * width + x) * 4; data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255 }
  return { data, width, height: alto } }
describe('código de barras Code128 interno', () => {
  it('código interno por producto', () => { expect(codigoInterno('PRD-012')).toBe('MEG00012'); expect(codigoInterno('PRD-999')).toBe('MEG00999') })
  it('ida y vuelta: codifica y decodifica, también leído al revés', () => {
    for (const t of ['MEG00012', 'MEG00999', 'Cable-2.5mm', 'A']) {
      const m = codificar(t); const r = anchos(m.replace(/^0+|0+$/g, ''))
      expect(decodificarAnchos(r)).toBe(t); expect(decodificarAnchos([...r].reverse())).toBe(t)
    }
  })
  it('lee el código de un codificador de referencia (python-barcode, con cambio a juego C)', () => {
    expect(decodificarAnchos(anchos('110100100001011101100010001101000110100010001011101111011011001100110011011001011110111011001110010110001000101100011101011'))).toBe('MEG00012')
  })
  it('rechaza un código con dígito de control equivocado', () => {
    const r = anchos(codificar('MEG00012').replace(/^0+|0+$/g, '')); const malo = [...r]; [malo[10], malo[11]] = [malo[11], malo[10]]
    expect(decodificarAnchos(malo)).not.toBe('MEG00012')
  })
  it('lee desde una imagen (como la cámara) con ruido y distinta escala', () => {
    expect(leerImagen(imagen(codificar('MEG00034'), 3, 30, 25))).toBe('MEG00034')
    expect(leerImagen(imagen(codificar('MEG00007'), 2, 20, 0))).toBe('MEG00007')
    expect(anchosDeFila(new Array(50).fill(128))).toEqual([])
  })
  it('las barras dibujadas suman el ancho de los módulos', () => { const m = codificar('MEG1'); expect(barras(m).reduce((s, b) => s + b[1], 0)).toBe([...m].filter(x => x === '1').length) })
})

import { demo, S, AHORA, quien } from './ayuda.js'
import * as D from '../src/lib/dominio.js'
describe('escaneo: venta e ingreso de mercadería', () => {
  it('cada producto tiene su código interno y se encuentra al escanear', async () => {
    const db = await demo(), p = db.productos.find(x => x.id !== D.ID_OTROS && x.activo)
    expect(p.codigo).toBe(codigoInterno(p.id)); expect(D.productoPorCodigo(db, ' ' + p.codigo.toLowerCase() + ' ').id).toBe(p.id); expect(D.productoPorCodigo(db, 'NOEXISTE')).toBe(null)
  })
  it('ingreso por escaneo: varias líneas, con autor; el vendedor no puede', async () => {
    const db = await demo(), [a, b] = db.productos.filter(x => x.id !== D.ID_OTROS)
    const r = D.ingresarVarios(db, S.coadmin, [{ productoId: a.id, cantidad: 3 }, { productoId: b.id, cantidad: 2 }], 'Ingreso por escaneo', AHORA)
    expect(r.db.productos.find(x => x.id === a.id).stock).toBe(a.stock + 3); expect(r.db.movimientos.at(-1)).toMatchObject({ tipo: 'ingreso', quien: 'U-COA', cantidad: 2 })
    expect(quien(() => D.ingresarVarios(db, S.v1, [{ productoId: a.id, cantidad: 1 }], 'x', AHORA))).toMatch(/permiso/)
    expect(quien(() => D.ingresarVarios(db, S.admin, [], 'x', AHORA))).toMatch(/Escanea/)
  })
})
