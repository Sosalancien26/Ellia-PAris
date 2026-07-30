/* ELLIA PARIS — Panier (localStorage), partage entre les pages */
(function(){
  const KEY='ellia_cart';
  // Safari en navigation privee et un quota plein font lever setItem. Sans
  // garde, le client voyait "Stock insuffisant" alors que le stock est plein,
  // ou un bouton definitivement bloque. On bascule sur une memoire de secours.
  let MEM = null;   // panier de secours en memoire si localStorage refuse
  function read(){
    if (MEM) return MEM.slice();
    try{ return JSON.parse(localStorage.getItem(KEY))||[]; }catch(e){ return []; }
  }
  function write(a){
    try{
      localStorage.setItem(KEY, JSON.stringify(a));
      MEM = null;
    }catch(e){
      MEM = a.slice();                       // stockage impossible : on garde en memoire
      if (!window.__cartWarn){
        window.__cartWarn = true;
        console.warn('Panier en memoire seule (stockage navigateur indisponible).');
      }
    }
    updateCount();
  }

  window.Cart = {
    items: read,
    add(item){ const a=read(); a.push(item); write(a); },
    removeAt(i){ const a=read(); a.splice(i,1); write(a); },
    clear(){ write([]); },
    total(){ return read().reduce((s,i)=>s+Number(i.prix||0),0); },
    list(){ return read(); },
    count(){ return read().length; }
  };

  function updateCount(){
    const n = Cart.count();
    document.querySelectorAll('[data-cart-count]').forEach(el=>{ el.textContent='Panier ('+n+')'; });
  }

  /* Vérification de stock avant ajout (sécurité côté serveur aussi) */
  async function tryAdd(item){
    const ref='ELLIA-NOIR';
    const cur = read().filter(i=>(i.ref||'').startsWith(ref)).length;
    let stock = Infinity;
    try{
      const ctl = ('AbortController' in window) ? new AbortController() : null;
      const to  = ctl ? setTimeout(()=>ctl.abort(), 6000) : null;
      const r = await fetch('/api/products', ctl ? { signal: ctl.signal } : undefined);
      if (to) clearTimeout(to);
      if(r.ok){ const list=await r.json(); const p=(list||[]).find(x=>x.ref===ref); if(p) stock=Number(p.stock); }
    }catch(e){ /* hors-ligne : on laisse passer, le serveur bloquera */ }
    if(cur+1 > stock) return { ok:false, stock, raison:'stock' };
    try { Cart.add(item); } catch(e){ return { ok:false, stock, raison:'stockage' }; }
    return { ok:true, stock };
  }
  window.Cart.tryAdd = tryAdd;

  /* Boutons simples : <button data-add data-ref data-nom data-prix> */
  document.addEventListener('click', async e=>{
    const b = e.target.closest('[data-add]');
    if(!b || b.dataset.busy==='1') return;
    e.preventDefault();
    b.dataset.busy='1';
    let res;
    try {
      res = await tryAdd({ ref:b.dataset.ref, nom:b.dataset.nom, prix:Number(b.dataset.prix)||0, perso:false });
    } catch(e){ res = { ok:false, stock:Infinity, raison:'reseau' }; }
    if(res.ok) toast(b,'✓ Ajouté au panier');
    else if(res.raison==='stockage') toast(b,'Stockage navigateur bloqué');
    else if(res.raison==='reseau')   toast(b,'Connexion impossible');
    else toast(b, res.stock<=0 ? 'Épuisé' : 'Stock insuffisant');
    setTimeout(()=>{ delete b.dataset.busy; }, 1800);   // duree du toast : evite le double ajout
  });

  function toast(b,txt){
    const old=b.textContent; b.textContent=txt;
    setTimeout(()=>{ b.textContent=old; }, 1700);
  }

  document.addEventListener('DOMContentLoaded', updateCount);
  updateCount();

  /* Blocage achat si rupture de stock (UX ; sécurité réelle côté serveur) */
  document.addEventListener('DOMContentLoaded', async ()=>{
    const buyers=document.querySelectorAll('[data-add],#addPerso');
    if(!buyers.length) return;
    try{
      const r=await fetch('/api/products'); if(!r.ok) return;
      const prods=await r.json();
      const p=(prods||[]).find(x=>x.ref==='ELLIA-NOIR');
      if(p && Number(p.stock)<=0){
        buyers.forEach(b=>{ b.setAttribute('disabled','disabled'); b.style.opacity='.5'; b.style.pointerEvents='none'; b.textContent='Épuisé'; });
      }
    }catch(e){}
  });
})();

