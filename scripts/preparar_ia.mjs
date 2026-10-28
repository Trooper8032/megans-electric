// Prepara las herramientas de IA para que se sirvan DESDE LA MISMA APP (sin CDN, la CSP sigue en 'self').
//   node scripts/preparar_ia.mjs            -> copia los .wasm desde node_modules y descarga los modelos que falten
//   node scripts/preparar_ia.mjs --sin-red  -> solo copia los .wasm (no descarga nada)
// Todo queda en public/ia/ (fuera de git; ver .gitignore). Licencias: Whisper (MIT), transformers.js (Apache-2.0),
// onnxruntime-web (MIT), tesseract.js / tesseract.js-core (Apache-2.0), datos 'spa' de tessdata (Apache-2.0), U-2-Netp (Apache-2.0).
import { mkdirSync, copyFileSync, existsSync, statSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
const R = new URL('..', import.meta.url).pathname, P = join(R, 'public/ia'), sinRed = process.argv.includes('--sin-red')
const cp = (de, a) => { mkdirSync(dirname(a), { recursive: true }); copyFileSync(de, a) }
// 1) wasm de onnxruntime-web (lo usan Whisper y quitar fondo)
const ort = join(R, 'node_modules/onnxruntime-web/dist')
for (const f of readdirSync(ort).filter(f => /^ort-wasm-simd-threaded(\.jsep)?\.(mjs|wasm)$/.test(f))) cp(join(ort, f), join(P, 'ort', f))
// 2) tesseract.js: worker + núcleo wasm
cp(join(R, 'node_modules/tesseract.js/dist/worker.min.js'), join(P, 'tesseract/worker.min.js'))
const core = join(R, 'node_modules/tesseract.js-core')
for (const f of readdirSync(core).filter(f => /^tesseract-core.*-lstm\.wasm\.js$/.test(f))) cp(join(core, f), join(P, 'tesseract/core', f))
// 3) modelos
const HF = 'https://huggingface.co'
const MODELOS = [
  ...['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'added_tokens.json', 'normalizer.json', 'vocab.json', 'merges.txt',
    'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'].map(f => [`${HF}/onnx-community/whisper-small/resolve/main/${f}`, `modelos/onnx-community/whisper-small/${f}`]),
  [`${HF}/BritishWerewolf/U-2-Netp/resolve/main/onnx/model.onnx`, 'modelos/u2netp/model.onnx'],
  ['https://cdn.jsdelivr.net/npm/@tesseract.js-data/spa@1.0.0/4.0.0_best_int/spa.traineddata.gz', 'tesseract/lang/spa.traineddata.gz']
]
if (!sinRed) for (const [url, rel] of MODELOS) {
  const dest = join(P, rel); if ((existsSync(dest) && statSync(dest).size > 0) || existsSync(dest + '.part0')) continue
  const r = await fetch(url); if (!r.ok) { console.error('No se pudo descargar', url, r.status); continue }
  const b = Buffer.from(await r.arrayBuffer()); mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, b)
  if (rel.endsWith('.gz')) gunzipSync(b) // valida que el gzip esté sano
  console.log('descargado', rel, (b.length / 1048576).toFixed(1), 'MB')
}
// GitHub Pages no acepta archivos > 100 MB: se parten en trozos de 90 MB (.part0, .part1…) y se borra el entero.
import { readFileSync, unlinkSync } from 'node:fs'
const TROZO = 90 * 1048576
for (const [, rel] of MODELOS) {
  const f = join(P, rel); if (!existsSync(f) || statSync(f).size <= 95 * 1048576) continue
  const b = readFileSync(f), n = Math.ceil(b.length / TROZO)
  for (let i = 0; i < n; i++) writeFileSync(`${f}.part${i}`, b.subarray(i * TROZO, (i + 1) * TROZO))
  unlinkSync(f); console.log('partido', rel, 'en', n, 'partes (actualiza IA.partes en src/ia/config.js si cambia)')
}
const partido = rel => existsSync(join(P, rel + '.part0'))
const falta = MODELOS.filter(([, rel]) => !existsSync(join(P, rel)) && !partido(rel) && !/added_tokens|normalizer|vocab|merges|special/.test(rel))
console.log(falta.length ? `Faltan modelos: ${falta.map(x => x[1]).join(', ')}` : 'Herramientas de IA listas en public/ia/')
