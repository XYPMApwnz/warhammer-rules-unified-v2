const CACHE_PREFIX = "warhammer-rules-unified-v2-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const LIBRARY_FALLBACK = "./index.html";
const DEATH_GUARD_FALLBACK = "./books/death-guard/index.html";
const APP_SHELL = [
  "./",
  LIBRARY_FALLBACK,
  "./manifest.webmanifest",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/warhammer-40000-logo-optimized.png",
  "./assets/games-workshop-logo.png",
  "./assets/core-rules-cover-480.webp",
  "./assets/core-rules-cover-800.webp",
  "./assets/core-rules-cover-fallback.jpg",
  "./assets/core-rules-cover-thumb.jpg",
  "./assets/death-guard-cover-480.webp",
  "./assets/death-guard-cover-800.webp",
  "./assets/death-guard-cover-fallback.jpg",
  "./assets/death-guard-cover-thumb.jpg",
  "./assets/adeptus-mechanicus-cover-480.webp",
  "./assets/adeptus-mechanicus-cover-800.webp",
  "./assets/adeptus-mechanicus-cover-fallback.jpg",
  "./assets/adeptus-mechanicus-cover-thumb.jpg",
  "./books/death-guard/",
  DEATH_GUARD_FALLBACK,
  "./books/death-guard/assets/icon-v4.svg",
  "./books/death-guard/styles/tokens.css",
  "./books/death-guard/styles/layout.css",
  "./books/death-guard/styles/navigation.css",
  "./books/death-guard/styles/content.css",
  "./books/death-guard/styles/popups.css",
  "./books/death-guard/scripts/data.js",
  "./books/death-guard/scripts/navigation-controller.js",
  "./books/death-guard/scripts/popup-controller.js",
  "./books/death-guard/scripts/journey-controller.js",
  "./books/death-guard/scripts/ui-controllers.js",
  "./books/death-guard/scripts/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function fetchAndCache(request, cacheKey = request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheKey, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const fallback = url.pathname.includes("/books/death-guard/")
      ? DEATH_GUARD_FALLBACK
      : LIBRARY_FALLBACK;
    const networkUpdate = fetchAndCache(request);
    event.waitUntil(networkUpdate.then(() => undefined).catch(() => undefined));
    event.respondWith(
      networkUpdate.catch(async () => (await caches.match(request)) || caches.match(fallback))
    );
    return;
  }

  const networkUpdate = fetchAndCache(request);
  event.waitUntil(networkUpdate.then(() => undefined).catch(() => undefined));
  event.respondWith(caches.match(request).then((cached) => cached || networkUpdate));
});
