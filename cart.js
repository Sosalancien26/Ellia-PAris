/* ELLIA PARIS — Panier (localStorage), partage entre les pages */
(function(){
  const KEY='ellia_cart';
  function read(){ try{ return JSON.parse(localStorage.getItem(KEY))||[]; }catch(e){ return []; } }
  function write(a){ localStorage.setItem(KEY, JSON.stringify(a)); updateCount(); }

  window.Cart = {
    items: read,
    add(item){ const a=read(); a.push(item); write(a); },
    removeAt(i){ const a=read(); a.splice(i,1); write(a); },
    clear(){ write([]); },
    total(){ return read().reduce((s,i)=>s+Number(i.prix||0),0); },
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
      const r = await fetch('/api/products');
      if(r.ok){ const list=await r.json(); const p=(list||[]).find(x=>x.ref===ref); if(p) stock=Number(p.stock); }
    }catch(e){ /* hors-ligne : on laisse passer, le serveur bloquera */ }
    if(cur+1 > stock) return { ok:false, stock };
    Cart.add(item); return { ok:true, stock };
  }
  window.Cart.tryAdd = tryAdd;

  /* Boutons simples : <button data-add data-ref data-nom data-prix> */
  document.addEventListener('click', async e=>{
    const b = e.target.closest('[data-add]');
    if(!b || b.dataset.busy==='1') return;
    e.preventDefault();
    b.dataset.busy='1';
    const res = await tryAdd({ ref:b.dataset.ref, nom:b.dataset.nom, prix:Number(b.dataset.prix), perso:false });
    if(res.ok) toast(b,'✓ Ajouté au panier');
    else toast(b, res.stock<=0 ? 'Épuisé' : 'Stock insuffisant');
    setTimeout(()=>{ delete b.dataset.busy; }, 50);
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
