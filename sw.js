/* ELLIA PARIS — Service Worker
   v6 (2026-06-03) : KILL-SWITCH PUBLIC + ADMIN-ONLY CACHE.
   - Sur les pages publiques (tout sauf /admin*) : le SW s'AUTO-DÉSINSCRIT
     et PURGE TOUS les caches au premier fetch. Aucun cache ne survit.
   - Sur /admin* : network-first avec fallback cache (utile si Hostinger redémarre).
   Objectif : effacer définitivement les anciens SW v1-v5 piégés sur les iPhones
   qui servent encore du vieux HTML/CSS sans le garde-fou préloader. */
const CACHE = 'ellia-admin-v6';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Purge complète de TOUS les anciens caches (v1, v2, v3, v4, v5)
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch(_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const p = url.pathname;

  const isAdmin = p.startsWith('/admin') || p.startsWith('/api/admin');

  // KILL-SWITCH : sur scope public, le SW s'auto-désinscrit et purge tout.
  // Le 1er fetch laissera passer la requête au navigateur ; le 2e n'aura plus de SW.
  if (!isAdmin) {
    e.respondWith((async () => {
      // 1) Purge TOUS les caches
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch(_){}
      // 2) Désinscription du SW
      try { await self.registration.unregister(); } catch(_){}
      // 3) Recharge les onglets pour repartir SANS SW
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(c => { try { c.navigate(c.url); } catch(_){} });
      } catch(_){}
      // 4) Cette requête passe en direct au réseau
      return fetch(req);
    })());
    return;
  }

  // Admin : network-first avec fallback cache (au cas où Hostinger redémarre)
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
