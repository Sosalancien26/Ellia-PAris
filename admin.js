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
  let ORDERS=[];
  function renderOrders(list){
    ORDERS=list;
    document.getElementById('ordersBody').innerHTML=list.map(o=>
      '<div class="ord-row" data-id="'+o.id+'">'+
        '<div class="orow-l"><span class="oid">'+o.id+'</span><span class="badge '+badgeClass(o.statut)+'" data-badge="'+o.id+'">'+o.statut+'</span></div>'+
        '<div class="orow-c">'+o.date+' · '+(o.client||'')+'</div>'+
        '<div class="orow-r">'+eur(o.total)+'<span class="orow-go">Détails ›</span></div>'+
      '</div>').join('');
    document.querySelectorAll('.ord-row').forEach(r=>r.addEventListener('click',()=>openOrder(r.dataset.id)));
  }
  function omRow(k,v){ return v ? ('<div class="om-row"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>') : ''; }
  function openOrder(id){
    const o=ORDERS.find(x=>x.id===id); if(!o) return;
    const sOpts=STATUTS.map(s=>'<option'+(norm(s)===norm(o.statut)?' selected':'')+'>'+s+'</option>').join('');
    const tOpts=TRANSPORTEURS.map(t=>'<option value="'+t+'"'+((o.transporteur||'')===t?' selected':'')+'>'+(t||'— Transporteur —')+'</option>').join('');
    document.getElementById('ordModalBox').innerHTML=
      '<button class="om-close" id="omClose">×</button>'+
      '<h3>Commande '+o.id+'</h3><div style="color:var(--gris);font-size:13px;margin-bottom:16px">'+o.date+'</div>'+
      omRow('Client',o.client)+omRow('E-mail',o.email)+omRow('Téléphone',o.telephone)+
      omRow('Adresse de livraison',o.adresse)+omRow('Adresse de facturation',o.adresseFact||o.adresse)+
      omRow('Personnalisation',gravure(o))+omRow('Total','<b>'+eur(o.total)+'</b>')+
      '<div style="margin:20px 0 8px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gris2)">Gestion de la commande</div>'+
      '<div class="om-actions">'+
        '<select class="om-statut">'+sOpts+'</select>'+
        '<select class="om-transp">'+tOpts+'</select>'+
        '<input class="om-suivi" placeholder="N° de suivi" value="'+(o.suivi||'')+'">'+
        '<button class="ord-save" id="omSave">Enregistrer</button>'+
        '<span class="ord-saved" id="omSaved" style="display:none">✓ Enregistré</span>'+
      '</div>';
    document.getElementById('ordModal').classList.add('open');
    document.getElementById('omClose').addEventListener('click',closeOrder);
    document.getElementById('omSave').addEventListener('click',()=>{
      const statut=document.querySelector('.om-statut').value;
      const transporteur=document.querySelector('.om-transp').value;
      const suivi=document.querySelector('.om-suivi').value.trim();
      o.statut=statut; o.transporteur=transporteur; o.suivi=suivi;
      const b=document.querySelector('[data-badge="'+id+'"]'); if(b){ b.textContent=statut; b.className='badge '+badgeClass(statut); }
      fetch('/api/orders/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({statut:statut,transporteur:transporteur,suivi:suivi})}).catch(()=>{});
      const sv=document.getElementById('omSaved'); sv.style.display='inline'; setTimeout(()=>{sv.style.display='none';},2000);
    });
  }
  function closeOrder(){ document.getElementById('ordModal').classList.remove('open'); }
  (function(){ const m=document.getElementById('ordModal'); if(m) m.addEventListener('click',e=>{ if(e.target===m) closeOrder(); }); })();

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
