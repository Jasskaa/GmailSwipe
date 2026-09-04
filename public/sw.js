// Service worker mínimo, a propósito. Esta app depende de datos en vivo y
// autenticados de Gmail (correos, tokens, sesión) — cachear esas respuestas
// sería peligroso (mostraría correos viejos, o rompería el login). Este SW
// existe solo para cumplir el criterio de instalabilidad de las PWA; no
// intercepta ni cachea ninguna petición, todo pasa directo a la red.
const CACHE_NAME = "gmail-swipe-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", () => {
  // no-op: dejamos que el navegador maneje cada petición normalmente.
});
