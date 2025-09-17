const CACHE_NAME = "jfw-luettringhausen-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js?v=1.0.0",
  "./manifest.json",
  "./icons/pwa-192.png",
  "./icons/pwa-512.png"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
});
self.addEventListener("activate", (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
});
self.addEventListener("fetch", (e)=>{
  const url = new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(caches.match(e.request).then(res=> res || fetch(e.request)));
  }
});
