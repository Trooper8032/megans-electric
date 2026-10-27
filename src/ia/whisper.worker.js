// Whisper base (MIT) con transformers.js (Apache-2.0), en un worker para no trabar la pantalla.
import { pipeline, env } from '@huggingface/transformers'
let P = null
self.onmessage = async e => {
  const { id, audio, cfg } = e.data
  try {
    if (!P) {
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
