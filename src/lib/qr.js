import qrcode from 'qrcode-generator'
// Genera el QR como SVG (se muestra y se imprime sin depender de servicios externos).
export function qrSvg(texto, celda = 6, margen = 2) {
  const q = qrcode(0, 'M'); q.addData(String(texto)); q.make()
  return q.createSvgTag({ cellSize: celda, margin: margen, scalable: true })
}
export const qrDataUrl = texto => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrSvg(texto))
// Matriz del QR (para dibujarlo como vectores dentro del PDF, sin imágenes ni canvas).
export function qrMatriz(texto) {
  const q = qrcode(0, 'M'); q.addData(String(texto)); q.make()
  const n = q.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)))
}
