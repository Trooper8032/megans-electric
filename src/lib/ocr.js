// Entender el texto leído de una foto (OCR con tesseract.js). Funciones puras, probadas con Vitest.
// 1) Captura de Yape / Plin: SOLO sugiere "Coincide" o "Revisar". Nunca verifica un pago (eso lo hace la administradora a mano).
// 2) Factura o guía del proveedor: arma una tabla editable (producto, cantidad, costo) para confirmar el ingreso.
import { sinTilde, buscarProducto } from './voz.js'
import { operacionDuplicada } from './dominio.js'

const MES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, set: 9, sep: 9, oct: 10, nov: 11, dic: 12 }
const dinero = s => parseFloat(String(s).replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))
export function parsearPago(tx) {
  const t = String(tx || '').replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0').replace(/\s+/g, ' '), r = {}
  let m = t.match(/S\s*\/\s*\.?\s*(\d{1,5}(?:[.,]\d{3})*[.,]\d{2})\b/i) || t.match(/(?:monto|total|importe)\D{0,8}(\d{1,5}[.,]\d{2})\b/i) || t.match(/\b(\d{1,5}[.,]\d{2})\b/)
  if (m) r.monto = dinero(m[1])
  m = t.match(/\b(\d{1,2})\s*(?:de\s*)?(ene|feb|mar|abr|may|jun|jul|ago|set|sep|oct|nov|dic)[a-z]*\.?\s*(?:de\s*|,\s*)?(\d{4})\b/i)
  if (m) r.fecha = `${m[3]}-${String(MES[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`
  else { m = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/); if (m) r.fecha = `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  m = t.match(/\b(\d{1,2}:\d{2})\s*([ap])\.?\s*m\.?/i) || t.match(/\b(\d{1,2}:\d{2})\b/); if (m) r.hora = m[1] + (m[2] ? ` ${m[2].toLowerCase()}. m.` : '')
  m = t.match(/(?:n[uú]mero de |nro\.? de |n\.?[º°] de )?operaci[oó0]n\D{0,14}(\d{6,12})\b/i) || t.match(/c[oó]d(?:igo)?\.?\s*(?:de\s*)?(?:seguridad|operaci[oó]n)?\D{0,8}(\d{6,12})\b/i)
  if (m) r.operacion = m[1]; else { const all = (t.match(/\b\d{6,12}\b/g) || []).filter(x => !/^20\d{2}/.test(x) && !/^9\d{8}$/.test(x)); if (all.length) r.operacion = all[0] }
  r.app = /plin/i.test(t) ? 'Plin' : /yape/i.test(t) ? 'Yape' : ''
  r.muestra = /MUESTRA/i.test(t)
  return r
}
// Compara lo leído con el pago registrado. dbVista: para buscar el número de operación en otros pagos.
export function compararPago(leido, pago, dbVista = null) {
  const motivos = [], chk = {}
  if (leido.monto == null) motivos.push('No pudimos leer el monto.')
  else if (Math.abs(leido.monto - pago.monto) > 0.009) motivos.push(`El monto de la captura (S/ ${leido.monto.toFixed(2)}) no es igual al pago registrado (S/ ${Number(pago.monto).toFixed(2)}).`)
  else chk.monto = true
  if (!leido.operacion) motivos.push('No encontramos el número de operación.')
  else {
    if (pago.operacion && String(pago.operacion).replace(/\D/g, '') !== leido.operacion) motivos.push(`El número de operación de la captura (${leido.operacion}) no es el que se anotó (${pago.operacion}).`)
    else chk.operacion = true
    if (dbVista && operacionDuplicada(dbVista, pago.medio, leido.operacion, pago.id)) { motivos.push('Ese número de operación ya está en otra venta.'); chk.operacion = false; chk.duplicado = true }
  }
  if (!leido.fecha) motivos.push('No pudimos leer la fecha.')
  else { const dd = Math.round((new Date(leido.fecha + 'T12:00') - new Date(pago.fecha + 'T12:00')) / 864e5); if (dd < -1 || dd > 0) motivos.push('La fecha de la captura no coincide con la del pago.'); else chk.fecha = true }
  if (leido.app && leido.app !== pago.medio) motivos.push(`La captura parece de ${leido.app}, pero el pago se anotó como ${pago.medio}.`)
  if (leido.muestra) motivos.push('La imagen dice MUESTRA: es una captura de prueba.')
  return { estado: motivos.length ? 'Revisar' : 'Coincide', motivos, chk }
}

// ---------- Factura / guía del proveedor ----------
const SALTAR = /\b(r\.?u\.?c|factura|boleta|gu[ií]a de remisi|remitente|destinatario|se[ñn]or(?:es)?|cliente|direcci[oó]n|fecha|emisi[oó]n|vencim|sub\s*total|op\.?\s*gravada|i\.?g\.?v|total|son:|importe|moneda|forma de pago|condici|tel[eé]fono|cel\.?|p[aá]gina|cant\.?\s+desc|descripci[oó]n\s+cant|c[oó]digo\s+desc|muestra|sin valor)\b/i
const UNIDADES = /\b(?:und|unid|unids|uni|un|nid|pza|pzas|pz|cja|cj|doc|paq|kit|rollo|mts?|m)\.?\b/gi
export function parsearFactura(texto, productos) {
  const lineas = String(texto || '').split(/\n/), filas = [], doc = {}
  const todo = String(texto || '')
  let m = /\b([FBET][A-Z0-9]{3})\s*[-–]\s*(\d{1,8})\b/.exec(todo) || /\b(?:n[º°o]\.?|nro\.?)\s*(\d{3,4})\s*[-–]\s*(\d{1,8})\b/i.exec(todo); if (m) doc.numero = `${m[1]}-${m[2]}`
  m = /\bR\.?U\.?C\.?\s*:?\s*(\d{11})\b/i.exec(todo); if (m) doc.ruc = m[1]
  m = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/.exec(todo); if (m) doc.fecha = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = /\bTOTAL(?!\s*(?:DE|EN))\b[^\d\n]{0,12}(\d{1,6}[.,]\d{2})/i.exec(todo.split(/\n/).filter(l => !/sub\s*total/i.test(l)).join('\n')); if (m) doc.total = dinero(m[1])
  const prov = lineas.map(l => l.trim()).find(l => /\b(S\.?A\.?C\.?|E\.?I\.?R\.?L\.?|S\.?R\.?L\.?|S\.?A\.?)\s*$/i.test(l)); if (prov) doc.proveedor = prov.replace(/\s+/g, ' ').slice(0, 60)
  for (const crudo of lineas) {
    let l = crudo.replace(/[|_—–]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (l.length < 6 || !/[a-záéíóúñ]{3}/i.test(l) || SALTAR.test(l)) continue
    l = l.replace(/S\s*\/\s*\.?/gi, ' ').replace(/(\d)\s*,\s*(\d{2})\b/g, '$1.$2').replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, '0')
    const nums = [...l.matchAll(/(?<![\w.])(\d{1,6}(?:\.\d{1,3})?)(?![\w.])/g)].map(x => ({ v: Number(x[1]), s: x[1], i: x.index, dec: /\.\d{2,3}$/.test(x[1]) }))
    const dec = nums.filter(n => n.dec)
    if (!dec.length) continue
    let unit = null, total = null, qty = null
    if (dec.length >= 2) { total = dec[dec.length - 1]; unit = dec[dec.length - 2] } else unit = dec[0]
    const enteros = nums.filter(n => !n.dec && n.i < (unit?.i ?? 1e9))
    if (total) qty = enteros.find(n => n.v > 0 && Math.abs(n.v * unit.v - total.v) < Math.max(0.05, total.v * 0.005))
    if (!qty && total && unit.v > 0) { const q = total.v / unit.v; if (Math.abs(q - Math.round(q)) < 0.01) qty = { v: Math.round(q), i: -1, s: '' } }
    if (!qty) qty = enteros[0] && enteros[0].i < 6 && enteros[1] && enteros[1].i < 14 ? enteros[1] : enteros[0]
    if (!qty || !(qty.v > 0)) continue
    // descripción: quitar los números usados (cantidad, costo, total, n.º de ítem al inicio) y las unidades
    let d = l; const quita = [total, unit, qty].filter(x => x && x.i >= 0).sort((a, b) => b.i - a.i)
    for (const x of quita) d = d.slice(0, x.i) + ' ' + d.slice(x.i + x.s.length)
    d = d.replace(/^\s*\d{1,3}\s+(?=\D)/, ' ').replace(/^\s*[A-Z]{0,4}\d{3,}\s+/, ' ').replace(UNIDADES, ' ').replace(/\s+/g, ' ').trim()
    if (!/[a-záéíóúñ]{3}/i.test(d)) continue
    const b = buscarProducto(d, productos, { minimo: 0.55 })
    filas.push({ linea: crudo.trim(), descripcion: d, cantidad: qty.v, costo: unit ? unit.v : null, total: total ? total.v : null, productoId: b.producto?.id || '', nombre: b.producto?.nombre || '', puntaje: b.puntaje, duda: !b.producto || b.duda, opciones: b.opciones, usar: !!b.producto })
  }
  const suma = Math.round(filas.reduce((s, f) => s + (f.total ?? f.cantidad * (f.costo || 0)), 0) * 100) / 100
  return { doc, filas, suma, cuadra: doc.total != null ? Math.abs(doc.total - suma) < 0.05 || Math.abs(doc.total / 1.18 - suma) < 0.05 : null }
}
export const textoSinTildes = sinTilde
