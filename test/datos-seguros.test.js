import { describe, it, expect, beforeEach } from 'vitest'
import { demo } from './ayuda.js'
import { validarCopia } from '../src/lib/respaldo.js'
import { repoLocal } from '../src/data/repoLocal.js'
import { config } from '../src/config/app.config.js'
import { coincide } from '../src/components/Selector.jsx'

const memoria = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m } }
describe('los datos del equipo nunca se reemplazan por la demostración', () => {
  beforeEach(() => { globalThis.localStorage = memoria(); repoLocal.olvidarCache() })
  it('stock con decimales (producto por metro) es válido', async () => {
    const db = await demo(); db.productos[0].decimales = true; db.productos[0].stock = 97.5
    expect(validarCopia(db)).toBeNull()
    db.productos[1].stock = 3.5; expect(validarCopia(db)).toMatch(/stock/)
  })
  it('si algo no valida, se conservan los datos (y se guarda copia de rescate)', async () => {
    const db = await demo(); db.productos.push({ ...db.productos[0], id: 'PRD-500', nombre: 'Caja de 8 polos empotrada', stock: 2.5 })
    localStorage.setItem(`${config.clave}:datos`, JSON.stringify(db))
    const r = await repoLocal.cargar()
    expect(r.productos.some(p => p.nombre === 'Caja de 8 polos empotrada')).toBe(true)
    expect(localStorage.getItem(`${config.clave}:rescate`)).toBeTruthy()
  })
  it('datos ilegibles: error y copia de rescate, sin borrar', async () => {
    localStorage.setItem(`${config.clave}:datos`, '{roto')
    await expect(repoLocal.cargar()).rejects.toThrow(/rescate/)
    expect(localStorage.getItem(`${config.clave}:datos`)).toBe('{roto')
  })
})
describe('búsqueda de productos por palabras', () => {
  const p = { nombre: 'Caja de 8 polos', categoria: 'Cajas', codigo: 'MEG001' }
  it('encuentra en cualquier orden, sin «de», con plurales y por código', () => {
    for (const q of ['caja 8', 'caja 8 polos', '8 polos', 'cajas polos 8', 'CAJA', 'meg001']) expect(coincide(q, p)).toBe(true)
    expect(coincide('caja 18', p)).toBe(false); expect(coincide('8 polos empotrada', p)).toBe(false)
  })
})
