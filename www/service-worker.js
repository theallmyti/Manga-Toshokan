const CACHE_NAME = "manga-library-v3";
const BASE = "/manga-tracker-cloud/";

const ASSETS = [
    BASE,
    BASE + "index.html",
    BASE + "style.css",
    BASE + "app.js",
    BASE + "manifest.json",
    BASE + "logo.jpg",
    BASE + "bg-landscape.jpg",
    BASE + "icons/icon-192.png",
    BASE + "icons/icon-512.png"
];

// Install event
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log("Caching essential files...");
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch handling
self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).catch(() => caches.match(BASE + "index.html"));
        })
    );
});