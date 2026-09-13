// ResKonnect push event handlers imported by the generated Workbox service worker.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ResKonnect", body: event.data?.text() || "" };
  }

  const title = data.title || "ResKonnect";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/" },
    tag: data.tag || "reskonnect-update",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if ("navigate" in client) await client.navigate(url);
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
