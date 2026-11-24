// Service worker de Albolsillo: muestra los avisos push de vencimientos.
self.addEventListener("push", (event) => {
  let data = { title: "Albolsillo", body: "Tenés un aviso nuevo.", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/brand/favicon-64.png",
      badge: "/brand/favicon-64.png",
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
