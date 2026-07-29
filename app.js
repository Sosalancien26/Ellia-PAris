/* ELLIA PARIS — interactions partagees */
(function(){
  /* Preloader UNIFORME : meme duree sur toutes les pages (~2.5s d'animation luxe) */
  function hidePreloader(){var p=document.getElementById('preloader');if(p){p.classList.add('done');setTimeout(function(){if(p&&p.parentNode)p.parentNode.removeChild(p);},700);}}
  document.addEventListener('DOMContentLoaded',function(){setTimeout(hidePreloader,2700);});
  window.addEventListener('load',function(){setTimeout(hidePreloader,2500);});
  setTimeout(hidePreloader,4500); // garde-fou max 4.5s

  /* Bandeau cookies : gere UNIQUEMENT par cookies-banner.js.
     L'ancien bandeau de ce fichier faisait doublon (deux bandeaux empiles) et
     recouvrait le bouton "Ajouter au panier" du configurateur sur mobile. */

  /* Newsletter */
  document.addEventListener('submit', async function(e){
    var f = e.target;
    if(!f.matches || !f.matches('.news form')) return;
    e.preventDefault();
    var input = f.querySelector('input[type="email"]'); var btn = f.querySelector('button[type="submit"]');
    if(!input || !btn) return;
    var email = (input.value||'').trim();
    if(!email) return;
    var old = btn.textContent; btn.disabled = true; btn.textContent = 'Envoi...';
    try{
      var r = await fetch('/api/newsletter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})});
      btn.textContent = r.ok ? 'OK Inscrit' : 'Erreur';
      if(r.ok) input.value='';
    }catch(_){ btn.textContent = 'Erreur'; }
    setTimeout(function(){ btn.textContent = old; btn.disabled = false; }, 2500);
  });

  /* Header scroll state */
  var header=document.getElementById('header');
  if(header){
    var solid=header.classList.contains('solid');
    if(!solid){window.addEventListener('scroll',function(){header.classList.toggle('scrolled',window.scrollY>60);});}
  }

  /* Mobile menu — avec scroll-lock + aria */
  var burger=document.getElementById('burger'),mm=document.getElementById('mobileMenu');
  if(burger&&mm){
    burger.setAttribute('aria-expanded','false');
    function setMenu(open){
      mm.classList.toggle('open',open);
      burger.setAttribute('aria-expanded',open?'true':'false');
      document.body.style.overflow=open?'hidden':'';
    }
    burger.addEventListener('click',function(){setMenu(!mm.classList.contains('open'));});
    mm.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){setMenu(false);});});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&mm.classList.contains('open'))setMenu(false);});
  }

  /* Reveal on scroll */
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.14});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});

  /* Custom cursor */
  if(!matchMedia('(hover:none)').matches){
    var c=document.querySelector('.cursor'),d=document.querySelector('.cursor-dot');
    if(c&&d){
      var x=innerWidth/2,y=innerHeight/2,cx=x,cy=y;
      addEventListener('mousemove',function(e){x=e.clientX;y=e.clientY;d.style.transform='translate('+(x-2.5)+'px,'+(y-2.5)+'px)';document.body.classList.add('has-mouse');});
      (function loop(){cx+=(x-cx)*.18;cy+=(y-cy)*.18;c.style.transform='translate('+(cx-17)+'px,'+(cy-17)+'px)';requestAnimationFrame(loop);})();
      var grow=function(){c.classList.add('grow');},shrink=function(){c.classList.remove('grow');};
      document.querySelectorAll('a,button,.sw,.place-btn,.nav-ico,.pg-thumbs img').forEach(function(el){el.addEventListener('mouseenter',grow);el.addEventListener('mouseleave',shrink);});
    }
  }

  /* Product gallery thumbs */
  var main=document.getElementById('pgMain');
  if(main){
    document.querySelectorAll('.pg-thumbs img').forEach(function(t){t.addEventListener('click',function(){
      document.querySelectorAll('.pg-thumbs img').forEach(function(o){o.classList.remove('active');});
      t.classList.add('active');main.src=t.dataset.full||t.src;
    });});
  }

  /* Personnalisation */
  var input=document.getElementById('initials'),engrave=document.getElementById('engrave');
  if(input&&engrave){
    var monoFinish=document.getElementById('monoFinish');
    var colors={or:'linear-gradient(135deg,#f7e3a1,#c79a3a 55%,#8a6a1d)',orrose:'linear-gradient(135deg,#f3d9cf,#c98e86 55%,#a96b62)',argent:'linear-gradient(135deg,#f4f4f4,#9a9a9a 55%,#dcdcdc)',noir:'#3a352d',blanc:'#ffffff'};
    // DOIT couvrir toutes les finitions du configurateur (data-color) : sinon
    // la finition part vide dans la commande et l'atelier ne sait pas quoi graver.
    var names={or:'Or',orrose:'Or rose',argent:'Argent',aveugle:'Aveugle',noir:'Noir',blanc:'Blanc'};
    var color='or';
    var fmt=function(v){return v.toUpperCase().split('').join('.');};
    function paint(){
      engrave.textContent=fmt(input.value||'');
      if(color==='or'||color==='orrose'||color==='argent'){
        engrave.style.background=colors[color];engrave.style.webkitBackgroundClip='text';engrave.style.backgroundClip='text';engrave.style.webkitTextFillColor='transparent';engrave.style.color='transparent';engrave.style.textShadow='none';
      }else{
        engrave.style.background='none';engrave.style.webkitTextFillColor=colors[color];engrave.style.color=colors[color];
        engrave.style.textShadow=color==='noir'?'0 1px 0 rgba(255,255,255,.18)':'0 2px 6px rgba(0,0,0,.55)';
      }
      if(monoFinish)monoFinish.textContent='Finition '+names[color];
    }
    input.addEventListener('input',function(){paint();});
    document.querySelectorAll('#swatches .sw').forEach(function(s){s.addEventListener('click',function(){
      document.querySelectorAll('#swatches .sw').forEach(function(o){o.classList.remove('active');});
      s.classList.add('active');color=s.dataset.color;paint();
    });});
    document.querySelectorAll('#placements .place-btn').forEach(function(b){b.addEventListener('click',function(){
      document.querySelectorAll('#placements .place-btn').forEach(function(o){o.classList.remove('active');});
      b.classList.add('active');
    });});
    var addBtn=document.getElementById('addPerso');
    if(addBtn) addBtn.addEventListener('click', async function(e){
      e.preventDefault();
      if (addBtn.dataset.busy === '1') return;   // anti double-clic
      addBtn.dataset.busy = '1';
      var releaseBusy = function(){ addBtn.dataset.busy = '0'; };
      // SECURITE PRIX : si le module 3D n'a pas charge, le prix affiche (159 €)
      // ne correspond pas au prix reel -> on refuse plutot que de facturer autre chose.
      if (typeof window.__getPersoPrice !== 'function') {
        alert("Le configurateur n'a pas fini de charger. Patientez quelques secondes puis réessayez.\nSi le problème persiste, rechargez la page ou écrivez-nous à contact@ellia-paris.fr.");
        releaseBusy();
        return;
      }
      // Texte EXACT tape par le client (pas d'uppercase, pas de points ajoutes)
      var rawText = input.value || '';
      var place=(document.querySelector('#placements .place-btn.active')||{}).textContent||'Centre';
      // Capture 3D : screenshot du configurateur a l'instant T
      var preview = null;
      try {
        var canvas3d = document.querySelector('#viewer3d canvas');
        if (canvas3d) {
          // Re-render avant capture pour avoir la derniere version
          if (window.__forceRender) window.__forceRender();
          preview = canvas3d.toDataURL('image/jpeg', 0.78);
          // Le serveur refuse un corps > 256 Ko : au-dela on degrade puis on abandonne
          // l'apercu plutot que de faire echouer TOUTE la commande.
          if (preview && preview.length > 150000) preview = canvas3d.toDataURL('image/jpeg', 0.55);
          if (preview && preview.length > 150000) preview = null;
        }
      } catch(err){ /* silencieux : la capture est best-effort */ }
      // Prix dynamique : 5€/lettre + 2€/caractère spécial + 10€/symbole (+159 base pochette)
      var prixDyn = 218; // fallback
      var persoDetail = null;
      try {
        if (window.__getPersoPrice) {
          var p = window.__getPersoPrice();
          prixDyn = p.total;
          persoDetail = { letters:p.letters, specials:p.specials, persoInitiales:p.persoInitiales, persoSymbol:p.persoSymbol };
        }
      } catch(_){}
      var item = {
        ref:'ELLIA-NOIR-PERSO',
        nom:'La Pochette Ellia - Noir',
        prix: prixDyn,
        initiales: rawText || null,
        finition: names[color],
        emplacement: place,
        fontScale: (window.__getFontScale ? Math.round(window.__getFontScale()*100) : 100),
        flame: (window.__getFlameState ? window.__getFlameState() : null),
        extra: (window.__getExtraState ? window.__getExtraState() : null),
        extra2: (window.__getExtra2State ? window.__getExtra2State() : null),
        extra3: (window.__getExtra3State ? window.__getExtra3State() : null),
        perso_detail: persoDetail,
        preview: preview
      };
      var ok=true;
      try{
        if(window.Cart && Cart.tryAdd){ var r=await Cart.tryAdd(item); ok=r.ok; }
        else if(window.Cart){ Cart.add(item); }
      }catch(err){ ok=false; }
      if(ok){ location.href='panier.html'; }   // navigation : pas besoin de liberer
      else {
        releaseBusy();   // echec : le client doit pouvoir reessayer
        var old=addBtn.textContent; addBtn.textContent='Stock insuffisant'; setTimeout(function(){ addBtn.textContent=old; }, 1800);
      }
    });
    paint();
  }
})();
