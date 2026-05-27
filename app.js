/* ELLIA PARIS — interactions partagées (maquette) */
(function(){
  /* Preloader */
  window.addEventListener('load',()=>{const p=document.getElementById('preloader');if(p)setTimeout(()=>p.classList.add('done'),1500);});

  /* Header scroll state (only when a transparent hero is present) */
  const header=document.getElementById('header');
  if(header){
    const solid=header.classList.contains('solid');
    if(!solid){window.addEventListener('scroll',()=>header.classList.toggle('scrolled',window.scrollY>60));}
  }

  /* Mobile menu */
  const burger=document.getElementById('burger'),mm=document.getElementById('mobileMenu');
  if(burger&&mm){
    burger.addEventListener('click',()=>mm.classList.toggle('open'));
    mm.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>mm.classList.remove('open')));
  }

  /* Reveal on scroll */
  const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.14});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

  /* Custom cursor */
  if(!matchMedia('(hover:none)').matches){
    const c=document.querySelector('.cursor'),d=document.querySelector('.cursor-dot');
    if(c&&d){
      let x=innerWidth/2,y=innerHeight/2,cx=x,cy=y;
      addEventListener('mousemove',e=>{x=e.clientX;y=e.clientY;d.style.transform=`translate(${x-2.5}px,${y-2.5}px)`;});
      (function loop(){cx+=(x-cx)*.18;cy+=(y-cy)*.18;c.style.transform=`translate(${cx-17}px,${cy-17}px)`;requestAnimationFrame(loop);})();
      const grow=()=>c.classList.add('grow'),shrink=()=>c.classList.remove('grow');
      document.querySelectorAll('a,button,.sw,.place-btn,.nav-ico,.pg-thumbs img').forEach(el=>{el.addEventListener('mouseenter',grow);el.addEventListener('mouseleave',shrink);});
    }
  }

  /* Product gallery thumbs */
  const main=document.getElementById('pgMain');
  if(main){
    document.querySelectorAll('.pg-thumbs img').forEach(t=>t.addEventListener('click',()=>{
      document.querySelectorAll('.pg-thumbs img').forEach(o=>o.classList.remove('active'));
      t.classList.add('active');main.src=t.dataset.full||t.src;
    }));
  }

  /* Personnalisation */
  const input=document.getElementById('initials'),engrave=document.getElementById('engrave');
  if(input&&engrave){
    const monoFinish=document.getElementById('monoFinish');
    const colors={or:'linear-gradient(135deg,#f7e3a1,#c79a3a 55%,#8a6a1d)',orrose:'linear-gradient(135deg,#f3d9cf,#c98e86 55%,#a96b62)',argent:'linear-gradient(135deg,#f4f4f4,#9a9a9a 55%,#dcdcdc)',noir:'#3a352d',blanc:'#ffffff'};
    const names={or:'Or',orrose:'Or rose',argent:'Argent',noir:'Noir',blanc:'Blanc'};
    let color='or';
    const fmt=v=>v.toUpperCase().split('').join('·');
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
    input.addEventListener('input',()=>{input.value=input.value.replace(/[^a-zA-Z]/g,'');paint();});
    document.querySelectorAll('#swatches .sw').forEach(s=>s.addEventListener('click',()=>{
      document.querySelectorAll('#swatches .sw').forEach(o=>o.classList.remove('active'));
      s.classList.add('active');color=s.dataset.color;paint();
    }));
    document.querySelectorAll('#placements .place-btn').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('#placements .place-btn').forEach(o=>o.classList.remove('active'));
      b.classList.add('active');
    }));
    const addBtn=document.getElementById('addPerso');
    if(addBtn) addBtn.addEventListener('click',e=>{
      e.preventDefault();
      const ini=fmt(input.value||'');
      const place=(document.querySelector('#placements .place-btn.active')||{}).textContent||'Centre';
      if(window.Cart) Cart.add({ref:'ELLIA-NOIR-PERSO',nom:'La Pochette Ellia — Noir',prix:218,initiales:ini||null,finition:names[color],emplacement:place});
      location.href='panier.html';
    });
    paint();
  }
})();
