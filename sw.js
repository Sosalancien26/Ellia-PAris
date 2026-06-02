/* ELLIA PARIS — Service Worker
   Strategy : network-first pour HTML/API, cache-first pour assets statiques.
   v3 : bypass complet pour le configurateur 3D (GLB / Three.js modules) qui ne doit
        jamais etre servi en offline pour eviter un canvas WebGL casse. */
const CACHE = 'ellia-admin-v3';
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
  // On skip les requetes non-GET et les schemes non-http (chrome-extension, etc.)
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch(_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // BYPASS COMPLET pour les assets du configurateur 3D : on laisse le navigateur gerer
  // (sinon un GLB en cache obsolete + une coupure reseau = canvas blanc + erreur 504)
  const p = url.pathname;
  if (p.endsWith('.glb') || p.endsWith('.bin') ||
      p.includes('three.module') || p.includes('GLTFLoader') ||
      p.includes('DRACOLoader') || p.includes('OrbitControls') ||
      p.includes('RoomEnvironment') || p.includes('jsdelivr') || p.includes('unpkg')) {
    return; // pas de respondWith -> requete reseau directe
  }

  // API et HTML : network-first avec fallback cache puis reponse vide pour eviter "Failed to fetch"
  if (p.startsWith('/api/') || (req.headers.get('accept')||'').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .catch(() => caches.match(req))
        .then(r => r || new Response('', { status:504, statusText:'offline' }))
    );
    return;
  }
  // Assets : cache-first avec catch global pour ne jamais planter le SW
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
      }
      return res;
    })).catch(() => new Response('', { status:504, statusText:'offline' }))
  );
});
