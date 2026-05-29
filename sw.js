/* ELLIA PARIS — Service Worker (PWA admin)
   Strategy : network-first pour HTML/API, cache-first pour assets statiques. */
const CACHE = 'ellia-admin-v1';
const ASSETS = ['/assets/logo_black_trim.png','/assets/picto_black_trim.png','/styles.css?v=23'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // API et HTML : network-first
  if (url.pathname.startsWith('/api/') || req.headers.get('accept')?.includes('text/html')) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  // Assets : cache-first
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
    if (res.ok && req.method === 'GET') {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
    }
    return res;
  })));
});
