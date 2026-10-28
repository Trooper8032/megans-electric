// Motor de IA en el navegador. Cada herramienta se descarga SOLO cuando se usa por primera vez (carga diferida)
// y después queda en el equipo. Nada sale del celular o la computadora: audios y fotos no se suben a ningún lado.
import { IA } from './config.js'
export const medidas = {}
const MB = b => (b / 1048576).toFixed(b > 1e7 ? 0 : 1).replace('.', ',') + ' MB'

// ---------- Voz (Whisper) ----------
let WW = null, WN = 0, listoVoz = false; const WP = {}
let alProgreso = null
function whisper() {
  if (WW) return WW
  WW = new Worker(new URL('./whisper.worker.js', import.meta.url), { type: 'module' })
  const arch = {}
  WW.onmessage = e => {
    const d = e.data
    if (d.prog) { const p = d.prog; if (p.status === 'progress' && p.total) { arch[p.file] = [p.loaded, p.total]; const L = Object.values(arch).reduce((s, x) => s + x[0], 0), T = Object.values(arch).reduce((s, x) => s + x[1], 0); medidas.vozBytes = T; alProgreso?.(`Descargando el asistente de voz (solo la 1.ª vez): ${MB(L)} de ${MB(T)}`, L / T * 100) } return }
    if (d.cargado) { medidas.vozCargaMs = d.cargado; listoVoz = true; alProgreso?.('Escuchando…', null); return }
    const r = WP[d.id]; delete WP[d.id]; if (r) d.err ? r[1](new Error(d.err)) : r[0](d)
  }
  WW.onerror = e => { Object.values(WP).forEach(r => r[1](new Error(e.message || 'No se pudo iniciar el asistente de voz.'))); for (const k in WP) delete WP[k]; WW = null }
  return WW
}
export const vozLista = () => listoVoz
export async function audioA16k(blob) {
  const buf = await blob.arrayBuffer(), AC = window.AudioContext || window.webkitAudioContext
  let ctx; try { ctx = new AC({ sampleRate: 16000 }) } catch { ctx = new AC() }
  const ab = await new Promise((ok, mal) => { const p = ctx.decodeAudioData(buf, ok, mal); if (p?.then) p.then(ok, mal) }); ctx.close?.()
  let d = ab.getChannelData(0)
  if (ab.numberOfChannels > 1) { const d2 = ab.getChannelData(1), m = new Float32Array(d.length); for (let i = 0; i < d.length; i++) m[i] = (d[i] + d2[i]) / 2; d = m }
  if (ab.sampleRate !== 16000) { const off = new OfflineAudioContext(1, Math.ceil(ab.duration * 16000), 16000), s = off.createBufferSource(); s.buffer = ab; s.connect(off.destination); s.start(); d = (await off.startRendering()).getChannelData(0) }
  return new Float32Array(d)
}
export async function transcribir(blob, onProg) {
  alProgreso = onProg; const t0 = performance.now()
  onProg?.(listoVoz ? 'Escuchando…' : `Preparando el asistente de voz (la 1.ª vez descarga unos ${IA.vozMB} MB; después funciona sin internet)…`, listoVoz ? null : 1)
  const audio = await audioA16k(blob); medidas.audioSeg = audio.length / 16000
  const w = whisper()
  const r = await new Promise((ok, mal) => { const id = ++WN; WP[id] = [ok, mal]; w.postMessage({ id, audio, cfg: { modelos: IA.modelos, ort: IA.ort, whisper: IA.whisper, whisperDtype: IA.whisperDtype, partes: IA.partes } }, [audio.buffer]) })
  medidas.transcribirMs = r.ms; medidas.vozTotalMs = performance.now() - t0; medidas.texto = r.text
  return r.text
}

