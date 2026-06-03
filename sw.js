/* ELLIA PARIS — Service Worker
   v5 (2026-06-03) : SCOPE ADMIN UNIQUEMENT.
   Le SW ne touche QUE les URLs /admin/* et /api/admin/*. Tout le reste du site
   (pages publiques, configurateur 3D, API publiques) passe en direct au navigateur,
   ce qui evite les faux 504 quand Hostinger redemarre apres un push. */
const CACHE = 'ellia-admin-v5';
const ASSETS = ['/assets/logo_black_trim.png','/assets/picto_black_trim.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  // Purge complete de tous les anciens caches (ellia-admin-v1, v2, v3, v4...)
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch(_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const p = url.pathname;

  // RESTRICTION DE SCOPE : le SW n'intercepte QUE les ressources admin.
  // Tout le reste (pages publiques, configurateur 3D, GLB, CDN, API publiques) -> bypass total.
  const isAdmin = p.startsWith('/admin') || p.startsWith('/api/admin');
  if (!isAdmin) return;

  // Admin : network-first avec fallback cache (au cas ou Hostinger redemarre)
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
        }
        return res;
      })
      .catch(() => caches.match(req))
      .then(r => r || fetch(req))
      .catch(() => new Response('', { status: 503, statusText: 'temporarily unavailable' }))
  );
});
