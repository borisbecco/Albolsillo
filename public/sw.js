// Service worker de Albolsillo: app instalable (caché para abrir sin conexión),
// comprobantes compartidos desde Android (Web Share Target) y avisos push.
const SHELL = "albolsillo-shell-v2";
const SHARED = "albolsillo-compartido";
const PRECACHE = ["/manifest.webmanifest", "/brand/icon-192.png", "/brand/icon-512.png", "/brand/favicon-64.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== SHARED).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Web Share Target: Android manda el comprobante acá. El SW no tiene la sesión (vive en memoria
  // en la app), así que guarda el archivo y abre la bandeja; la app lo sube con su sesión.
  if (req.method === "POST" && url.pathname === "/share") {
    event.respondWith(
      (async () => {
        try {
          const form = await req.formData();
          const file = form.get("file");
          if (file && typeof file !== "string") {
            const cache = await caches.open(SHARED);
            await cache.put(
              "/compartido/ultimo",
              new Response(file, { headers: { "content-type": file.type || "application/octet-stream", "x-file-name": encodeURIComponent(file.name || "comprobante") } }),
            );
          }
        } catch {}
        return Response.redirect("/?ver=detectados&compartido=1", 303);
      })(),
    );
    return;
  }

  if (req.method !== "GET" || url.pathname.startsWith("/api/")) return;

  // Archivos estáticos con hash, logos e ilustraciones: caché primero.
  if (/^\/(_next\/static|bolsi|brand|logos)\//.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Páginas: red primero; sin conexión, la última versión guardada.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "Albolsillo", body: "Tenés un aviso nuevo.", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/brand/icon-192.png",
      badge: "/brand/favicon-64.png",
      tag: data.tag,
      data: { url: data.url },
      lang: "es-AR",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin));
      if (open) return open.focus().then((c) => c.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