// ---------- Lectura de fotos (tesseract.js) ----------
let TW = null
async function ocr(onProg) {
  if (TW) return TW
  const { createWorker } = await import('tesseract.js'); const t0 = performance.now()
  TW = await createWorker('spa', 1, { ...IA.tess, workerBlobURL: false, gzip: true, logger: m => { if (/load|init/.test(m.status)) onProg?.('Preparando el lector de fotos (solo la 1.ª vez)…', (m.progress || 0) * 100); else if (m.status === 'recognizing text') onProg?.('Leyendo la foto…', m.progress * 100) } })
  medidas.ocrCargaMs = performance.now() - t0; return TW
}
async function prepImagen(file, max = 2000, invertir = false) {
  const bm = await createImageBitmap(file), k = Math.min(1, max / Math.max(bm.width, bm.height)), c = document.createElement('canvas')
  c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); const g = c.getContext('2d'); g.drawImage(bm, 0, 0, c.width, c.height); bm.close?.()
  const id = g.getImageData(0, 0, c.width, c.height), d = id.data
  for (let i = 0; i < d.length; i += 4) { let y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; if (invertir) y = 255 - y; d[i] = d[i + 1] = d[i + 2] = y }
  g.putImageData(id, 0, 0); return c
}
export async function leerFoto(file, onProg, { invertir = false, max = 2000 } = {}) {
  const w = await ocr(onProg); const t0 = performance.now()
  const r = await w.recognize(await prepImagen(file, max, invertir)); medidas.ocrMs = performance.now() - t0
  return r.data.text || ''
}

// ---------- Mejorar foto (quitar fondo) ----------
let BW = null, BN = 0, listoFondo = false; const BP = {}
let alProgF = null
function fondo() {
  if (BW) return BW
  BW = new Worker(new URL('./fondo.worker.js', import.meta.url), { type: 'module' })
  BW.onmessage = e => {
    const d = e.data
    if (d.prog) { medidas.fondoBytes = d.prog[1]; alProgF?.(`Descargando la herramienta (solo la 1.ª vez): ${MB(d.prog[0])} de ${MB(d.prog[1])}`, d.prog[0] / d.prog[1] * 100); return }
    if (d.cargado) { medidas.fondoCargaMs = d.cargado; listoFondo = true; alProgF?.('Quitando el fondo…', null); return }
    const r = BP[d.id]; delete BP[d.id]; if (r) d.err ? r[1](new Error(d.err)) : r[0](d)
  }
  BW.onerror = e => { Object.values(BP).forEach(r => r[1](new Error(e.message || 'No se pudo iniciar la herramienta de fotos.'))); for (const k in BP) delete BP[k]; BW = null }
  return BW
}
export async function quitarFondo(blob, onProg) {
  alProgF = onProg; onProg?.(listoFondo ? 'Quitando el fondo…' : 'Preparando… (la 1.ª vez descarga 4,4 MB)', listoFondo ? null : 2)
  const bmp = await createImageBitmap(blob), w = fondo(), t0 = performance.now()
  const r = await new Promise((ok, mal) => { const id = ++BN; BP[id] = [ok, mal]; w.postMessage({ id, bmp, cfg: { ort: IA.ort, u2: IA.u2 } }, [bmp]) })
  medidas.fondoMs = r.ms; medidas.fondoTotalMs = performance.now() - t0; return r
}
// Pone el objeto recortado sobre un fondo de color, centrado y con sombra suave. Devuelve un dataURL JPEG.
export async function componer(png, caja, color, lado = 900, calidad = 0.82) {
  const im = await createImageBitmap(png), c = document.createElement('canvas'); c.width = c.height = lado; const g = c.getContext('2d')
  g.fillStyle = color || '#ffffff'; g.fillRect(0, 0, lado, lado)
  const [x0, y0, x1, y1] = caja, bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = Math.min(lado * 0.84 / bw, lado * 0.84 / bh), dw = bw * k, dh = bh * k
  g.save(); g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 24; g.shadowOffsetY = 10; g.drawImage(im, x0, y0, bw, bh, (lado - dw) / 2, (lado - dh) / 2, dw, dh); g.restore(); im.close?.()
  return c.toDataURL('image/jpeg', calidad)
}
export const COLORES_FONDO = [['#ffffff', 'Blanco'], ['#f1f2f4', 'Gris claro'], ['#fbf6ec', 'Crema'], ['#e6f2fb', 'Celeste'], ['#ecebf7', 'Lila MEGANS'], ['#fff6d6', 'Amarillo suave']]
export const dataUrlABlob = u => { const [cab, b64] = String(u).split(','), bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: (/data:([^;]+)/.exec(cab) || [])[1] || 'image/jpeg' }) }
