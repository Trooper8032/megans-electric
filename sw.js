// Service worker: guarda la aplicación para abrirla sin conexión (los datos viven en el navegador).
const V = 'megans-v2-5', VIA = 'megans-ia-motor-1'
const R = self.registration.scope; const P = new URL(R).pathname
const BASE = [R, R+'manifest.webmanifest', R+'icon-192.png', R+'img/logo-640.png']
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(BASE)).then(() => self.skipWaiting())) })
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('megans-') && x !== V && x !== VIA).map(x => caches.delete(x)))).then(() => self.clients.claim())))
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return
  // Modelos de IA (~235 MB): NO van aquí; el asistente los guarda en su propia caché ('transformers-cache'), que no se borra.
  const ruta = new URL(e.request.url).pathname
  if (ruta.startsWith(P+'ia/modelos/')) return
  // Motores de IA (wasm de onnxruntime y tesseract): se guardan para usar la voz y las fotos sin internet.
  if (ruta.startsWith(P+'ia/')) { e.respondWith(caches.open(VIA).then(c => c.match(e.request).then(h => h || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()).catch(() => {}); return r })))); return }
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)).catch(() => {}) } return r })
    .catch(() => caches.match(e.request).then(r => r || caches.match(R))))
})
