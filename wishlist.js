/* ELLIA PARIS — Wishlist (favoris) cote client */
(function(){
  if (typeof window === 'undefined') return;
  let supa = null;
  function getSupa(){
    if (supa) return supa;
    // Le client Supabase est expose sous window.SB par supabase-config.js
    if (typeof window.SB !== 'undefined' && window.SB) { supa = window.SB; return supa; }
    if (typeof window.SUPA !== 'undefined') { supa = window.SUPA; return supa; }
    if (typeof supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      supa = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      return supa;
    }
    return null;
  }
  async function getUser(){
    const s = getSupa(); if (!s) return null;
    const { data } = await s.auth.getUser();
    return data ? data.user : null;
  }
  async function add(productRef){
    const user = await getUser(); if (!user) return { ok:false, error:'not_logged_in' };
    const s = getSupa();
    const { error } = await s.from('wishlists').insert({ user_id: user.id, product_ref: productRef });
    if (error && error.code !== '23505') return { ok:false, error: error.message };
    return { ok:true };
  }
  async function remove(productRef){
    const user = await getUser(); if (!user) return { ok:false };
    const s = getSupa();
    const { error } = await s.from('wishlists').delete().eq('user_id', user.id).eq('product_ref', productRef);
    return { ok: !error };
  }
  async function has(productRef){
    const user = await getUser(); if (!user) return false;
    const s = getSupa();
    const { data } = await s.from('wishlists').select('id').eq('user_id', user.id).eq('product_ref', productRef).limit(1);
    return !!(data && data.length);
  }
  async function list(){
    const user = await getUser(); if (!user) return [];
    const s = getSupa();
    const { data } = await s.from('wishlists').select('product_ref, added_at').order('added_at', { ascending:false });
    return data || [];
  }
  window.elliaWishlist = { add, remove, has, list };

  function bindHeartBtn(){
    const btn = document.getElementById('wishlistBtn');
    if (!btn) return;
    const ref = btn.dataset.ref;
    const icon = document.getElementById('wishlistIcon');
    const label = document.getElementById('wishlistLabel');
    async function refresh(){
      const user = await getUser();
      if (!user){
        label.textContent = 'Connexion pour ajouter aux favoris';
        btn.disabled = false;
        btn.onclick = function(){ location.href = 'compte.html?next=' + encodeURIComponent(location.pathname); };
        return;
      }
      const present = await has(ref);
      if (present){
        if (icon) icon.setAttribute('fill','#0d0d0d');
        label.textContent = 'Retirer des favoris';
        btn.onclick = async function(){ await remove(ref); refresh(); };
      } else {
        if (icon) icon.setAttribute('fill','none');
        label.textContent = 'Ajouter aux favoris';
        btn.onclick = async function(){ const r = await add(ref); if(r.ok) refresh(); };
      }
    }
    refresh();
  }

  function bindFavList(){
    const box = document.getElementById('favorisList');
    if (!box) return;
    async function render(){
      const items = await list();
      if (!items.length){
        box.innerHTML = '<div style="padding:18px;background:#fff;border:1px solid rgba(0,0,0,.06);color:#5c5852;font-size:14px">Vous n&rsquo;avez pas encore de favoris. <a href="pochette.html" style="color:#0d0d0d;text-decoration:underline">D&eacute;couvrir la pochette &rarr;</a></div>';
        return;
      }
      box.innerHTML = items.map(function(it){
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:18px;background:#fff;border:1px solid rgba(0,0,0,.06);margin-bottom:10px">'+
          '<div><b style="font-family:Cormorant Garamond,Georgia,serif;font-size:18px">La Pochette ELLIA</b><br><span style="font-size:12px;color:#8a857d">Ajout&eacute; le ' + new Date(it.added_at).toLocaleDateString('fr-FR') + '</span></div>'+
          '<div style="display:flex;gap:8px"><a href="pochette.html" style="padding:9px 14px;background:#0d0d0d;color:#fff;font-size:11px;letter-spacing:.14em;text-transform:uppercase">Voir</a>'+
          '<button data-rem="' + it.product_ref + '" style="padding:9px 14px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#0d0d0d;font-size:11px;letter-spacing:.14em;text-transform:uppercase;cursor:pointer">Retirer</button></div>'+
        '</div>';
      }).join('');
      box.querySelectorAll('[data-rem]').forEach(function(b){ b.addEventListener('click', async function(){ await remove(b.dataset.rem); render(); }); });
    }
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ bindHeartBtn(); bindFavList(); });
  } else {
    bindHeartBtn(); bindFavList();
  }
})();
