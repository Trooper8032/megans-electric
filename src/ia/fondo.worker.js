// Quitar fondo: U-2-Netp (Apache-2.0, 4,4 MB) con onnxruntime-web (MIT). Mismo método que RiverMarket (ia.js).
import * as ort from 'onnxruntime-web'
let S = null
async function modelo(u) {
  let c = null
  try { c = await caches.open('megans-ia-modelos'); const h = await c.match(u); if (h) return new Uint8Array(await h.arrayBuffer()) } catch { /* sin caché */ }
  const r = await fetch(u); if (!r.ok) throw new Error('No se pudo descargar la herramienta de fotos.')
  const tot = +r.headers.get('content-length') || 4.6e6, rd = r.body.getReader(), partes = []; let n = 0
  for (;;) { const { done, value } = await rd.read(); if (done) break; partes.push(value); n += value.length; self.postMessage({ prog: [n, tot] }) }
  const b = new Uint8Array(n); let o = 0; for (const p of partes) { b.set(p, o); o += p.length }
  try { c && await c.put(u, new Response(b)) } catch { /* nada */ }
  return b
}
self.onmessage = async e => {
  const { id, bmp, cfg } = e.data
  try {
    const t0 = performance.now()
    if (!S) { ort.env.wasm.wasmPaths = cfg.ort; ort.env.wasm.numThreads = 1; S = await ort.InferenceSession.create(await modelo(cfg.u2), { executionProviders: ['wasm'] }); self.postMessage({ cargado: performance.now() - t0 }) }
    const t1 = performance.now(), N = 320, W = bmp.width, H = bmp.height, c = new OffscreenCanvas(N, N), g = c.getContext('2d'); g.drawImage(bmp, 0, 0, N, N)
    const px = g.getImageData(0, 0, N, N).data
    let mx = 0; for (let i = 0; i < px.length; i += 4) mx = Math.max(mx, px[i], px[i + 1], px[i + 2]); mx = mx || 255
    const M = [0.485, 0.456, 0.406], SD = [0.229, 0.224, 0.225], x = new Float32Array(3 * N * N)
    for (let i = 0; i < N * N; i++) for (let k = 0; k < 3; k++) x[k * N * N + i] = (px[i * 4 + k] / mx - M[k]) / SD[k]
    const out = await S.run({ [S.inputNames[0]]: new ort.Tensor('float32', x, [1, 3, N, N]) }), m = out[S.outputNames[0]].data
    let lo = 1e9, hi = -1e9; for (const v of m) { if (v < lo) lo = v; if (v > hi) hi = v }
    const A = new Float32Array(N * N); for (let i = 0; i < N * N; i++) { const a = (m[i] - lo) / (hi - lo || 1); A[i] = Math.min(1, Math.max(0, (a - 0.15) / 0.7)) }
    // quedarse con el objeto principal (la mancha más grande)
    const L = new Int32Array(N * N), Q = new Int32Array(N * N); let nl = 0, mejor = 0, mejorA = 0
    for (let i = 0; i < N * N; i++) {
      if (A[i] < 0.5 || L[i]) continue; nl++; let h = 0, t = 0, ar = 0; Q[t++] = i; L[i] = nl
      while (h < t) { const k = Q[h++]; ar++; const xx = k % N, yy = (k / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = xx + dx, b = yy + dy; if (a < 0 || b < 0 || a >= N || b >= N) continue; const kk = b * N + a; if (!L[kk] && A[kk] >= 0.5) { L[kk] = nl; Q[t++] = kk } } }
      if (ar > mejorA) { mejorA = ar; mejor = nl }
    }
    const K = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) if (L[i] === mejor) K[i] = 1
    for (let r = 0; r < 3; r++) { const K2 = K.slice(); for (let i = 0; i < N * N; i++) if (!K[i]) { const xx = i % N; if ((xx > 0 && K[i - 1]) || (xx < N - 1 && K[i + 1]) || (i >= N && K[i - N]) || (i < N * N - N && K[i + N])) K2[i] = 1 } K.set(K2) }
    const mc = new OffscreenCanvas(N, N), mg = mc.getContext('2d'), mi = mg.createImageData(N, N)
    for (let i = 0; i < N * N; i++) mi.data[i * 4 + 3] = K[i] ? Math.round(A[i] * 255) : 0; mg.putImageData(mi, 0, 0)
    const oc = new OffscreenCanvas(W, H), og = oc.getContext('2d'); og.drawImage(mc, 0, 0, W, H); og.globalCompositeOperation = 'source-in'; og.drawImage(bmp, 0, 0)
    const al = og.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = 0, y1 = 0
    for (let y = 0; y < H; y += 2) for (let xx = 0; xx < W; xx += 2) if (al[(y * W + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y }
    const png = await oc.convertToBlob({ type: 'image/png' })
    self.postMessage({ id, png, caja: x1 > x0 ? [x0, y0, x1, y1] : [0, 0, W, H], ms: performance.now() - t1 })
  } catch (err) { self.postMessage({ id, err: String(err?.message || err) }) }
}
