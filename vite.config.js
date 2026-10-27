import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
// Las herramientas de IA (transformers.js, onnxruntime-web, tesseract.js) se cargan solo al usarlas (import dinámico y workers).
// Sus modelos y .wasm viven en public/ia/ (ver scripts/preparar_ia.mjs): se sirven desde la misma app, sin CDN.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers', 'onnxruntime-web'] },
  build: { chunkSizeWarningLimit: 1500 },
  test: { include: ['test/**/*.test.js'], environment: 'node' }
})
