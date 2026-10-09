// The old poly-lang app registered a Workbox service worker on this domain. Browsers that still have it
// fetch /sw.js when checking for updates; this replacement clears its caches and removes itself,
// so returning visitors get the current site instead of the old cached shell.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window" });
      windows.forEach((client) => client.navigate(client.url));
    })(),
  );
});
