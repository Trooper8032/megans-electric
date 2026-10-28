// Dónde viven las herramientas de IA. Por defecto, en la misma app (/ia/), así no se llama a ningún CDN
// y la política de seguridad (CSP) sigue en 'self'. Se preparan con: node scripts/preparar_ia.mjs
export const IA_BASE = (import.meta.env?.VITE_IA_BASE || (import.meta.env?.BASE_URL || '/') + 'ia/').replace(/\/?$/, '/')
export const IA = {
  // Whisper small multilingüe (MIT), cuantizado q8: ~235 MB, bastante más preciso en español que el base (~78 MB).
  // GitHub Pages no acepta archivos de más de 100 MB: los archivos grandes se sirven en partes de 90 MB y el
  // worker los vuelve a unir y los guarda en la caché del navegador (después funciona sin internet).
  whisperDtype: 'q8',
  voz: {
    rapida: { whisper: 'onnx-community/whisper-base', mb: 78, partes: {} },
    precisa: { whisper: 'onnx-community/whisper-small', mb: 235, partes: { 'onnx/decoder_model_merged_quantized.onnx': 2 } }
  },
  modelos: IA_BASE + 'modelos/', ort: IA_BASE + 'ort/',
  u2: IA_BASE + 'modelos/u2netp/model.onnx',
  tess: { workerPath: IA_BASE + 'tesseract/worker.min.js', corePath: IA_BASE + 'tesseract/core', langPath: IA_BASE + 'tesseract/lang' }
}
