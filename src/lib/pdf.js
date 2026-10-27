// PDF con jsPDF: guía de venta, hoja de envío a tienda y cuaderno del día. Se carga solo al usarlo (celular liviano).
import { config, AVISO_GUIA } from '../config/app.config.js'
import { soles, numero } from './dinero.js'
import { fechaCorta, fechaLarga } from './fechas.js'
import { codigoGuia } from './verificacion.js'
const AZUL = [43, 40, 120], NARANJA = [196, 98, 14], GRIS = [90, 96, 110], ROJO = [185, 28, 28], TINTA = [24, 26, 40], W = 210, M = 14
const RATIO_LOGO = 1016 / 343
const nuevo = async () => { const { jsPDF } = await import('jspdf'); return new jsPDF({ unit: 'mm', format: 'a4' }) }
function cabecera(doc, logo, titulo, subtitulo, linea2) {
  if (logo) doc.addImage(logo, 'PNG', M, 12, 40, 40 / RATIO_LOGO)
  else { doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...AZUL); doc.text(config.nombre, M, 22) }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...AZUL); doc.text(titulo, W - M, 18, { align: 'right' })
  doc.setFontSize(13); doc.setTextColor(...NARANJA); doc.text(subtitulo, W - M, 25, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS); if (linea2) doc.text(linea2, W - M, 31, { align: 'right' })
  doc.setDrawColor(...AZUL); doc.setLineWidth(0.7); doc.line(M, 37, W - M, 37)
}
function pie(doc) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text(`${config.nombre} · ${config.credito}`, M, 290); doc.text(`Página ${i} de ${n}`, W - M, 290, { align: 'right' }) }
}
const campo = (doc, t, v, x, y) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text(t.toUpperCase(), x, y); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TINTA); doc.text(String(v ?? '—'), x, y + 5) }
function aviso(doc, y, texto = AVISO_GUIA) {
  doc.setFillColor(255, 243, 224); doc.setDrawColor(...NARANJA); doc.setLineWidth(0.3); doc.roundedRect(M, y, W - 2 * M, 12, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120, 53, 15); doc.text(doc.splitTextToSize(texto + ' La emisión de comprobantes SUNAT queda para una etapa posterior.', W - 2 * M - 8), M + 4, y + 5)
}
function tabla(doc, y, cols, filas, opciones = {}) {
  const ancho = W - 2 * M, total = cols.reduce((s, c) => s + c.w, 0)
  const xs = []; let ax = M; cols.forEach(c => { xs.push(ax); ax += c.w / total * ancho })
  const cabeza = yy => { doc.setFillColor(...AZUL); doc.rect(M, yy, ancho, 8, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255); cols.forEach((c, i) => doc.text(c.t, c.der ? xs[i] + c.w / total * ancho - 2 : xs[i] + 2, yy + 5.4, { align: c.der ? 'right' : 'left' })); return yy + 8 }
  y = cabeza(y)
  filas.forEach((f, idx) => {
    const lineas = cols.map((c, i) => doc.splitTextToSize(String(f.celdas[i] ?? ''), c.w / total * ancho - 4)), alto = Math.max(7, Math.max(...lineas.map(l => l.length)) * 4.4 + 2.6)
    if (y + alto > (opciones.limite || 272)) { doc.addPage(); y = cabeza(16) }
    if (idx % 2 === 0) { doc.setFillColor(243, 244, 250); doc.rect(M, y, ancho, alto, 'F') }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
    cols.forEach((c, i) => { doc.setTextColor(...(f.rojo && f.rojo.includes(i) ? ROJO : TINTA)); if (f.rojo && f.rojo.includes(i)) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal'); doc.text(lineas[i], c.der ? xs[i] + c.w / total * ancho - 2 : xs[i] + 2, y + 5, { align: c.der ? 'right' : 'left' }) })
    y += alto
  })
  doc.setDrawColor(200, 204, 214); doc.setLineWidth(0.2); doc.line(M, y, W - M, y)
  return y
}
export async function pdfGuia(venta, { vendedor = '', logo = null, nombre = id => id || '—', devoluciones = [] } = {}) {
  const doc = await nuevo()
  cabecera(doc, logo, 'GUÍA DE VENTA', `N.º ${venta.id}`, `${fechaLarga(venta.fecha)} · ${venta.hora}`)
  let y = 46
  campo(doc, 'Cliente', venta.cliente, M, y); campo(doc, 'Celular', venta.telefono || '—', M + 85, y); campo(doc, 'Pago', textoCobro(venta), M + 125, y)
  y += 12; campo(doc, 'Atendido por', vendedor || '—', M, y); campo(doc, 'Serie y número', `${venta.serie} - ${String(venta.numero).padStart(6, '0')}`, M + 85, y)
  if (venta.estado !== 'Activa') { doc.setTextColor(...ROJO); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('VENTA ANULADA', M + 125, y + 4) }
  y += 12
  const filas = venta.items.map(l => ({ celdas: [String(l.cantidad), l.nombre + (l.agregadoEn && l.agregadoEn !== venta.creadoEn ? `  (agregado ${new Date(l.agregadoEn).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })})` : ''), soles(l.precio), soles(l.cantidad * l.precio)] }))
  y = tabla(doc, y, [{ t: 'Cant.', w: 12 }, { t: 'Producto', w: 98 }, { t: 'P. unitario', w: 28, der: true }, { t: 'Subtotal', w: 28, der: true }], filas, { limite: 205 })
  y += 4; if (y > 215) { doc.addPage(); y = 20 }
  doc.setFillColor(...AZUL); doc.roundedRect(W - M - 70, y, 70, 14, 2, 2, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.text('TOTAL', W - M - 66, y + 8.8); doc.setFontSize(15); doc.text(soles(venta.total), W - M - 4, y + 9.4, { align: 'right' })
  if (venta.version > 1) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS); doc.text(`Esta guía se completó ${venta.version - 1} vez/veces después de la primera impresión; el detalle de cambios está en el sistema.`, M, y + 6, { maxWidth: 110 }) }
  y += 22; if (y > 205) { doc.addPage(); y = 20 }
  doc.setDrawColor(...AZUL); doc.setLineWidth(0.4); doc.roundedRect(M, y, 80, 18, 2, 2)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text('CÓDIGO DE VERIFICACIÓN', M + 4, y + 6)
  doc.setFont('courier', 'bold'); doc.setFontSize(15); doc.setTextColor(...TINTA); doc.text(codigoGuia(venta), M + 4, y + 14)
  aviso(doc, Math.max(y + 26, 238))
  // Historial completo de la guía: pagos, devoluciones y cada cambio (quién y cuándo)
  doc.addPage(); let h = 20
  const titulo = t => { if (h > 262) { doc.addPage(); h = 20 } doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL); doc.text(t, M, h); h += 4 }
  const hora = iso => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  titulo(`Historial de la guía ${venta.id}`)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS); doc.text(`Vendió: ${vendedor || '—'} · Registró: ${nombre(venta.registradoPor)} · ${fechaLarga(venta.fecha)} ${venta.hora} · Estado: ${textoCobro(venta)}`, M, h + 2, { maxWidth: W - 2 * M }); h += 9
  titulo('Pagos')
  const pagos = venta.pagos || []
  h = tabla(doc, h, [{ t: 'Fecha y hora', w: 30 }, { t: 'Medio', w: 18 }, { t: 'Operación', w: 26 }, { t: 'Estado', w: 26 }, { t: 'Cobró', w: 40 }, { t: 'Monto', w: 26, der: true }], pagos.length ? pagos.map(p => ({ celdas: [hora(p.cuando), p.medio, p.operacion || '—', p.estado + (p.duplicado ? ' (op. repetida)' : '') + (p.foto ? ' · con foto' : ''), nombre(p.quien), soles(p.monto)] })) : [{ celdas: ['—', 'Sin pagos', '', '', '', soles(0)] }], { limite: 262 })
  const pagado = pagos.reduce((a, p) => a + p.monto, 0)
  h += 5; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TINTA); doc.text(`Pagado ${soles(pagado)} · Falta cobrar ${soles(Math.max(0, venta.total - pagado))}`, W - M, h, { align: 'right' }); h += 8
  if (devoluciones.length) { titulo('Devoluciones'); h = tabla(doc, h, [{ t: 'Fecha y hora', w: 30 }, { t: 'Producto', w: 62 }, { t: 'Motivo', w: 30 }, { t: 'Registró', w: 18 }, { t: 'Monto', w: 26, der: true }], devoluciones.map(d => ({ celdas: [hora(d.cuando), `${d.cantidad} × ${d.nombre}`, d.motivo, nombre(d.quien), '−' + soles(d.monto)] })), { limite: 262 }); h += 8 }
  titulo('Cambios (nada se borra)')
  h = tabla(doc, h, [{ t: 'Fecha y hora', w: 30 }, { t: 'Quién', w: 32 }, { t: 'Qué hizo', w: 104 }], (venta.historial || []).map(x => ({ celdas: [hora(x.cuando), nombre(x.quien), x.que] })), { limite: 262 })
  pie(doc); return doc
}
export const textoCobro = v => { if (v.estado !== 'Activa') return 'Anulada'; const ps = v.pagos || [], pag = ps.reduce((a, p) => a + p.monto, 0), med = [...new Set(ps.map(p => p.medio))].join(' + '); return pag <= 0 ? 'Pendiente' : pag + 0.004 < v.total ? `Parcial (${med}), falta ${soles(v.total - pag)}` : `Cobrado (${med})` }
export async function pdfEnvio(envio, tienda, { logo = null, quien = '', lleva = '', pago = null } = {}) {
  const doc = await nuevo()
  cabecera(doc, logo, 'HOJA DE ENVÍO DE STOCK', `N.º ${envio.id}`, fechaLarga(envio.fecha))
  let y = 46; campo(doc, 'Tienda', tienda.nombre, M, y); campo(doc, 'Encargado(a)', tienda.encargado || '—', M + 100, y); y += 12
  campo(doc, 'Preparó', quien || '—', M, y); campo(doc, 'Lo lleva', lleva || 'Sin asignar', M + 100, y); y += 12
  campo(doc, 'Recepción', envio.estado, M, y)
  if (pago) { const col = pago.estado === 'Pagado' ? [21, 128, 61] : pago.estado === 'Parcial' ? [180, 83, 9] : ROJO; doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text('PAGO', M + 100, y); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...col); doc.text(pago.estado === 'Pagado' ? `PAGADO${pago.medios.length ? ' (' + pago.medios.join(' + ') + ')' : ''}` : pago.estado === 'Parcial' ? `PARCIAL · pagó ${soles(pago.pagado)} · falta ${soles(pago.saldo)}` : `DEBE ${soles(pago.saldo)}`, M + 100, y + 5) }
  y += 12
  const filas = envio.items.map(l => { const dif = l.recibido !== null && l.recibido !== l.cantidad; return { celdas: [String(l.cantidad), l.nombre, l.recibido === null ? '' : String(l.recibido), l.recibido === null ? '' : (dif ? `Faltan ${l.cantidad - l.recibido}` : 'Conforme'), soles(l.precio), soles(l.cantidad * l.precio)], rojo: dif ? [2, 3] : null } })
  y = tabla(doc, y, [{ t: 'Enviado', w: 14 }, { t: 'Producto', w: 62 }, { t: 'Recibido', w: 16 }, { t: 'Diferencia', w: 24 }, { t: 'Precio', w: 22, der: true }, { t: 'Subtotal', w: 24, der: true }], filas, { limite: 215 })
  y += 5; doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL); doc.text(`Valor del envío: ${soles(envio.total)}`, W - M, y + 3, { align: 'right' })
  if (envio.nota) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS); doc.text(`Nota: ${envio.nota}`, M, y + 3, { maxWidth: 110 }) }
  y += 16; if (y > 225) { doc.addPage(); y = 24 }
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS)
  doc.setFontSize(8.5); doc.text('La tienda cuenta cada producto al recibir y anota las diferencias. Lo enviado menos lo pagado y lo devuelto es su deuda.', M, y + 4, { maxWidth: W - 2 * M })
  aviso(doc, 252, 'Esta hoja es un control interno de envío de stock. NO es una guía de remisión de la SUNAT.')
  pie(doc); return doc
}
export async function pdfCuaderno(c, { logo = null } = {}) {
  const doc = await nuevo()
  cabecera(doc, logo, 'CUADERNO DEL DÍA', fechaCorta(c.fecha), 'Para comparar con el cuaderno a mano')
  let y = 44
  const filas = c.filas.map(f => ({ celdas: [f.hora, f.id.slice(-6), f.cliente, f.detalle, f.medio, f.estado === 'Activa' ? soles(f.total) : 'ANULADA'], rojo: f.estado === 'Activa' ? null : [5] }))
  if (!filas.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...GRIS); doc.text('No hubo ventas este día.', M, y + 6); y += 12 } else y = tabla(doc, y, [{ t: 'Hora', w: 11 }, { t: 'N.º', w: 12 }, { t: 'Cliente', w: 30 }, { t: 'Detalle', w: 70 }, { t: 'Pago', w: 24 }, { t: 'Total', w: 22, der: true }], filas, { limite: 235 })
  y += 8; if (y > 235) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...AZUL); doc.text('Resumen del día', M, y); y += 6
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...TINTA); doc.setFontSize(10)
  const lin = [['Total vendido', soles(c.totalDia)], ...Object.entries(c.porMedio).map(([m, v]) => [m, soles(v)]), ['Devoluciones', soles(c.caja.devoluciones)]]
  lin.forEach(([t, v], i) => { doc.text(t, M + (i % 2) * 90, y + Math.floor(i / 2) * 6); doc.text(v, M + 60 + (i % 2) * 90, y + Math.floor(i / 2) * 6, { align: 'right' }) })
  y += Math.ceil(lin.length / 2) * 6 + 6
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...AZUL); doc.text('Caja del día (esperado vs contado)', M, y); y += 6; doc.setFont('helvetica', 'normal'); doc.setTextColor(...TINTA)
  Object.entries(c.caja.esperado).forEach(([m, v]) => { doc.text(`${m}: esperado ${soles(v)}`, M, y); if (c.cierre && c.cierre.contado) { const d = c.cierre.diferencia[m]; doc.text(`contado ${soles(c.cierre.contado[m])}`, M + 75, y); doc.setTextColor(...(d ? ROJO : TINTA)); doc.text(d ? `diferencia ${soles(d)}` : 'sin diferencia', M + 125, y); doc.setTextColor(...TINTA) } y += 6 })
  if (!c.cierre) { doc.setTextColor(...GRIS); doc.text('La caja de este día todavía no se cierra.', M, y); y += 6 }
  pie(doc); return doc
}
export const bytesPdf = doc => doc.output('arraybuffer')
export const descargarPdf = (doc, nombre) => doc.save(nombre)
export { numero }
// Etiquetas A4 (3 × 8 de 70 × 37 mm) con nombre, precio y código Code128 interno. Se generan en el navegador.
export async function pdfEtiquetas(items) {
  const { codificar, barras } = await import('./codigoBarras.js')
  const doc = await nuevo(), cols = 3, filas = 8, w = 70, h = 37.125
  let n = 0
  for (const it of items) for (let k = 0; k < it.copias; k++) {
    if (n && n % (cols * filas) === 0) doc.addPage()
    const pos = n % (cols * filas), x = (pos % cols) * w, y = Math.floor(pos / cols) * h; n++
    doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.1); doc.rect(x + 1, y + 1, w - 2, h - 2)
    doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.text(doc.splitTextToSize(it.nombre, w - 8).slice(0, 2), x + 4, y + 6)
    doc.setFontSize(13); doc.text(soles(it.precio), x + w - 4, y + 6.5, { align: 'right', baseline: 'top' })
    const mod = codificar(it.codigo, 10), modW = Math.min(0.33, (w - 8) / mod.length), bx = x + (w - mod.length * modW) / 2
    doc.setFillColor(0, 0, 0); for (const [i, a] of barras(mod)) doc.rect(bx + i * modW, y + 15, a * modW, 14, 'F')
    doc.setFont('courier', 'normal'); doc.setFontSize(8.5); doc.text(it.codigo, x + w / 2, y + 33, { align: 'center' })
  }
  return doc
}
