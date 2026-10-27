import { describe, it, expect } from 'vitest'
import { demo } from './ayuda.js'
import { pdfGuia, pdfEnvio, pdfCuaderno, bytesPdf } from '../src/lib/pdf.js'
import { bytesLibro, leerLibro, hojasDe } from '../src/lib/excel.js'
import { crearRespaldo, leerRespaldo, validarCopia } from '../src/lib/respaldo.js'
import { iniciarSesion, hashClave } from '../src/lib/auth.js'
import { crearSesion, vencida } from '../src/lib/sesion.js'
import { migrar } from '../src/data/migraciones.js'
import { cuadernoDelDia } from '../src/lib/cuaderno.js'
import { vistaPara } from '../src/lib/dominio.js'
import { USUARIOS_DEMO } from '../src/data/seed.js'

describe('PDF', () => {
  it('guía, hoja de envío y cuaderno se generan con contenido', async () => {
    const db = await demo(), v = db.ventas[db.ventas.length - 1]
    const g = bytesPdf(await pdfGuia(v, { vendedor: 'Vendedor 1' })); expect(new Uint8Array(g).length).toBeGreaterThan(3000)
    expect(Buffer.from(g).subarray(0, 5).toString()).toBe('%PDF-')
    const e = db.envios[0], t = db.tiendas.find(x => x.id === e.tiendaId)
    expect(new Uint8Array(bytesPdf(await pdfEnvio(e, t, {}))).length).toBeGreaterThan(3000)
    const c = cuadernoDelDia(db, v.fecha); expect(new Uint8Array(bytesPdf(await pdfCuaderno(c, {}))).length).toBeGreaterThan(3000)
  })
})
describe('Excel', () => {
  it('exporta todo y oculta costos al vendedor', async () => {
    const db = await demo()
    expect(hojasDe(db, 'admin').length).toBeGreaterThanOrEqual(6)
    const h = leerLibro(bytesLibro(db, 'admin')), nombres = Object.keys(h)
    expect(nombres.join()).toMatch(/Ventas/); expect(nombres.join()).toMatch(/Tiendas/); expect(nombres.join()).toMatch(/Caja/i)
    expect(() => bytesLibro(db, 'vendedor')).toThrow()
  })
})
describe('Respaldo y migraciones', () => {
  it('ida y vuelta, y rechaza archivos ajenos o dañados', async () => {
    const db = await demo(), txt = JSON.stringify(crearRespaldo(db))
    const d = leerRespaldo(txt).datos; expect(d.ventas.length).toBe(db.ventas.length); expect(validarCopia(d)).toBeNull()
    expect(() => leerRespaldo('no es json')).toThrow(); expect(() => leerRespaldo('{"app":"otra","datos":{}}')).toThrow(); expect(() => leerRespaldo('')).toThrow()
    const roto = structuredClone(db); roto.ventas[0].total += 5; expect(validarCopia(roto)).toMatch(/total/)
    const sinAdmin = structuredClone(db); sinAdmin.usuarios.forEach(u => { if (u.rol === 'admin') u.activo = false }); expect(validarCopia(sinAdmin)).toMatch(/administradora/)
  })
  it('migra una copia antigua sin perder datos', async () => {
    const db = await demo(), viejo = { ...structuredClone(db), version: 1 }; delete viejo.conteos
    const m = migrar(viejo); expect(m.version).toBeGreaterThan(1); expect(m.ventas.length).toBe(db.ventas.length); expect(Array.isArray(m.conteos)).toBe(true)
    expect(() => migrar({ ...db, version: 999 })).toThrow()
  })
})
describe('Acceso y sesión', () => {
  it('bloquea tras 5 intentos y entra con la clave correcta', async () => {
    const us = await Promise.all(USUARIOS_DEMO.map(async u => ({ ...u, hash: await hashClave(u.usuario, u.usuario) })))
    let int = {}, r, t0 = 1e12
    for (let i = 0; i < 5; i++) { r = await iniciarSesion(us, 'vendedor1', 'x' + i, int, t0); int = r.intentos; expect(r.ok).toBe(false) }
    r = await iniciarSesion(us, 'vendedor1', 'vendedor1', int, t0 + 1000); expect(r.ok).toBe(false); expect(r.error).toMatch(/Demasiados/)
    r = await iniciarSesion(us, 'vendedor1', 'vendedor1', int, t0 + 6 * 60000); expect(r.ok).toBe(true); expect(r.usuario.rol).toBe('vendedor'); expect(r.usuario.hash).toBeUndefined()
    r = await iniciarSesion(us, 'ADMIN ', 'admin', {}, t0); expect(r.ok).toBe(true)
  })
  it('la sesión vence por inactividad', () => {
    const s = crearSesion({ id: 'U-ADM' }, 1000); expect(vencida(s, 1000 + 60000)).toBe(false); expect(vencida(s, 1000 + 16 * 60000)).toBe(true); expect(vencida(null)).toBe(true)
  })
  it('la vista del vendedor no trae costos', async () => {
    const db = await demo(), vv = vistaPara(db, { id: 'U-V01', rol: 'vendedor' }), txt = JSON.stringify(vv)
    expect(txt).not.toMatch(/"costo"/); expect(vv.usuarios.every(u => !u.hash)).toBe(true)
  })
})
