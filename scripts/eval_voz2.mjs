// Precisión y tiempo de la voz con nombres REALES del catálogo (audios piper fuera del repo).
// node scripts/eval_voz2.mjs whisper-base|whisper-small  (modelos en $MODELOS, por defecto /tmp/modelos/)
import fs from 'node:fs'
import { pipeline, env } from '@huggingface/transformers'
import { entenderComando, sinTilde } from '../src/lib/voz.js'
import { CATALOGO } from '../src/data/catalogo.js'
const D = process.env.PRUEBAS || '/workspace/megans-ia-pruebas/v2', modelo = process.argv[2] || 'whisper-small'
const productos = CATALOGO.map(([id, nombre, categoria]) => ({ id, nombre, categoria, precio: 1, stock: 99, activo: true }))
const corpus = JSON.parse(fs.readFileSync(`${D}/corpus.json`))
const wav = f => { const b = fs.readFileSync(f); const sr = b.readUInt32LE(24); let o = 12; while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4); const n = b.readUInt32LE(o + 4) / 2, d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = b.readInt16LE(o + 8 + i * 2) / 32768; const r = 16000 / sr, m = Math.floor(n * r), out = new Float32Array(m); for (let i = 0; i < m; i++) { const x = i / r, j = Math.floor(x), f2 = x - j; out[i] = (d[j] || 0) * (1 - f2) + (d[j + 1] || 0) * f2 } return out }
let asr = null
if (modelo !== 'texto') { env.allowRemoteModels = false; env.localModelPath = process.env.MODELOS || '/tmp/modelos/'; asr = await pipeline('automatic-speech-recognition', 'onnx-community/' + modelo, { dtype: 'q8', device: 'cpu', session_options: { intraOpNumThreads: 1 } }) }
let bien = 0, total = 0, oido = 0; const ms = [], fallos = []
for (const c of corpus) for (const v of ['MX', 'ES']) {
  let txt = c.texto, t = 0
  if (asr) { const a = wav(`${D}/${c.id}-${v}.wav`), t0 = performance.now(); txt = String((await asr(a, { language: 'spanish', task: 'transcribe' })).text).trim(); t = performance.now() - t0; ms.push([t, a.length / 16000]) }
  const o = entenderComando(txt, productos), vt = o.venta || {}
  const ls = (vt.lineas || []).filter(l => l.encontrado)
  const okL = ls.length === c.lineas.length && c.lineas.every(([q, n], i) => ls[i].cantidad === q && ls[i].nombre === n)
  const ok = o.tipo === 'venta' && okL && vt.medio === c.medio && sinTilde(vt.cliente || '').startsWith(sinTilde(c.cliente))
  total++; if (ok) bien++; else fallos.push(`${c.id}-${v}: «${txt}» → ${o.tipo} ${JSON.stringify({ l: (vt.lineas || []).map(l => `${l.cantidad} ${l.nombre || '?' + l.nombreDicho}${l.duda ? '(duda)' : ''}`), m: vt.medio, c: vt.cliente })}`)
}
const med = ms.length ? ms.map(x => x[0]).sort((a, b) => a - b)[ms.length >> 1] : 0, seg = ms.length ? ms.reduce((s, x) => s + x[1], 0) / ms.length : 0
console.log(`${modelo}: ${bien}/${total} comandos completos bien · mediana ${Math.round(med)} ms por comando (audio medio ${seg.toFixed(1)} s, 1 hilo)`)
console.log(fallos.join('\n'))
