// Code128 propio (sin librerías externas ni CDN): codificador para etiquetas y decodificador de respaldo
// para leer con la cámara cuando el navegador no tiene BarcodeDetector.
const PAT = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232'.split(' ') // anchos barra/espacio de los valores 0..105 (103 = inicio A, 104 = inicio B, 105 = inicio C)
const STOP = '2331112'
const INICIO_B = 104
// Código interno del producto: "MEG" + 5 dígitos (p. ej. PRD-012 → MEG00012). Solo caracteres de Code128-B.
export const codigoInterno = productoId => 'MEG' + String(String(productoId).replace(/\D/g, '') || '0').padStart(5, '0').slice(-5)
export const codigoValido = t => /^[ -~]{1,40}$/.test(String(t || ''))
// Devuelve la secuencia de módulos: "1" barra, "0" espacio, con zona blanca a los lados.
export function codificar(texto, zona = 10) {
  const t = String(texto)
  if (!codigoValido(t)) throw new Error('El código solo puede tener letras, números y signos básicos.')
  const vals = [INICIO_B, ...[...t].map(ch => ch.charCodeAt(0) - 32)]
  const suma = vals.reduce((s, v, i) => s + v * (i || 1), 0) % 103
  const anchos = [...vals, suma].map(v => PAT[v]).join('') + STOP
  let mod = '0'.repeat(zona), barra = true
  for (const a of anchos) { mod += (barra ? '1' : '0').repeat(Number(a)); barra = !barra }
  return mod + '0'.repeat(zona)
}
// Convierte "anchos" medidos (barra, espacio, barra…) en texto. Acepta lectura al revés.
export function decodificarAnchos(runs) {
  const r = intentar(runs); if (r) return r
  return intentar([...runs].reverse())
}
function simbolo(runs, i, n = 6) {
  const g = runs.slice(i, i + n); if (g.length < n) return null
  const total = g.reduce((a, b) => a + b, 0), u = total / (n === 6 ? 11 : 13)
  return g.map(x => Math.min(4, Math.max(1, Math.round(x / u)))).join('')
}
function intentar(runs) {
  for (let i = 0; i + 6 <= runs.length; i++) {
    const s = simbolo(runs, i), v = PAT.indexOf(s)
    if (v < 103) continue
    // la zona blanca previa debe ser amplia (≥ 5 módulos aprox.)
    const u = runs.slice(i, i + 6).reduce((a, b) => a + b, 0) / 11
    if (i > 0 && runs[i - 1] < u * 4) continue
    const vals = [v]; let j = i + 6, fin = false
    while (j + 6 <= runs.length) {
      if (simbolo(runs, j, 7) === STOP) { fin = true; break }
      const k = PAT.indexOf(simbolo(runs, j)); if (k < 0) break
      vals.push(k); j += 6
    }
    if (!fin || vals.length < 3) continue
    const datos = vals.slice(0, -1), chk = vals.at(-1)
    if (datos.reduce((s, x, n) => s + x * (n || 1), 0) % 103 !== chk) continue
    const txt = texto(datos); if (txt !== null) return txt
  }
  return null
}
function texto(vals) {
  let set = vals[0] === 103 ? 'A' : vals[0] === 104 ? 'B' : 'C', out = ''
  for (const v of vals.slice(1)) {
    if (set === 'C') { if (v < 100) out += String(v).padStart(2, '0'); else if (v === 100) set = 'B'; else if (v === 101) set = 'A'; else return null; continue }
    if (v === 99) { set = 'C'; continue }
    if (v === 100 && set === 'A') { set = 'B'; continue }
    if (v === 101 && set === 'B') { set = 'A'; continue }
    if (v >= 96) return null
    out += set === 'B' ? String.fromCharCode(v + 32) : String.fromCharCode(v < 64 ? v + 32 : v - 64)
  }
  return out
}
// Lee una fila de píxeles en gris (0..255) y devuelve los anchos empezando por la primera barra.
export function anchosDeFila(gris) {
  let min = 255, max = 0; for (const g of gris) { if (g < min) min = g; if (g > max) max = g }
  if (max - min < 40) return []
  const umbral = (min + max) / 2, runs = []; let actual = gris[0] < umbral, n = 0, empezo = false, blanco0 = 0
  for (const g of gris) {
    const negro = g < umbral
    if (!empezo) { if (negro) { empezo = true; runs.push(blanco0); actual = true; n = 1 } else blanco0++; continue }
    if (negro === actual) n++; else { runs.push(n); actual = negro; n = 1 }
  }
  if (empezo) runs.push(n)
  // runs[0] es la zona blanca inicial; el resto alterna barra/espacio. Se devuelve [blanco, barra, espacio, …]
  return runs
}
// Busca un código en una imagen (ImageData-like: {data, width, height}) leyendo varias filas.
export function leerImagen({ data, width, height }) {
  for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.45, 0.55, 0.35, 0.65]) {
    const y = Math.floor(height * f), fila = new Array(width)
    for (let x = 0; x < width; x++) { const o = (y * width + x) * 4; fila[x] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2] }
    const r = anchosDeFila(fila); if (r.length < 30) continue
    const t = decodificarAnchos(r.slice(1)) || decodificarAnchos(r); if (t) return t
  }
  return null
}
// Para dibujar: módulos → rectángulos [x, ancho] de cada barra.
export function barras(modulos) {
  const out = []; let i = 0
  while (i < modulos.length) { if (modulos[i] === '1') { let j = i; while (modulos[j] === '1') j++; out.push([i, j - i]); i = j } else i++ }
  return out
}
