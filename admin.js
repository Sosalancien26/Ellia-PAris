/* ELLIA PARIS — Espace Pro (admin). Donnees mock + API Node si disponible. */
(function(){
  /* ----- Donnees de demonstration (fallback si pas de serveur Node) ----- */
  const MOCK = {
    stats:{ ca_total:12460, commandes:57, panier_moyen:218, taux_perso:78,
      ca_mois:[{mois:'Déc',ca:1180},{mois:'Jan',ca:1620},{mois:'Fév',ca:1840},{mois:'Mars',ca:2150},{mois:'Avr',ca:2480},{mois:'Mai',ca:3190}] },
    orders:[
      {id:'EP-1042',date:'2026-05-26',client:'Camille D.',initiales:'C·D',finition:'Or',total:218,statut:'Nouvelle'},
      {id:'EP-1041',date:'2026-05-26',client:'Hugo M.',initiales:'H·M',finition:'Argent',total:218,statut:'En préparation'},
      {id:'EP-1040',date:'2026-05-25',client:'Sofia L.',initiales:'—',finition:'—',total:159,statut:'Expédiée'},
      {id:'EP-1039',date:'2026-05-24',client:'Adrien P.',initiales:'A·P·G',finition:'Or rose',total:218,statut:'Livrée'},
      {id:'EP-1038',date:'2026-05-23',client:'Léa R.',initiales:'L·R',finition:'Noir',total:218,statut:'Livrée'}
    ],
    products:[
      {ref:'ELLIA-NOIR',nom:'La Pochette Ellia — Noir',prix:159,stock:24,seuil:8},
      {ref:'ELLIA-PERSO',nom:'Gravure initiales (option)',prix:59,stock:999,seuil:0}
    ]
  };
  const STATUTS=['Nouvelle','En préparation','Expédiée','Livrée','Annulée'];

  const eur=n=>n.toLocaleString('fr-FR')+' €';
  const norm=s=>(s||'').toLowerCase().split('é').join('e').split('è').join('e').split('ê').join('e').split('à').join('a');
  function badgeClass(st){const n=norm(st);
    if(n.startsWith('nouvelle'))return'b-nouvelle';
    if(n.startsWith('en prep'))return'b-prep';
    if(n.startsWith('exped'))return'b-exp';
    if(n.startsWith('livr'))return'b-livree';
    return'b-exp';}

  async function get(path,fallback){
    try{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw 0;return await r.json();}
    catch(e){return fallback;}
  }

  function renderKPIs(s){
    document.getElementById('kpis').innerHTML=
      kpi('Chiffre d\'affaires',eur(s.ca_total),'+28% ce mois')+
      kpi('Commandes',s.commandes,'+12 cette semaine')+
      kpi('Panier moyen',eur(s.panier_moyen),'')+
      kpi('Taux de personnalisation',s.taux_perso+'%','');
  }
  function kpi(l,v,d){return '<div class="kpi"><div class="l">'+l+'</div><div class="v">'+v+'</div>'+(d?'<div class="d">'+d+'</div>':'')+'</div>';}

  function renderChart(arr){
    const max=Math.max.apply(null,arr.map(m=>m.ca));
    document.getElementById('chart').innerHTML=arr.map(m=>
      '<div class="bar"><div class="val">'+(m.ca/1000).toFixed(1).replace('.',',')+'k</div>'+
      '<div class="col" style="height:'+Math.round(m.ca/max*100)+'%"></div>'+
      '<div class="m">'+m.mois+'</div></div>').join('');
  }

  const TRANSPORTEURS=['','Colissimo','Chronopost','Mondial Relay','UPS','DHL','Autre'];
  function gravure(o){ return (o.initiales && o.initiales!=='—') ? (o.initiales+' · '+(o.finition||'')+(o.emplacement?(' · '+o.emplacement):'')) : 'Sans gravure'; }
  function renderOrders(list){
    document.getElementById('ordersBody').innerHTML=list.map(o=>{
      const sOpts=STATUTS.map(s=>'<option'+(norm(s)===norm(o.statut)?' selected':'')+'>'+s+'</option>').join('');
      const tOpts=TRANSPORTEURS.map(t=>'<option value="'+t+'"'+((o.transporteur||'')===t?' selected':'')+'>'+(t||'— Transporteur —')+'</option>').join('');
      return '<div class="ord-card" data-id="'+o.id+'">'+
        '<div class="ord-head"><div class="l"><span class="oid">'+o.id+'</span><span class="badge '+badgeClass(o.statut)+'" data-badge="'+o.id+'">'+o.statut+'</span></div>'+
        '<div class="ord-date">'+o.date+' · '+eur(o.total)+'</div></div>'+
        '<div class="ord-body">'+
          '<div class="ord-col"><div class="lbl">Client</div>'+(o.client||'')+'<br>'+(o.email||'')+(o.telephone?('<br>'+o.telephone):'')+'</div>'+
          '<div class="ord-col"><div class="lbl">Livraison</div>'+(o.adresse||'—')+'</div>'+
          '<div class="ord-col"><div class="lbl">Personnalisation</div>'+gravure(o)+'</div>'+
        '</div>'+
        '<div class="ord-actions">'+
          '<select class="f-statut">'+sOpts+'</select>'+
          '<select class="f-transp">'+tOpts+'</select>'+
          '<input class="f-suivi" placeholder="N° de suivi" value="'+(o.suivi||'')+'">'+
          '<button class="ord-save">Enregistrer</button>'+
          '<span class="ord-saved" style="display:none">✓ Enregistré</span>'+
        '</div></div>';
    }).join('');
    document.querySelectorAll('.ord-card').forEach(card=>{
      const id=card.dataset.id;
      card.querySelector('.ord-save').addEventListener('click',()=>{
        const statut=card.querySelector('.f-statut').value;
        const transporteur=card.querySelector('.f-transp').value;
        const suivi=card.querySelector('.f-suivi').value.trim();
        const b=card.querySelector('[data-badge]'); b.textContent=statut; b.className='badge '+badgeClass(statut);
        fetch('/api/orders/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({statut:statut,transporteur:transporteur,suivi:suivi})}).catch(()=>{});
        const sv=card.querySelector('.ord-saved'); sv.style.display='inline'; setTimeout(()=>{sv.style.display='none';},2200);
      });
    });
  }

  function etatLabel(stock,seuil){
    if(seuil===0) return '<span class="stock-ok">Illimité</span>';
    return (stock<=seuil)?'<span class="stock-bad">Stock bas</span>':'<span class="stock-ok">En stock</span>';
  }
  function renderStock(list){
    document.getElementById('stockBody').innerHTML=list.map(p=>{
      const cell=p.seuil===0?'∞':'<input class="stock-inp" type="number" min="0" data-ref="'+p.ref+'" data-seuil="'+p.seuil+'" value="'+p.stock+'">';
      return '<tr><td>'+p.nom+'</td><td>'+p.ref+'</td><td>'+eur(p.prix)+'</td><td>'+cell+'</td><td>'+(p.seuil||'—')+'</td><td class="etat" data-ref="'+p.ref+'">'+etatLabel(p.stock,p.seuil)+'</td></tr>';
    }).join('');
    document.querySelectorAll('.stock-inp').forEach(inp=>inp.addEventListener('change',()=>{
      const v=Number(inp.value),ref=inp.dataset.ref,seuil=Number(inp.dataset.seuil);
      const cell=document.querySelector('.etat[data-ref="'+ref+'"]'); if(cell)cell.innerHTML=etatLabel(v,seuil);
      fetch('/api/products/'+encodeURIComponent(ref),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({stock:v})}).catch(()=>{});
    }));
  }

  /* Tabs */
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(o=>o.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(o=>o.classList.remove('active'));
    t.classList.add('active');
    document.getElementById(t.dataset.tab).classList.add('active');
  }));

  /* Deconnexion */
  const lo=document.getElementById('logout');
  if(lo) lo.addEventListener('click',async e=>{ e.preventDefault(); try{await fetch('/api/logout',{method:'POST'});}catch(_){} location.href='/admin'; });

  /* Init */
  (async function(){
    const s=await get('/api/stats',MOCK.stats);
    const o=await get('/api/orders',MOCK.orders);
    const p=await get('/api/products',MOCK.products);
    renderKPIs(s);renderChart(s.ca_mois);renderOrders(o);renderStock(p);
  })();
})();