/* ===== AVIS CLIENTS ===== */
(function(){
  function star(n){var s='';for(var i=0;i<5;i++)s+=(i<n?'★':'☆');return s;}
  function fmtDate(s){try{var d=new Date(s);return d.toLocaleDateString('fr-FR',{year:'numeric',month:'long'});}catch(_){return s||'';}}
  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);});}
  function render(list){
    var box=document.getElementById('reviewsList');if(!box)return;
    if(!list||!list.length){box.innerHTML='<div class="reviews-empty">Soyez la première à partager votre expérience.</div>';return;}
    box.innerHTML=list.map(function(r){
      return '<div class="review-card">'+
        '<div class="rv-head"><div class="rv-author">'+escapeHtml(r.prenom||'Anonyme')+'</div><div class="rv-date">'+fmtDate(r.created_at)+'</div></div>'+
        '<div class="rv-rating">'+star(r.note||5)+'</div>'+
        (r.titre?'<div class="rv-title">« '+escapeHtml(r.titre)+' »</div>':'')+
        '<div class="rv-comment">'+escapeHtml(r.commentaire||'')+'</div>'+
        '<div class="rv-verified">Avis vérifié</div>'+
      '</div>';
    }).join('');
  }
  function renderSummary(list){
    var score=document.getElementById('rsScore'),count=document.getElementById('rsCount');
    if(!score||!count)return;
    if(!list||!list.length){score.textContent='—';count.textContent='0';return;}
    var avg=list.reduce(function(s,r){return s+Number(r.note||0);},0)/list.length;
    score.textContent=(Math.round(avg*10)/10).toFixed(1);
    count.textContent=list.length;
  }
  async function loadReviews(){
    if(!document.getElementById('reviewsList'))return;
    try{
      var r=await fetch('/api/reviews');
      var j=await r.json();
      var list=Array.isArray(j.reviews)?j.reviews:[];
      render(list);renderSummary(list);
    }catch(_){
      render([]);renderSummary([]);
    }
  }
  document.addEventListener('DOMContentLoaded',loadReviews);

  document.addEventListener('submit',async function(e){
    var f=e.target;if(!f||f.id!=='reviewForm')return;
    e.preventDefault();
    var btn=document.getElementById('rvSubmit'),msg=document.getElementById('rvMsg');
    msg.className='cf-msg';msg.textContent='';
    var data={};new FormData(f).forEach(function(v,k){data[k]=v;});
    if(!data.prenom||!data.email||!data.note||!data.commentaire||!data.rgpd){
      msg.className='cf-msg err';msg.textContent='Merci de remplir tous les champs requis.';return;
    }
    if(data.commentaire.length<20){msg.className='cf-msg err';msg.textContent='Votre avis doit contenir au moins 20 caractères.';return;}
    var old=btn.textContent;btn.disabled=true;btn.textContent='Envoi…';
    try{
      var r=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      if(r.ok){
        msg.className='cf-msg ok';msg.textContent='✓ Merci ! Votre avis sera publié après modération.';
        f.reset();
      }else{
        msg.className='cf-msg err';msg.textContent='Une erreur est survenue. Merci de réessayer.';
      }
    }catch(_){msg.className='cf-msg err';msg.textContent='Connexion impossible.';}
    btn.disabled=false;btn.textContent=old;
  });
})();
