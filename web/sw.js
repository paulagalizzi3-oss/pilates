// Service worker de Control de Turnos.
// Permite instalar la app y que abra rápido. Los datos (/api/...) SIEMPRE se
// piden al servidor: nunca se muestran turnos o créditos viejos guardados.
const CACHE = 'turnos-v1';
const SHELL = [
  '/',
  '/web/css/style.css?v=8',
  '/web/js/app.js?v=8',
  '/web/images/logo.jpg',
  '/web/images/icon-192.png',
  '/web/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo GET del mismo sitio; la API siempre va a la red.
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // Páginas: primero la red (versión más nueva); sin conexión, la copia o el aviso.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/web/offline.html'))
    );
    return;
  }

  // Archivos (estilos, scripts, imágenes): la red, y si falla, la copia guardada.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
