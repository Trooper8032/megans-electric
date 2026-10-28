// Whisper small multilingüe (MIT) con transformers.js (Apache-2.0), en un worker para no trabar la pantalla.
import { pipeline, env } from '@huggingface/transformers'
let P = null
self.onmessage = async e => {
  const { id, audio, cfg } = e.data
  try {
    if (!P) {
      env.useCustomCache = true; env.customCache = cachePartes(cfg)
      env.allowRemoteModels = false; env.allowLocalModels = true; env.localModelPath = cfg.modelos
      env.backends.onnx.wasm.wasmPaths = cfg.ort; env.backends.onnx.wasm.numThreads = 1; env.backends.onnx.wasm.proxy = false
      const t0 = performance.now()
      P = await pipeline('automatic-speech-recognition', cfg.whisper, { dtype: cfg.whisperDtype, device: 'wasm', progress_callback: p => self.postMessage({ prog: p }) })
      self.postMessage({ cargado: performance.now() - t0 })
    }
    const t1 = performance.now()
    const r = await P(audio, { language: 'spanish', task: 'transcribe', chunk_length_s: 30 })
    self.postMessage({ id, text: String(r.text || '').trim(), ms: performance.now() - t1 })
  } catch (err) { self.postMessage({ id, err: String(err?.message || err) }) }
}

// Caché del navegador + unión de archivos partidos (.part0, .part1…). Lo unido se guarda entero en la caché,
// así la 2.ª vez (y sin internet) se carga directo.
function cachePartes(cfg) {
  const abrir = () => caches.open('transformers-cache')
  return {
    async match(clave) {
      const c = await abrir(), r = await c.match(clave); if (r) return r
      const url = String(clave), base = cfg.modelos + cfg.whisper + '/'
      const rel = url.startsWith(base) ? url.slice(base.length) : Object.keys(cfg.partes || {}).find(k => url.endsWith('/' + k))
      const n = rel && cfg.partes?.[rel]; if (!n) return undefined
      const full = url.startsWith('http') || url.startsWith('/') ? url : base + rel
      const trozos = []; let cargado = 0, total = 0
      const resp = []
      for (let i = 0; i < n; i++) { const x = await fetch(`${full}.part${i}`); if (!x.ok) throw new Error('No se pudo descargar el asistente de voz. Revisa tu internet.'); resp.push(x); total += Number(x.headers.get('content-length') || 0) }
      for (const x of resp) {
        const rd = x.body.getReader(), partes = []
        for (;;) { const { done, value } = await rd.read(); if (done) break; partes.push(value); cargado += value.length; self.postMessage({ prog: { status: 'progress', file: rel, loaded: cargado, total: total || cargado } }) }
        trozos.push(new Blob(partes))
      }
      const blob = new Blob(trozos), r2 = new Response(blob, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(blob.size) } })
      try { await c.put(clave, r2.clone()) } catch { /* sin espacio: igual se usa esta vez */ }
      return r2
    },
    async put(clave, r) { try { await (await abrir()).put(clave, r) } catch { /* nada */ } }
  }
}
