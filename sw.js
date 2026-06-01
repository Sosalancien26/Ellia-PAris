/* ELLIA PARIS — Service Worker (PWA admin)
   Strategy : network-first pour HTML/API, cache-first pour assets statiques. */
// IMPORTANT : bumper ce numero force tous les clients a purger leur cache et recharger
const CACHE = 'ellia-v4';
const ASSETS = ['/assets/logo_black_trim.png','/assets/picto_black_trim.png','/styles.css?v=25'];

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
  // On skip les requetes non-GET et les schemes non-http (chrome-extension, etc.)
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch(_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // API et HTML : network-first avec fallback cache puis reponse vide pour eviter "Failed to fetch"
  if (url.pathname.startsWith('/api/') || (req.headers.get('accept')||'').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .catch(() => caches.match(req))
        .then(r => r || new Response('', { status:504, statusText:'offline' }))
    );
    return;
  }
  // Assets : stale-while-revalidate — sert le cache mais update en arriere-plan
  // Garantit qu'une nouvelle version est recuperee a chaque visite sans bloquer l'affichage
  e.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
        }
        return res;
      }).catch(() => cached || new Response('', { status:504, statusText:'offline' }));
      return cached || fetchPromise;
    })
  );
});
