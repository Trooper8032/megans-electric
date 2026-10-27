// Venta delegada: la administradora crea una venta a nombre de un vendedor y le aparece al instante
// (en la demo, otra pestaña del mismo navegador: evento "storage" + sondeo; en producción, Supabase Realtime).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { S, prodConStock } from './ayuda.js'
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m } }
describe('venta delegada en tiempo real (demo local)', () => {
  beforeEach(() => { vi.resetModules(); globalThis.localStorage = mem() })
  it('el vendedor ve la venta asignada sin recargar y nunca se pisan datos entre pestañas', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const { repoLocal } = await import('../src/data/repoLocal.js'), D = await import('../src/lib/dominio.js')
    const db = await repoLocal.cargar(), p = prodConStock(db)
    const avisos = []; const quitar = repoLocal.suscribir(() => avisos.push('cambio'), 1000)
    // "otra pestaña" (la administradora) guarda directamente en el almacenamiento compartido
    const otra = structuredClone(db), r = D.crearVenta(otra, S.admin, { cliente: 'Obra Los Pinos', medio: 'Pendiente', vendedorId: 'U-V01', items: [{ productoId: p.id, cantidad: 1 }] }, new Date())
    localStorage.setItem('megans-electric-v2:datos', JSON.stringify(r.db))
    vi.advanceTimersByTime(1100)
    expect(avisos.length).toBe(1)
    const fresca = await repoLocal.cargar(), vista = D.vistaPara(fresca, S.v1)
    expect(vista.ventas.some(v => v.id === r.venta.id && v.registradoPor === 'U-ADM')).toBe(true)
    expect(D.vistaPara(fresca, S.v2).ventas.some(v => v.id === r.venta.id)).toBe(false)
    quitar(); vi.useRealTimers()
  })
})
