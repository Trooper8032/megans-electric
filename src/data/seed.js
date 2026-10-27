import { codigoInterno } from '../lib/codigoBarras.js'
// Datos de demostración: catálogo real (68 productos) + precios, costos y movimientos de ejemplo inventados.
// Todo se genera con las mismas reglas de la aplicación (dominio.js), así que los datos son coherentes.
import { CATALOGO } from './catalogo.js'
import { hashClave } from '../lib/auth.js'
import * as D from '../lib/dominio.js'
import { fechaISO, sumarDias, aFecha } from '../lib/fechas.js'
import { r2 } from '../lib/dinero.js'
import { MEDIOS_CAJA } from '../config/app.config.js'

export const VERSION_DATOS = 5
export const TABLAS = ['usuarios', 'productos', 'ventas', 'devoluciones', 'movimientos', 'conteos', 'cierres', 'tiendas', 'envios', 'pagosTienda', 'devolucionesTienda', 'bitacora']
export const USUARIOS_DEMO = [
  { id: 'U-ADM', usuario: 'admin', nombre: 'Administradora', rol: 'admin' },
  { id: 'U-COA', usuario: 'coadmin', nombre: 'Co-administrador', rol: 'coadmin' },
  { id: 'U-V01', usuario: 'vendedor1', nombre: 'Vendedor 1', rol: 'vendedor' },
  { id: 'U-V02', usuario: 'vendedor2', nombre: 'Vendedor 2', rol: 'vendedor' }
]
function prng(semilla) { let a = semilla >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const BASE = { Cajas: 2.4, Tapas: 1.2, Tomas: 3.8, Enchufes: 2.2, Sockets: 2.6, Medidores: 24, Interruptores: 3.2, Otro: 0 }
function productosBase() {
  return CATALOGO.map(([id, nombre, categoria, minimo], i) => {
    if (id === D.ID_OTROS) return { id, nombre, categoria, precio: 0, costo: 0, stock: 0, minimo: 0, unidad: 'und', decimales: false, codigo: '', activo: true, ultimoConteo: null }
    const num = Number((/(\d+)\s*polos/.exec(nombre) || [])[1] || 0), grande = /grande|trif|metal|industrial|30x30|36/.test(nombre)
    let precio = BASE[categoria] * (1 + (i % 6) * 0.17) + num * 0.45 + (grande ? BASE[categoria] * 0.8 : 0)
    precio = Math.round(precio * 10) / 10
    return { id, nombre, categoria, precio, costo: r2(precio * (0.58 + (i % 5) * 0.03)), stock: 0, minimo, unidad: 'und', decimales: false, codigo: codigoInterno(id), activo: true, ultimoConteo: null }
  })
}
const PROD_VENDIBLES = () => CATALOGO.filter(c => c[0] !== D.ID_OTROS).map(c => c[0])

export async function crearUsuarios() {
  return Promise.all(USUARIOS_DEMO.map(async u => ({ ...u, activo: true, hash: await hashClave(u.usuario, u.usuario) })))
}
export function baseVacia(usuarios = []) {
  return { version: VERSION_DATOS, demo: true, usuarios, productos: [], ventas: [], devoluciones: [], movimientos: [], conteos: [], cierres: [], tiendas: [], envios: [], pagosTienda: [], devolucionesTienda: [], bitacora: [], contadores: {}, creadoEn: null, ultimoRespaldo: null }
}
const en = (iso, h, m = 0) => { const d = aFecha(iso); d.setHours(h, m, 0, 0); return d }

function simular(usuarios, ahora, inicialPor) {
  D.modoRapido(true)
  try { return simularInterno(usuarios, ahora, inicialPor) } finally { D.modoRapido(false) }
}
function simularInterno(usuarios, ahora, inicialPor) {
  const rnd = prng(20261018), azar = n => Math.floor(rnd() * n), elige = a => a[azar(a.length)]
  let db = baseVacia(usuarios); db.creadoEn = ahora.toISOString(); db.productos = productosBase()
  const hoy = fechaISO(ahora), DIAS = 105, ini = sumarDias(hoy, -DIAS), ids = PROD_VENDIBLES()
  const t0 = en(ini, 7, 30).toISOString()
  db.productos.forEach(p => { if (p.id !== D.ID_OTROS) D.mover(db, { cuando: t0, productoId: p.id, tipo: 'ingreso', cantidad: inicialPor[p.id] ?? 1e6, motivo: 'Stock inicial de la demostración', quien: 'U-ADM' }) })
  const ejecutar = (fn, ...a) => { const r = fn(db, ...a); db = r.db; return r }
  const ses = id => ({ id }), vend = ['U-V01', 'U-V02']
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes()
  let ultimoHoy = 0
  const hora = (dia, h, m) => {
    if (dia !== hoy) return en(dia, h, m)
    let t = Math.max(en(dia, 0, 1).getTime(), Math.min(en(dia, h, m).getTime(), ahora.getTime() - 60000 * (1 + (h % 7))))
    t = Math.min(Math.max(t, ultimoHoy + 60000), ahora.getTime() - 1000); ultimoHoy = t; return new Date(t)
  }
  const pendientes = []
  const tiendas = [['Tienda 1 (ejemplo, renómbrala)', 'Encargada Marta', '987654321'], ['Tienda 2 (ejemplo, renómbrala)', 'Encargado Pedro', '976543210']]
  tiendas.forEach(([n, e, t]) => ejecutar(D.guardarTienda, ses('U-ADM'), { nombre: n, encargado: e, telefono: t }))
  const clientes = ['Cliente de mostrador', 'Cliente de mostrador', 'Cliente de mostrador', 'Electricista Juan', 'Constructora Santa Rosa', 'Sra. Elena', 'Don Alberto', 'Instalaciones Ríos', 'Maestro Víctor', 'Taller Eléctrico Sol']
  const lineasAzar = (max) => { const n = 1 + azar(max), vistos = new Set(), its = []; while (its.length < n) { const id = ids[Math.floor(Math.pow(rnd(), 1.6) * ids.length)]; if (vistos.has(id)) continue; vistos.add(id); its.push({ productoId: id, cantidad: 1 + azar(id < 'PRD-012' ? 8 : 5) }) } return its }
  const programados = { envios: {}, pagos: {}, recep: {} }
  tiendas.forEach((_, i) => { [-62, -47, -33, -19, -6].forEach((o, k) => { if (i === 2 && k === 0) return; programados.envios[sumarDias(hoy, o + i * 3)] = [...(programados.envios[sumarDias(hoy, o + i * 3)] || []), i] }) })
  const tdaIds = () => db.tiendas.map(t => t.id)
  let primeraDif = true
  for (let k = DIAS; k >= 0; k--) {
    const dia = sumarDias(hoy, -k), dow = aFecha(dia).getDay(), esHoy = k === 0
    // cobros de pendientes
    for (const pe of [...pendientes]) if (pe.dia <= dia) { const v = db.ventas.find(x => x.id === pe.id); if (v && v.estado === 'Activa' && !v.cobro) { const quien = v.vendedorId; try { ejecutar(D.cobrarPendiente, ses(quien), v.id, elige(['Efectivo', 'Yape', 'Plin']), hora(dia, 9 + azar(3), azar(50)), { operacion: String(10000000 + azar(89999999)) }) } catch { /* caja cerrada */ } } pendientes.splice(pendientes.indexOf(pe), 1) }
    // envíos a tiendas, recepciones, pagos
    for (const ti of programados.envios[dia] || []) {
      const tid = tdaIds()[ti], its = []; const vistos = new Set(); const n = 4 + azar(5)
      while (its.length < n) { const id = ids[azar(ids.length)]; if (!vistos.has(id)) { vistos.add(id); its.push({ productoId: id, cantidad: 6 + azar(18) }) } }
      const r = ejecutar(D.crearEnvio, ses('U-COA'), { tiendaId: tid, items: its, nota: 'Envío de reposición', llevaId: vend[ti % vend.length] }, hora(dia, 10, 15))
      const ayer = k === 1 || k === 0 || (ti === 2 && k < 8)
      if (!ayer) programados.recep[sumarDias(dia, 1)] = [...(programados.recep[sumarDias(dia, 1)] || []), r.envio.id]
      programados.pagos[sumarDias(dia, 6)] = [...(programados.pagos[sumarDias(dia, 6)] || []), tid]
    }
    for (const eid of programados.recep[dia] || []) {
      const e = db.envios.find(x => x.id === eid), rec = {}
      e.items.forEach((l, i) => { rec[l.productoId] = primeraDif && i === 1 ? l.cantidad - 2 : l.cantidad }); if (primeraDif && e.items.length > 1) primeraDif = false
      ejecutar(D.confirmarRecepcion, ses('U-COA'), eid, rec, hora(dia, 16, 10))
    }
    for (const tid of programados.pagos[dia] || []) {
      const e = db.envios.filter(x => x.tiendaId === tid && D.pagoEnvio(db, x).saldo > 0).sort((a, b) => a.numero - b.numero)[0]; if (!e) continue
      const saldo = Math.min(D.pagoEnvio(db, e).saldo, D.cuentaTienda(db, tid).deuda); if (saldo <= 1) continue; const total = rnd() < 0.55, monto = total ? saldo : Math.max(5, Math.round(saldo * (0.4 + rnd() * 0.3)))
      if (monto <= saldo) ejecutar(D.registrarPagoTienda, ses('U-COA'), { tiendaId: tid, envioId: e.id, monto, medio: elige(['Efectivo', 'Yape', 'Plin']), nota: total ? 'Pago del envío' : 'Abono' }, hora(dia, 17, 5))
    }
    if (dia === sumarDias(hoy, -22)) { const tid = tdaIds()[1], e = db.envios.filter(x => x.tiendaId === tid && x.recepcion)[0]; if (e) ejecutar(D.registrarDevolucionTienda, ses('U-ADM'), { tiendaId: tid, items: [{ productoId: e.items[0].productoId, cantidad: 2 }], motivo: 'Producto con fallas de fábrica' }, hora(dia, 12, 0)) }
    // ventas del día
    const nV = esHoy ? 5 : dow === 0 ? 2 + azar(2) : 4 + azar(5)
    const hechas = []
    for (let i = 0; i < nV; i++) {
      const v = esHoy ? vend[i % 2] : (rnd() < 0.08 ? 'U-ADM' : elige(vend))
      const medio = elige(['Efectivo', 'Efectivo', 'Efectivo', 'Efectivo', 'Yape', 'Yape', 'Yape', 'Plin', 'Plin', 'Pendiente'])
      const h = 8 + Math.floor(i * 10 / nV), m = azar(55)
      const r = ejecutar(D.crearVenta, ses(v), { cliente: elige(clientes), medio, operacion: String(10000000 + azar(89999999)), items: lineasAzar(3), telefono: rnd() < 0.3 ? '9' + String(10000000 + azar(89999999)) : '' }, hora(dia, h, m))
      hechas.push(r.venta.id)
      if (medio === 'Pendiente') pendientes.push({ id: r.venta.id, dia: sumarDias(dia, 2 + azar(9)) })
      if (rnd() < 0.14) { const t = hora(dia, h + 1, Math.min(m + 20, 58)); ejecutar(D.agregarAVenta, ses(rnd() < 0.5 ? v : 'U-COA'), r.venta.id, lineasAzar(1), t); if (medio !== 'Pendiente') ejecutar(D.cobrarPendiente, ses(v), r.venta.id, medio, new Date(t.getTime() + 60000), { operacion: String(10000000 + azar(89999999)) }) }
    }
    if (!esHoy && k % 17 === 5) { const v = db.ventas.find(x => x.id === hechas[1]); if (v) ejecutar(D.anularVenta, ses('U-ADM'), v.id, 'Registrada dos veces por error', hora(dia, 18, 0)) }
    if (!esHoy && k % 19 === 4) { const v = db.ventas.find(x => x.id === hechas[0] && x.estado === 'Activa'); if (v) ejecutar(D.registrarDevolucion, ses('U-ADM'), { ventaId: v.id, productoId: v.items[0].productoId, cantidad: 1, motivo: elige(['Defectuoso', 'Equivocación']), reingresa: rnd() < 0.5 }, hora(dia, 18, 20)) }
    // la administradora verifica los Yape/Plin de los días pasados (los de hoy quedan por verificar)
    if (!esHoy) for (const v of db.ventas) for (const pg of v.pagos || []) if (pg.fecha === dia && pg.estado === 'Por verificar') ejecutar(D.verificarPago, ses('U-ADM'), v.id, pg.id, hora(dia, 19, 0))
    // cierres de caja de los días pasados
    if (!esHoy) {
      for (const v of vend) {
        const c = D.calcularCaja(db, dia, v), cont = { ...c.esperado }; let nota = ''
        if (k === 2 && v === 'U-V02') { cont.Efectivo = r2(cont.Efectivo + 3); nota = 'Sobró sencillo: un cliente no esperó su vuelto.' }
        ejecutar(D.cerrarCaja, ses(v), { fecha: dia, vendedorId: v, contado: cont, nota }, hora(dia, 19, 10))
      }
      const c = D.calcularCaja(db, dia, null), cont = { ...c.esperado }; let nota = ''
      if (k === 1) { cont.Efectivo = r2(Math.max(0, cont.Efectivo - 5)); cont.Yape = r2(cont.Yape + 2); nota = 'Faltan S/ 5 en efectivo; un Yape de S/ 2 llegó sin anotar.' }
      if (k === 9) { cont.Plin = r2(cont.Plin + 4); nota = 'Un Plin sin registrar.' }
      ejecutar(D.cerrarCaja, ses('U-ADM'), { fecha: dia, contado: cont, nota }, hora(dia, 19, 40))
      if (k === 9) { const cid = `CAJ-${dia}-dia`; ejecutar(D.reabrirCaja, ses('U-ADM'), cid, 'Faltaba anotar un Plin de la tarde', hora(dia, 20, 5)); const c2 = D.calcularCaja(db, dia, null); ejecutar(D.cerrarCaja, ses('U-ADM'), { fecha: dia, contado: { ...c2.esperado, Plin: r2(c2.esperado.Plin + 4) }, nota: 'Un Plin sin registrar (aclarado).' }, hora(dia, 20, 20)) }
    }
    // conteos semanales (hace 21, 14 y 7 días)
    if ([21, 14, 7].includes(k)) {
      const r = ejecutar(D.iniciarConteo, ses('U-COA'), hora(dia, 8, 5)), cont = {}, mot = {}
      r.conteo.lineas.forEach((l, i) => { const p = db.productos.find(x => x.id === l.productoId); const dif = i === 2 ? -2 : i === 5 && k === 14 ? 1 : 0; cont[l.productoId] = p.stock + dif; if (dif) mot[l.productoId] = dif < 0 ? 'Se rompieron dos al mover la caja' : 'Había una caja sin anotar' })
      ejecutar(D.guardarConteo, ses('U-COA'), r.conteo.id, cont, mot); ejecutar(D.cerrarConteo, ses('U-COA'), r.conteo.id, hora(dia, 9, 0))
    }
  }
  return db
}

export async function crearDemo(ahora = new Date()) {
  const usuarios = await crearUsuarios()
  const objetivo = {}
  const bajos = new Set(['PRD-005', 'PRD-019', 'PRD-033', 'PRD-047', 'PRD-058', 'PRD-066', 'PRD-009'])
  CATALOGO.forEach(([id], i) => { objetivo[id] = bajos.has(id) ? 1 + (i % 4) : 14 + (i * 7) % 55 })
  const a = simular(usuarios, ahora, {})
  let inicial = {}
  // Stock inicial para terminar en el objetivo sin quedar nunca en negativo a mitad de la simulación
  // (una devolución con reingreso posterior hacía que algunos días, p. ej. los martes, faltara stock y la demo no se generara).
  for (const p of a.productos) if (p.id !== D.ID_OTROS) { const fin = p.stock - 1e6, minimo = Math.min(0, ...a.movimientos.filter(m => m.productoId === p.id).map(m => m.stockDespues - 1e6)); inicial[p.id] = Math.max(objetivo[p.id] - fin, -minimo) }
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    let b; try { b = simular(usuarios, ahora, inicial) } catch (e) { const m = /"(.+)"/.exec(e.message || ''), p = m && a.productos.find(x => x.nombre === m[1]); if (!p) throw e; inicial[p.id] += 10; continue }
    let ok = true
    for (const p of b.productos) { if (p.id === D.ID_OTROS) continue; const min = Math.min(...b.movimientos.filter(m => m.productoId === p.id).map(m => m.stockDespues)); if (min < 0) { inicial[p.id] -= min; ok = false } }
    if (ok) { b.creadoEn = ahora.toISOString(); return b }
  }
  throw new Error('No se pudo generar la demostración.')
}
export { MEDIOS_CAJA }
