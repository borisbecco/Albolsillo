// Service worker de referencia. Registrar desde la app: navigator.serviceWorker.register('/sw.js')
const SHELL = 'albolsillo-shell-v1';
const ASSETS = ['/', '/manifest.webmanifest', '/assets/brand/icon-192.png', '/assets/brand/icon-512.png', '/bolsi.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k))))); self.clients.claim(); });

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Web Share Target: Android manda el comprobante compartido acá
  if (e.request.method === 'POST' && url.pathname === '/share') {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const file = form.get('file');
      if (file) {
        const body = new FormData(); body.append('file', file);
        try { await fetch('/api/detected/share', { method: 'POST', body, credentials: 'include' }); } catch (_) {}
      }
      return Response.redirect('/?ver=detectados', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // App shell: red primero, caché si no hay conexión
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(SHELL).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('/'))));
});

// Push del backend cuando llegan gastos detectados
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification('Albolsillo', { body: d.body || 'Detectamos gastos nuevos. Revisalos antes de sumarlos.', icon: '/assets/brand/icon-192.png', badge: '/assets/brand/icon-192.png', tag: 'det', data: { url: '/?ver=detectados' } }));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.openWindow(e.notification.data.url)); });
