// Service worker: guarda la aplicación para abrirla sin conexión (los datos viven en el navegador).
const V = 'megans-v2-2'
const R = self.registration.scope; const P = new URL(R).pathname
const BASE = [R, R+'manifest.webmanifest', R+'icon-192.png', R+'img/logo-640.png']
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(BASE)).then(() => self.skipWaiting())) })
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())))
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return
  // Las herramientas de IA (modelos de ~80 MB) no se copian en esta caché: tienen la suya y la del navegador.
  if (new URL(e.request.url).pathname.startsWith(P+'ia/')) return
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)).catch(() => {}) } return r })
    .catch(() => caches.match(e.request).then(r => r || caches.match(R))))
})
