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

  /* Boutons simples : <button data-add data-ref data-nom data-prix> */
  document.addEventListener('click', e=>{
    const b = e.target.closest('[data-add]');
    if(!b) return;
    e.preventDefault();
    Cart.add({ ref:b.dataset.ref, nom:b.dataset.nom, prix:Number(b.dataset.prix), perso:false });
    toast(b);
  });

  function toast(b){
    const old=b.textContent; b.textContent='✓ Ajouté au panier';
    setTimeout(()=>{ b.textContent=old; }, 1400);
  }

  document.addEventListener('DOMContentLoaded', updateCount);
  updateCount();
})();
