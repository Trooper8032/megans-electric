// Dónde viven las herramientas de IA. Por defecto, en la misma app (/ia/), así no se llama a ningún CDN
// y la política de seguridad (CSP) sigue en 'self'. Se preparan con: node scripts/preparar_ia.mjs
export const IA_BASE = (import.meta.env?.VITE_IA_BASE || (import.meta.env?.BASE_URL || '/') + 'ia/').replace(/\/?$/, '/')
export const IA = {
  whisper: 'onnx-community/whisper-base', whisperDtype: 'q8',
  modelos: IA_BASE + 'modelos/', ort: IA_BASE + 'ort/',
  u2: IA_BASE + 'modelos/u2netp/model.onnx',
  tess: { workerPath: IA_BASE + 'tesseract/worker.min.js', corePath: IA_BASE + 'tesseract/core', langPath: IA_BASE + 'tesseract/lang' }
}
