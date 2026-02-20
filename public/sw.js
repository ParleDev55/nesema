// Kill-switch service worker.
// Replaces the previous next-pwa Workbox SW which was intercepting
// Next.js App Router RSC requests and causing blank-screen hangs.
// This SW immediately unregisters itself so browsers return to
// normal (no service worker) behaviour.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration.unregister().then(() =>
      self.clients
        .matchAll({ type: "window" })
        .then((clients) => clients.forEach((c) => c.navigate(c.url)))
    )
  );
});
