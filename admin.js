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
  const STATUTS=['En attente paiement','Nouvelle','En préparation','Prête à expédier','Expédiée','Livrée','Annulée','Remboursée'];

  // Garde anti-crash : le role "atelier" recoit les stats/commandes SANS champs financiers
  const eur=n=>(n==null||isNaN(Number(n)))?'—':Number(n).toLocaleString('fr-FR')+' €';
  const norm=s=>(s||'').toLowerCase().split('é').join('e').split('è').join('e').split('ê').join('e').split('à').join('a');
  function badgeClass(st){const n=norm(st);
    if(n.includes('attente paiement'))return'b-wait';
    if(n.startsWith('nouvelle'))return'b-nouvelle';
    if(n.startsWith('en prep'))return'b-prep';
    if(n.startsWith('prete')||n.startsWith('prête'))return'b-prep';
    if(n.startsWith('exped'))return'b-exp';
    if(n.startsWith('livr'))return'b-livree';
    if(n.startsWith('annul'))return'b-cancel';
    if(n.startsWith('rembours'))return'b-cancel';
    return'b-prep';}

  let DATA_ERROR = false;
  async function get(path,fallback){
    try{
      const r=await fetch(path,{cache:'no-store'});
      if(r.status===401){ location.href='/admin'; throw 0; } // session expiree → retour login
      if(!r.ok)throw 0;
      return await r.json();
    }
    catch(e){
      // On signale visuellement que ce sont des donnees de secours,
      // sinon on croit lire de vraies commandes alors que la base est en panne.
      DATA_ERROR = true;
      return fallback;
    }
  }
  function showDataBanner(){
    if(!DATA_ERROR) return;
    const shell=document.querySelector('.shell'); if(!shell || document.getElementById('dataErrBanner')) return;
    const d=document.createElement('div'); d.id='dataErrBanner';
    d.style.cssText='background:#fbeae6;border:1px solid #e7cfc9;border-left:4px solid #b1432f;color:#8a3b2c;padding:14px 18px;margin-bottom:20px;border-radius:8px;font-size:13.5px';
    d.innerHTML='⚠ <b>Données indisponibles</b> — impossible de joindre la base. Les chiffres affichés sont des exemples, <b>pas vos vraies commandes</b>. <a href="#" onclick="location.reload();return false" style="color:#8a3b2c;text-decoration:underline">Réessayer</a>';
    shell.insertBefore(d, shell.firstChild);
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
  // Construit la liste complete des gravures (initiales + flame + extras 1/2/3) — items_data est un JSONB en DB
  function gravureFull(o){
    var parts = [];
    // Initiales
    if (o.initiales && o.initiales !== '—') {
      parts.push('Initiales <b>« '+esc(o.initiales)+' »</b> · '+esc(o.finition||'—')+' · '+esc(o.emplacement||'—'));
    }
    // Items_data : array d'items du panier, chaque item peut avoir flame/extra/extra2/extra3
    var items = Array.isArray(o.items_data) ? o.items_data : [];
    items.forEach(function(it){
      ['flame','extra','extra2','extra3'].forEach(function(k){
        var s = it && it[k];
        if (s && s.enabled) {
          parts.push((esc(s.symbol_name||s.symbol||'Symbole'))+' : '+esc(s.finish||'—')+' · '+esc(s.placement||'—'));
        }
      });
    });
    if (!parts.length) return 'Sans gravure';
    return '<div style="line-height:1.85">· '+parts.join('<br/>· ')+'</div>';
  }
  let ORDERS=[], FILTER='', SEARCH='';
  // Mode d'affichage des commandes : 'list' (defaut) ou 'pipeline' — memorise en localStorage
  let VIEW='list';
  try{ if(localStorage.getItem('ellia_admin_view')==='pipeline') VIEW='pipeline'; }catch(_){}
  function ocard(o){
    const waiting = norm(o.statut).includes('attente paiement');
    const rowClass = waiting ? 'ord-row ord-waiting' : 'ord-row';
    // Résumé gravure directement visible dans la liste (précieux pour l'atelier)
    const grav = (o.initiales && o.initiales !== '—')
      ? '<span class="grav-chip">✒ <b>'+esc(o.initiales)+'</b>'+(o.finition && o.finition!=='—' ? ' · '+esc(o.finition) : '')+(o.emplacement ? ' · '+esc(o.emplacement) : '')+'</span>'
      : '<span class="grav-chip none">Sans gravure</span>';
    const avatar = '<span class="orow-avatar">'+esc((o.client||'?').trim().charAt(0).toUpperCase()||'?')+'</span>';
    // Statut modifiable directement depuis la liste (sans ouvrir la fiche)
    // Si le statut en base n'est pas dans le referentiel, on l'ajoute pour ne pas afficher/ecrire un faux statut
    const inRef = STATUTS.some(s=>norm(s)===norm(o.statut));
    const sOpts = (inRef?'':'<option selected>'+esc(o.statut)+'</option>')+
      STATUTS.map(s=>'<option'+(norm(s)===norm(o.statut)?' selected':'')+'>'+s+'</option>').join('');
    return '<div class="'+rowClass+'" data-id="'+esc(o.id)+'">'+
      avatar+
      '<div class="orow-l"><div class="orow-top"><span class="oid">'+esc(o.id)+'</span><span class="badge '+badgeClass(o.statut)+'" data-badge="'+esc(o.id)+'">'+esc(o.statut)+'</span>'+(o.is_gift ? '<span class="badge" style="background:#f5ead2;color:#7a5c10;border-color:#e0cfa0" title="Commande cadeau — bon de livraison sans prix">Cadeau</span>' : '')+'</div>'+
        '<div class="orow-sub"><b style="color:#3a352d">'+esc(o.client||'')+'</b> · '+esc(o.date)+'</div>'+
        '<div style="margin-top:2px">'+grav+'</div></div>'+
      '<div class="orow-r"><span class="orow-total">'+(o.total==null?'—':eur(o.total))+'</span>'+
        '<select class="statut row-statut" data-row-statut="'+esc(o.id)+'" title="Changer le statut">'+sOpts+'</select>'+
        '<span class="orow-go">Voir le détail ›</span></div>'+
    '</div>';
  }
  function applyFilter(){
    let list = FILTER ? ORDERS.filter(o=>norm(o.statut).includes(FILTER)) : ORDERS.slice();
    if(SEARCH){
      const q=SEARCH.toLowerCase();
      list = list.filter(o => (o.id||'').toLowerCase().includes(q) || (o.client||'').toLowerCase().includes(q) || (o.email||'').toLowerCase().includes(q));
    }
    const box=document.getElementById('ordersBody');
    const pbox=document.getElementById('ordersPipeline');
    if(VIEW==='pipeline' && pbox){
      box.style.display='none'; pbox.style.display='grid';
      renderPipeline(list,pbox);
      return;
    }
    if(pbox) pbox.style.display='none';
    box.style.display='';
    box.innerHTML = list.length ? list.map(ocard).join('') : '<div class="ord-empty">Aucune commande dans cette vue.</div>';
    bindRows(box);
  }
  /* Vue Pipeline : 3 colonnes atelier → expédition (cartes ocard reutilisees) */
  function renderPipeline(list,pbox){
    const lb=document.getElementById('ordersBody'); if(lb) lb.innerHTML='';  // evite badges/listeners fantomes
    const now=Date.now(), SEPT_JOURS=7*24*3600*1000;
    const estRecent = o => { const d=new Date(o.date||''); return isNaN(d.getTime()) ? true : (now-d.getTime())<=SEPT_JOURS; };
    const cols=[
      { titre:'À graver', test:o=>norm(o.statut).startsWith('nouvelle') },
      { titre:'À expédier', test:o=>{ const s=norm(o.statut); return s.startsWith('en prep')||s.startsWith('prete')||s.startsWith('prête'); } },
      { titre:'Expédiées (7 j)', test:o=>norm(o.statut).startsWith('exped') && estRecent(o) },
      // 4e colonne : AUCUNE commande ne doit disparaitre de la vue
      // (en attente de paiement, livrees, annulees, remboursees, expediees anciennes)
      { titre:'Autres', test:o=>{
          const s=norm(o.statut);
          if(s.startsWith('nouvelle') || s.startsWith('en prep') || s.startsWith('prete') || s.startsWith('prête')) return false;
          if(s.startsWith('exped') && estRecent(o)) return false;
          return true;
        } }
    ];
    pbox.innerHTML = cols.map(c=>{
      const rows=list.filter(c.test);
      return '<div class="pipe-col"><div class="pipe-head"><span>'+c.titre+'</span><span class="pipe-count">'+rows.length+'</span></div>'+
        (rows.length ? rows.map(ocard).join('') : '<div class="pipe-empty">Aucune commande</div>')+
      '</div>';
    }).join('');
    bindRows(pbox);
  }
  /* Bind clic fiche + select statut inline sur les cartes d'un conteneur (liste OU pipeline) */
  function bindRows(box){
    box.querySelectorAll('.ord-row').forEach(r=>r.addEventListener('click',()=>openOrder(r.dataset.id)));
    // Changement de statut inline : ne pas ouvrir la fiche quand on clique le select
    box.querySelectorAll('.row-statut').forEach(sel=>{
      sel.addEventListener('click', e=>e.stopPropagation());
      sel.addEventListener('change', e=>{
        e.stopPropagation();
        const id = sel.dataset.rowStatut, statut = sel.value;
        const o = ORDERS.find(x=>x.id===id);
        const ancien = (o && o.statut) ? o.statut : sel.value;
        // Le changement de statut declenche un EMAIL au client : on confirme.
        if(!confirm('Passer la commande '+id+' en « '+statut+' » ?\nUn e-mail sera envoyé au client.')){
          sel.value = ancien; return;
        }
        sel.disabled = true;
        fetch('/api/orders/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({statut})})
          .then(r=>{
            if(!r.ok) throw new Error(r.status===403?'Droits insuffisants.':'Erreur serveur ('+r.status+')');
            if(o) o.statut = statut;
            const b = document.querySelector('[data-badge="'+id+'"]'); if(b){ b.textContent=statut; b.className='badge '+badgeClass(statut); }
            updateCounts(); updateDashAlert(); applyFilter();
          })
          .catch(err=>{ sel.value = ancien; alert('Changement non enregistré : '+(err.message||'erreur réseau')); })
          .finally(()=>{ sel.disabled = false; });
      });
    });
  }
  function updateCounts(){
    const c=k=>ORDERS.filter(o=>norm(o.statut).includes(k)).length;
    const map={'':ORDERS.length,'nouvelle':c('nouvelle'),'prep':c('prep'),'exped':c('exped'),'livr':c('livr')};
    document.querySelectorAll('#ordFilters .of').forEach(b=>{
      const base = b.dataset.label || b.textContent.replace(/\s*\(\d+\)$/,'');
      b.dataset.label = base;
      const n = map[b.dataset.f||''] || 0;
      b.textContent = base + ' (' + n + ')';
    });
  }
  function exportCsv(){
    const head = ['N°','Date','Client','Email','Téléphone','Initiales','Finition','Emplacement','Adresse','Total','Statut','Transporteur','Suivi'];
    const esc = s => '"' + String(s==null?'':s).replace(/"/g,'""') + '"';
    const rows = ORDERS.map(o => [o.id,o.date,o.client,o.email,o.telephone,o.initiales,o.finition,o.emplacement,o.adresse,o.total,o.statut,o.transporteur,o.suivi].map(esc).join(','));
    const csv = '﻿' + head.map(esc).join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'ellia-commandes-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(()=>a.remove(),0);
  }
  function renderOrders(list){ ORDERS=list; updateCounts(); applyFilter(); updateDashAlert(); }

  /* Bandeau "à traiter" sur le tableau de bord */
  function updateDashAlert(){
    const el = document.getElementById('dashAlert'); if(!el) return;
    const nNew  = ORDERS.filter(o=>norm(o.statut).includes('nouvelle')).length;
    const nPrep = ORDERS.filter(o=>{const s=norm(o.statut);return s.includes('prep')||s.includes('prép')||s.startsWith('prete')||s.startsWith('prête');}).length;
    if (!nNew && !nPrep) { el.innerHTML = ''; return; }
    const parts = [];
    if (nNew)  parts.push('<b>'+nNew+'</b> nouvelle'+(nNew>1?'s':'')+' commande'+(nNew>1?'s':'')+' à préparer');
    if (nPrep) parts.push('<b>'+nPrep+'</b> en préparation à expédier');
    el.innerHTML = '<div id="dashAlertBox" style="display:flex;align-items:center;gap:14px;background:#fdf3e7;border:1px solid #f3dcb6;border-left:4px solid #d18e3d;padding:16px 20px;margin-bottom:24px;cursor:pointer;border-radius:3px">'+
      '<span style="font-size:22px">📦</span>'+
      '<span style="font-size:14.5px;color:#7a5215">'+parts.join(' · ')+'</span>'+
      '<span style="margin-left:auto;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a8631e">Voir ›</span></div>';
    document.getElementById('dashAlertBox').addEventListener('click', ()=>{
      const t = document.querySelector('.tab[data-tab="orders"]'); if(t) t.click();
      const f = document.querySelector('#ordFilters .of[data-f="nouvelle"]'); if (nNew && f) f.click();
    });
  }
  (function(){
    document.querySelectorAll('#ordFilters .of').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('#ordFilters .of').forEach(o=>o.classList.remove('active'));
      b.classList.add('active'); FILTER=b.dataset.f||''; applyFilter();
    }));
    const s=document.getElementById('ordSearch'); if(s) s.addEventListener('input',()=>{ SEARCH=s.value||''; applyFilter(); });
    const x=document.getElementById('ordExport'); if(x) x.addEventListener('click', exportCsv);
    // Toggle Liste | Pipeline — restaure le mode memorise puis ecoute les clics
    document.querySelectorAll('#ordViewToggle .of').forEach(b=>{
      b.classList.toggle('active', (b.dataset.view||'list')===VIEW);
      b.addEventListener('click',()=>{
        document.querySelectorAll('#ordViewToggle .of').forEach(o=>o.classList.remove('active'));
        b.classList.add('active');
        VIEW = b.dataset.view||'list';
        try{ localStorage.setItem('ellia_admin_view', VIEW); }catch(_){}
        applyFilter();
      });
    });
  })();
  function omRow(k,v){ return v ? ('<div class="om-row"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>') : ''; }
  function esc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* Timeline visuelle du statut (style Shopify) */
  function statusTimeline(statut){
    const steps = ['Nouvelle','Préparation','Expédiée','Livrée'];
    const s = norm(statut);
    if (s.includes('annul')) return '<div style="margin:14px 0;padding:10px 14px;background:#f5f3ee;color:#888;font-size:12.5px;border-radius:3px">Commande annulée</div>';
    if (s.includes('attente')) return '';
    let idx = 0;
    if (s.includes('prep') || s.includes('prép')) idx = 1;
    else if (s.includes('exp')) idx = 2;
    else if (s.includes('livr')) idx = 3;
    return '<div style="display:flex;align-items:center;margin:16px 0 4px">'+
      steps.map((st,i)=>{
        const done = i <= idx;
        const dot = '<div style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;'+
          (done ? 'background:#0d0d0d;color:#fff' : 'background:#eceae4;color:#b5b0a6')+'">'+(done?'✓':(i+1))+'</div>';
        const label = '<span style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-top:5px;color:'+(done?'#0d0d0d':'#b5b0a6')+'">'+st+'</span>';
        const line = i < steps.length-1 ? '<div style="flex:1;height:2px;margin:0 6px;align-self:flex-start;margin-top:10px;background:'+(i<idx?'#0d0d0d':'#eceae4')+'"></div>' : '';
        return '<div style="display:flex;flex-direction:column;align-items:center">'+dot+label+'</div>'+line;
      }).join('')+
    '</div>';
  }

  /* Bon de préparation imprimable — SANS aucun prix (pour l'atelier / le colis) */
  function printPrepSlip(o){
    // gravureFull() detaille AUSSI les symboles (flamme, hamsa, peace, ellia) :
    // sans cela l'atelier grave uniquement les initiales et oublie les symboles.
    const detail = (typeof gravureFull === 'function') ? gravureFull(o) : '';
    const gravure = (o.initiales && o.initiales !== '—')
      ? '<tr><td>Initiales à graver</td><td style="font-size:26px;font-family:Georgia,serif;letter-spacing:.2em"><b>'+esc(o.initiales)+'</b></td></tr>'+
        '<tr><td>Finition</td><td><b>'+esc(o.finition||'—')+'</b></td></tr>'+
        '<tr><td>Emplacement</td><td><b>'+esc(o.emplacement||'—')+'</b></td></tr>'+
        (detail ? '<tr><td>Détail complet</td><td>'+detail+'</td></tr>' : '')
      : (detail ? '<tr><td>Gravure</td><td>'+detail+'</td></tr>'
                : '<tr><td colspan="2"><b>Sans gravure</b></td></tr>');
    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Bon de préparation '+esc(o.id)+'</title>'+
      '<style>body{font-family:Arial,sans-serif;color:#111;max-width:640px;margin:30px auto;padding:0 20px}h1{font-size:20px;border-bottom:2px solid #111;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin:18px 0}td{padding:10px 12px;border:1px solid #ddd;font-size:14px}td:first-child{width:200px;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:.08em}img{max-width:280px;border:1px solid #ddd;margin-top:8px}.foot{margin-top:30px;font-size:11px;color:#999}@media print{.noprint{display:none}}</style></head><body>'+
      '<h1>ELLIA PARIS — Bon de préparation<br><span style="font-size:15px;font-weight:normal">Commande '+esc(o.id)+' · '+esc(o.date||'')+'</span></h1>'+
      (o.is_gift ? ('<div style="border:2px solid #111;padding:14px 16px;margin:0 0 16px">'+
        '<div style="font-size:13px;letter-spacing:.22em;text-transform:uppercase;font-weight:bold">Commande cadeau</div>'+
        '<div style="font-size:13px;margin-top:8px">Bon de livraison <b>sans aucun prix</b> · carte manuscrite à joindre'+
        (o.gift_date ? (' · arrivée souhaitée le <b>'+esc(o.gift_date)+'</b>') : '')+'</div>'+
        (o.gift_message
          ? ('<div style="margin-top:12px;padding:14px 16px;background:#faf8f4;border:1px dashed #999">'+
             '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#666;margin-bottom:8px">Texte à calligraphier</div>'+
             '<div style="font-family:Georgia,serif;font-size:17px;line-height:1.8">« '+esc(o.gift_message)+' »</div>'+
             (o.gift_from ? ('<div style="font-family:Georgia,serif;font-size:14px;margin-top:8px;text-align:right">— '+esc(o.gift_from)+'</div>') : '')+
             '</div>')
          : '<div style="margin-top:10px;font-size:13px;font-style:italic;color:#666">Carte vierge demandée.</div>')+
        '</div>') : '')+
      '<table>'+
        '<tr><td>Article</td><td><b>La Pochette ELLIA — Noir</b></td></tr>'+
        '<tr><td>Quantité</td><td style="font-size:20px"><b>'+(o.quantite||1)+'</b></td></tr>'+
        gravure+
        '<tr><td>Destinataire</td><td><b>'+esc(o.client||'')+'</b></td></tr>'+
        '<tr><td>Adresse de livraison</td><td>'+esc(o.adresse||'')+'</td></tr>'+
        (o.notes_admin ? '<tr><td>Notes internes</td><td>'+esc(o.notes_admin)+'</td></tr>' : '')+
      '</table>'+
      (o.preview && String(o.preview).indexOf('data:image/')===0 ? '<div><div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.08em">Aperçu personnalisation client</div><img src="'+o.preview+'"></div>' : '')+
      '<div class="foot">Document interne — ne contient aucune information de prix. À joindre au poste de gravure / préparation.</div>'+
      '<button class="noprint" onclick="window.print()" style="margin-top:20px;padding:12px 24px;background:#111;color:#fff;border:none;cursor:pointer;font-size:13px">🖨 Imprimer</button>'+
      '</body></html>';
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); } else { alert('Autorisez les fenêtres pop-up pour imprimer le bon de préparation.'); }
  }

  /* Journal des actions de cette commande — visible par l'admin seulement */
  async function chargerJournal(numero){
    var zone = document.getElementById('omJournal');
    if (!zone) return;
    try {
      var r = await fetch('/api/admin/logs?cible=' + encodeURIComponent(numero));
      if (!r.ok) { zone.innerHTML = ''; return; }
      var d = await r.json();
      var l = (d && d.logs) || [];
      if (!l.length) { zone.innerHTML = '<div style="font-size:12.5px;color:var(--gris)">Aucune modification enregistrée.</div>'; return; }
      zone.innerHTML = l.map(function(e){
        var q = new Date(e.created_at);
        var quand = isNaN(q) ? '' : q.toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' });
        var quoi = ({ 'commande.modifiee':'Modification', 'stock.ajuste':'Stock ajusté',
                      'compte.cree':'Compte créé', 'compte.supprime':'Compte supprimé' })[e.action] || e.action;
        var det = '';
        if (e.details) {
          try {
            var o = JSON.parse(e.details);
            det = Object.keys(o).map(function(k){ return k + ' → ' + o[k]; }).join(' · ');
          } catch(_) { det = e.details; }
        }
        return '<div style="display:flex;gap:12px;padding:9px 0;border-bottom:1px solid var(--ligne);font-size:12.5px;line-height:1.6">'
             + '<span style="color:var(--gris);white-space:nowrap;min-width:112px">' + esc(quand) + '</span>'
             + '<span style="flex:1"><b>' + esc(quoi) + '</b>'
             + (det ? ('<br><span style="color:var(--gris)">' + esc(det).slice(0,240) + '</span>') : '')
             + '</span>'
             + '<span style="color:var(--gris);white-space:nowrap">' + esc(e.auteur||'?') + '</span></div>';
      }).join('');
    } catch(_) { zone.innerHTML = ''; }
  }

  function renderViewMode(o){
    // Statut absent du referentiel : on l'ajoute, sinon le select retomberait sur
    // "En attente paiement" et un simple enregistrement retrograderait la commande.
    const inRefV = STATUTS.some(s=>norm(s)===norm(o.statut));
    const sOpts=(inRefV?'':'<option selected>'+esc(o.statut)+'</option>')+
      STATUTS.map(s=>'<option'+(norm(s)===norm(o.statut)?' selected':'')+'>'+s+'</option>').join('');
    const curTransp=(o.transporteur||'')||'UPS'; // UPS pre-selectionne si aucun transporteur renseigne
    const tOpts=TRANSPORTEURS.map(t=>'<option value="'+t+'"'+(curTransp===t?' selected':'')+'>'+(t||'— Transporteur —')+'</option>').join('');
    const manualTag = o.manual ? '<span style="display:inline-block;background:#0d0d0d;color:#fff;font-size:9.5px;letter-spacing:.16em;padding:3px 8px;text-transform:uppercase;margin-left:10px;vertical-align:middle">Manuelle</span>' : '';
    const invoiceRow = o.invoice_number
      ? '<div class="om-row"><span class="k">Facture</span><span class="v"><b>'+o.invoice_number+'</b> &nbsp; <a href="/api/admin/orders/'+encodeURIComponent(o.id)+'/invoice" target="_blank" style="color:#0d0d0d;font-weight:500;text-decoration:underline;font-size:12.5px">Ouvrir PDF</a></span></div>'
      : '<div class="om-row"><span class="k">Facture</span><span class="v"><a href="/api/admin/orders/'+encodeURIComponent(o.id)+'/invoice" target="_blank" style="color:#0d0d0d;font-weight:500;text-decoration:underline;font-size:12.5px">Générer / Télécharger PDF</a></span></div>';
    const payRow = (o.payment_method || o.payment_status) ? ('<div class="om-row"><span class="k">Paiement</span><span class="v">'+(o.payment_method||'—')+' &middot; '+(o.payment_status||'—')+'</span></div>') : '';
    // N° de suivi UPS (1Z...) : lien cliquable dore vers le tracking officiel
    const suiviRow = (o.suivi && /^1Z/i.test(String(o.suivi).trim()))
      ? omRow('Suivi UPS','<a href="https://www.ups.com/track?tracknum='+encodeURIComponent(String(o.suivi).trim())+'" target="_blank" rel="noopener" style="color:#c9a227;font-weight:600;text-decoration:underline">'+esc(o.suivi)+' ↗</a>')
      : '';
    // Bloc preview 3D : visible UNIQUEMENT si la commande contient une image
    var previewBlock = '';
    if (o.preview && typeof o.preview === 'string' && o.preview.indexOf('data:image/') === 0) {
      previewBlock =
        '<div style="margin:14px 0 18px;padding:14px;background:#f8f6f1;border:1px solid #e9e5da;border-radius:3px">'+
          '<div style="font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--gris2);margin-bottom:10px">Aperçu de la personnalisation choisie par le client</div>'+
          '<a href="'+o.preview+'" target="_blank" title="Ouvrir en grand"><img src="'+o.preview+'" alt="Aperçu personnalisation" style="display:block;max-width:340px;width:100%;height:auto;border:1px solid #e0ddd6;border-radius:3px;cursor:zoom-in" /></a>'+
        '</div>';
    }
    // Banniere d'avertissement specifique pour commandes pas encore payees
    const waitingBanner = norm(o.statut).includes('attente paiement')
      ? '<div style="margin:14px 0 18px;padding:12px 16px;background:#fdf3e7;border:1px solid #f3dcb6;border-radius:3px;font-size:13px;color:#a8631e;display:flex;align-items:flex-start;gap:10px"><span style="font-size:16px;line-height:1">⏳</span><span><b>Paiement Stripe en cours</b> — cette commande n\'a pas encore été confirmée. Aucun email client n\'a été envoyé, aucun stock n\'a été débité de manière définitive.</span></div>'
      : '';
    document.getElementById('ordModalBox').innerHTML=
      '<button class="om-close" id="omClose">×</button>'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">'+
        '<div><h3 style="margin:0">Commande '+esc(o.id)+manualTag+'</h3><div style="color:var(--gris);font-size:13px;margin-top:4px">'+esc(o.date)+'</div></div>'+
        (window.__role==='admin'||!window.__role ? '<button id="omEdit" style="font-family:var(--sans);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;padding:9px 16px;border:1px solid var(--ligne);background:#fff;cursor:pointer;color:var(--noir)">Modifier</button>' : '')+
      '</div>'+
      waitingBanner+
      statusTimeline(esc(o.statut))+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 6px">'+
        '<button type="button" class="of" id="omPrint" style="font-size:11px">🖨 Bon de préparation</button>'+
        (o.email ? '<a class="of" href="mailto:'+esc(o.email)+'?subject=Votre%20commande%20'+encodeURIComponent(o.id)+'%20—%20ELLIA%20PARIS" style="font-size:11px;text-decoration:none">✉ Écrire au client</a>' : '')+
        '<button type="button" class="of" id="omCopyAddr" style="font-size:11px">📋 Copier l\'adresse</button>'+
        (o.telephone ? '<a class="of" href="tel:'+esc(String(o.telephone).replace(/\s/g,''))+'" style="font-size:11px;text-decoration:none">📞 '+esc(o.telephone)+'</a>' : '')+
      '</div>'+
      (window.__role==='admin' ?
        ('<details style="margin:16px 0 4px;border-top:1px solid var(--ligne);padding-top:14px">'+
          '<summary style="cursor:pointer;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--gris2);list-style:none">Historique des modifications</summary>'+
          '<div id="omJournal" style="margin-top:12px"><div style="font-size:12.5px;color:var(--gris)">Chargement…</div></div>'+
        '</details>') : '')+
      '<div style="height:8px"></div>'+
      omRow('Client',esc(o.client))+omRow('E-mail',esc(o.email))+omRow('Téléphone',esc(o.telephone))+
      omRow('Adresse de livraison',esc(o.adresse))+omRow('Adresse de facturation',esc(o.adresseFact||o.adresse))+
      omRow('Personnalisation',gravureFull(o))+
      (o.is_gift ? omRow('Cadeau', 'Bon de livraison sans prix'
          + (o.gift_message ? ('<br><em style="font-family:var(--serif);font-size:15px">« '+esc(o.gift_message)+' »</em>'+(o.gift_from?('<br>— '+esc(o.gift_from)):'')) : '<br><em>Carte vierge</em>')
          + (o.gift_date ? ('<br>Arrivée souhaitée : <b>'+esc(o.gift_date)+'</b>') : '')) : '')+
      previewBlock+
      // Role atelier : aucune ligne financiere (le serveur ne lui envoie de toute facon pas les montants)
      (window.__role==='atelier' ? '' : omRow('Total','<b>'+eur(o.total)+'</b>')+payRow+invoiceRow)+
      suiviRow+
      '<div style="margin:20px 0 8px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gris2)">Gestion de la commande</div>'+
      '<div class="om-actions">'+
        '<select class="om-statut">'+sOpts+'</select>'+
        '<select class="om-transp">'+tOpts+'</select>'+
        '<input class="om-suivi" placeholder="N° de suivi" value="'+esc(o.suivi||'')+'">'+
        '<button class="ord-save" id="omSave">Enregistrer</button>'+
        '<span class="ord-saved" id="omSaved" style="display:none">✓ Enregistré</span>'+
      '</div>';
    document.getElementById('omClose').addEventListener('click',closeOrder);
    if (window.__role === 'admin') chargerJournal(o.id);
    const omE = document.getElementById('omEdit');
    if (omE) omE.addEventListener('click',()=>openEditMode(o.id));
    const pBtn = document.getElementById('omPrint');
    if (pBtn) pBtn.addEventListener('click', ()=>printPrepSlip(o));
    const cBtn = document.getElementById('omCopyAddr');
    if (cBtn) cBtn.addEventListener('click', async ()=>{
      const txt = (o.client||'') + '\n' + (o.adresse||'');
      try { await navigator.clipboard.writeText(txt); cBtn.textContent = '✓ Adresse copiée'; setTimeout(()=>{ cBtn.textContent='📋 Copier l\'adresse'; }, 2000); }
      catch(_) { alert(txt); }
    });
    document.getElementById('omSave').addEventListener('click',()=>{
      const statut=document.querySelector('.om-statut').value;
      const transporteur=document.querySelector('.om-transp').value;
      const suivi=document.querySelector('.om-suivi').value.trim();
      // Garde-fou UPS : un n° UPS commence par 1Z suivi de 16 caracteres
      if(transporteur==='UPS' && suivi && !/^1Z[A-Z0-9]{16}$/i.test(suivi)){
        if(!confirm('Ce numéro ne ressemble pas à un n° UPS (1Z + 16 caractères). Enregistrer quand même ?')) return;
      }
      // N'envoyer "statut" QUE s'il a change : sinon chaque enregistrement
      // (correction d'un n° de suivi par ex.) renvoie un email au client.
      const statutAvant = o.statut;
      const body = {};
      if (norm(statut) !== norm(statutAvant)) body.statut = statut;
      if (transporteur !== (o.transporteur||'')) body.transporteur = transporteur;
      if (suivi !== (o.suivi||'')) body.suivi = suivi;
      if (!Object.keys(body).length) { const sv0=document.getElementById('omSaved'); if(sv0){ sv0.style.display='inline'; setTimeout(()=>{sv0.style.display='none';},1500);} return; }
      const btnSave = document.getElementById('omSave');
      btnSave.disabled = true; const oldB = btnSave.textContent; btnSave.textContent = 'Enregistrement…';
      fetch('/api/orders/'+encodeURIComponent(o.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        .then(r=>{
          if(!r.ok) throw new Error(r.status===403?'Droits insuffisants pour cette action.':'Erreur serveur ('+r.status+')');
          // Succes confirme par le serveur : on met l'affichage a jour
          o.statut=statut; o.transporteur=transporteur; o.suivi=suivi;
          const b=document.querySelector('[data-badge="'+o.id+'"]'); if(b){ b.textContent=statut; b.className='badge '+badgeClass(statut); }
          updateCounts(); updateDashAlert(); applyFilter();
          const sv=document.getElementById('omSaved'); if(sv){ sv.style.display='inline'; setTimeout(()=>{ if(sv) sv.style.display='none'; },2000); }
        })
        .then(null, err=>{ alert('Enregistrement impossible : '+(err.message||'erreur réseau')+'\nAucune modification n’a été enregistrée.'); })
        .finally(()=>{ btnSave.disabled=false; btnSave.textContent=oldB; });
    });
  }

  function openOrder(id){
    const o=ORDERS.find(x=>x.id===id); if(!o) return;
    renderViewMode(o);
    document.getElementById('ordModal').classList.add('open');
  }

  async function openEditMode(id){
    let full = null;
    try{ const r = await fetch('/api/admin/orders/'+encodeURIComponent(id),{cache:'no-store'}); if(r.ok) full = await r.json(); }catch(_){}
    if (!full) {
      // SECURITE : sans les vraies donnees, le formulaire s'ouvrirait avec des valeurs
      // par defaut (159 €, TVA 20...) et "Enregistrer" ECRASERAIT les montants reels.
      alert('Impossible de charger le détail complet de la commande — édition annulée pour protéger les données. Réessaie dans un instant.');
      return;
    }
    const o = full;
    // DOIT correspondre exactement au configurateur (app.js `names` et boutons
    // .place-btn) : une valeur absente ferait retomber le select sur "— Choisir —"
    // et un simple enregistrement effacerait la finition/l'emplacement en base.
    const FINITIONS = ['','Or','Or rose','Argent','Aveugle','Noir','Blanc'];
    const EMPLACEMENTS = ['','Centre','Haut gauche','Haut droit','Bas gauche','Bas droit'];
    const MODES = ['','Stripe','Virement bancaire','Chèque','Espèces','Carte bancaire (en main)','PayPal','Autre'];
    const STATUTS_PAY = ['En attente','Payee','Payé','Partiel','Remboursé','Annulé'];
    const opt = (arr, cur) => arr.map(v=>'<option value="'+esc(v)+'"'+((v===(cur||''))?' selected':'')+'>'+(v||'— Choisir —')+'</option>').join('');
    const inp = (name, val, type, extra) => '<input name="'+name+'" type="'+(type||'text')+'" value="'+esc(val==null?'':val)+'" '+(extra||'')+' style="width:100%;padding:9px 11px;border:1px solid var(--ligne);background:#fafaf7;font-family:var(--sans);font-size:13.5px;color:var(--noir);outline:none">';
    const lab = (l, body) => '<div style="display:flex;flex-direction:column;gap:5px"><label style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gris2)">'+l+'</label>'+body+'</div>';
    const sel = (name, options) => '<select name="'+name+'" style="width:100%;padding:9px 11px;border:1px solid var(--ligne);background:#fafaf7;font-family:var(--sans);font-size:13.5px;color:var(--noir);outline:none">'+options+'</select>';
    document.getElementById('ordModalBox').innerHTML=
      '<button class="om-close" id="omClose">×</button>'+
      '<h3 style="margin:0">Modifier la commande '+id+'</h3>'+
      '<div style="color:var(--gris);font-size:12.5px;margin:6px 0 18px">Les changements seront reflétés sur la facture lors de sa réimpression.</div>'+
      '<form id="omEditForm" style="display:flex;flex-direction:column;gap:18px">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
          lab('Prénom', inp('client_prenom', o.client_prenom||''))+
          lab('Nom', inp('client_nom', o.client_nom||''))+
          lab('E-mail', inp('client_email', o.client_email||o.email||'', 'email'))+
          lab('Téléphone', inp('telephone', o.telephone||''))+
        '</div>'+
        '<div style="border-top:1px solid var(--ligne);padding-top:14px">'+
          '<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gris2);margin-bottom:10px">Adresse de livraison</div>'+
          '<div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:12px">'+lab('Adresse', inp('adresse_livraison', o.adresse_livraison||''))+'</div>'+
          '<div style="display:grid;grid-template-columns:1fr 2fr 1fr;gap:12px">'+
            lab('CP', inp('cp_livraison', o.cp_livraison||''))+
            lab('Ville', inp('ville_livraison', o.ville_livraison||''))+
            lab('Pays', inp('pays_livraison', o.pays_livraison||'France'))+
          '</div>'+
        '</div>'+
        '<div style="border-top:1px solid var(--ligne);padding-top:14px">'+
          '<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gris2);margin-bottom:10px">Adresse de facturation</div>'+
          '<div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:12px">'+lab('Adresse', inp('adresse_facturation', o.adresse_facturation||''))+'</div>'+
          '<div style="display:grid;grid-template-columns:1fr 2fr 1fr;gap:12px">'+
            lab('CP', inp('cp_facturation', o.cp_facturation||''))+
            lab('Ville', inp('ville_facturation', o.ville_facturation||''))+
            lab('Pays', inp('pays_facturation', o.pays_facturation||'France'))+
          '</div>'+
        '</div>'+
        '<div style="border-top:1px solid var(--ligne);padding-top:14px">'+
          '<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gris2);margin-bottom:10px">Personnalisation</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'+
            lab('Initiales', inp('initiales', o.initiales==='—'?'':(o.initiales||''), 'text', 'maxlength="3" style="text-transform:uppercase;width:100%;padding:9px 11px;border:1px solid var(--ligne);background:#fafaf7;font-family:var(--sans);font-size:13.5px;color:var(--noir);outline:none"'))+
            lab('Finition', sel('finition', opt(FINITIONS, o.finition==='—'?'':(o.finition||''))))+
            lab('Emplacement', sel('emplacement', opt(EMPLACEMENTS, o.emplacement||'')))+
          '</div>'+
        '</div>'+
        '<div style="border-top:1px solid var(--ligne);padding-top:14px">'+
          '<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gris2);margin-bottom:10px">Montants &amp; paiement</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">'+
            lab('Qté', inp('quantite', o.quantite||1, 'number', 'min="1" max="100"'))+
            lab('Prix pochette TTC', inp('prix_pochette', o.prix_pochette!=null?o.prix_pochette:159, 'number', 'min="0" step="0.01"'))+
            lab('Prix gravure TTC', inp('prix_personnalisation', o.prix_personnalisation||0, 'number', 'min="0" step="0.01"'))+
          '</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">'+
            lab('Frais de port TTC', inp('frais_port', o.frais_port||0, 'number', 'min="0" step="0.01"'))+
            lab('TVA (%)', inp('tva_rate', o.tva_rate!=null?o.tva_rate:20, 'number', 'min="0" max="100" step="0.1"'))+
          '</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
            lab('Mode paiement', sel('payment_method', opt(MODES, o.payment_method||'')))+
            lab('Statut paiement', sel('payment_status', opt(STATUTS_PAY, o.payment_status||'En attente')))+
          '</div>'+
        '</div>'+
        '<div style="border-top:1px solid var(--ligne);padding-top:14px">'+
          lab('Notes internes', '<textarea name="notes_admin" rows="3" style="width:100%;padding:9px 11px;border:1px solid var(--ligne);background:#fafaf7;font-family:var(--sans);font-size:13.5px;color:var(--noir);outline:none;resize:vertical">'+esc(o.notes_admin||'')+'</textarea>')+
        '</div>'+
        '<div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;border-top:1px solid var(--ligne);padding-top:14px">'+
          '<button type="button" id="omEditCancel" style="font-family:var(--sans);font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:11px 18px;border:1px solid var(--ligne);background:#fff;cursor:pointer;color:var(--gris)">Annuler</button>'+
          '<button type="submit" id="omEditSave" style="font-family:var(--sans);font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:11px 22px;border:none;background:var(--noir);color:#fff;cursor:pointer">Enregistrer</button>'+
          '<span id="omEditMsg" style="font-size:12.5px"></span>'+
        '</div>'+
      '</form>';
    document.getElementById('omClose').addEventListener('click',closeOrder);
    document.getElementById('omEditCancel').addEventListener('click',()=>renderViewMode(ORDERS.find(x=>x.id===id)||o));
    document.getElementById('omEditForm').addEventListener('submit', async function(e){
      e.preventDefault();
      const data = {};
      new FormData(e.target).forEach((v,k)=>{ data[k] = (typeof v==='string'? v.trim() : v); });
      const msgEl = document.getElementById('omEditMsg');
      const btnEl = document.getElementById('omEditSave');
      msgEl.textContent=''; btnEl.disabled=true; btnEl.textContent='Enregistrement…';
      try{
        const r = await fetch('/api/orders/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        if(r.ok){
          msgEl.style.color='var(--vert)'; msgEl.textContent='✓ Enregistré';
          // Recharger la liste pour refleter les changements
          try{ const list = await get('/api/orders',[]); renderOrders(list); }catch(_){}
          setTimeout(()=>{
            const updated = ORDERS.find(x=>x.id===id);
            if(updated) renderViewMode(updated);
          }, 600);
        } else {
          msgEl.style.color='#b1432f'; msgEl.textContent='Erreur d\'enregistrement';
        }
      }catch(_){ msgEl.style.color='#b1432f'; msgEl.textContent='Connexion impossible'; }
      btnEl.disabled=false; btnEl.textContent='Enregistrer';
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

  /* ============================================================
     STOCK PRO — gestion atomique + historique audit
     ============================================================ */
  const STOCK_REASONS = {
    restock: { label:'Réception fournisseur', cls:'r-restock' },
    order_online: { label:'Vente en ligne', cls:'r-order_online' },
    order_manual: { label:'Vente manuelle (admin)', cls:'r-order_manual' },
    return: { label:'Retour client', cls:'r-return' },
    loss: { label:'Perte / casse / défaut', cls:'r-loss' },
    inventory_correction: { label:'Correction inventaire', cls:'r-inventory_correction' },
    manual_set: { label:'Définition manuelle', cls:'r-manual_set' }
  };
  const stockState = { offset:0, limit:50, reason:'', loading:false };
  function fmtStockDate(iso){
    try{ const d=new Date(iso); return d.toLocaleString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
    catch(_){ return iso||''; }
  }
  function deltaCell(d){
    const n=Number(d||0); if(n>0) return '<span class="delta-pos">+'+n+'</span>';
    if(n<0) return '<span class="delta-neg">'+n+'</span>';
    return '<span style="color:#888">0</span>';
  }
  async function loadStockPro(){
    if(stockState.loading) return;
    stockState.loading = true;
    try {
      const params = new URLSearchParams({ ref:'ELLIA-NOIR', limit:String(stockState.limit), offset:String(stockState.offset) });
      if(stockState.reason) params.set('reason', stockState.reason);
      const r = await fetch('/api/admin/stock/history?'+params.toString());
      if(!r.ok){ document.getElementById('stockHistBody').innerHTML='<tr><td colspan="6" style="color:#b1432f;padding:20px">Erreur de chargement de l\'historique</td></tr>'; return; }
      const data = await r.json();
      const stock = (data.product && Number(data.product.stock)) || 0;
      const seuil = (data.product && Number(data.product.seuil)) || 0;
      document.getElementById('stockBig').textContent = stock;
      const seuilEl = document.getElementById('stockSeuilInfo');
      if(stock <= seuil && seuil>0) seuilEl.innerHTML = '<span style="color:#b1432f;font-weight:500">Stock bas</span> · seuil d\'alerte : '+seuil;
      else seuilEl.textContent = 'Seuil d\'alerte : '+seuil;

      const rows = data.rows || [];
      const last = rows[0];
      if(last && !stockState.reason && stockState.offset===0){
        document.getElementById('stockLastWhen').textContent = fmtStockDate(last.created_at);
        document.getElementById('stockLastDelta').innerHTML = deltaCell(last.delta) + ' <span style="font-size:14px;color:var(--gris)">→ '+last.stock_after+'</span>';
        const r1 = STOCK_REASONS[last.reason] || { label:last.reason, cls:'r-inventory_correction' };
        document.getElementById('stockLastReason').innerHTML = '<span class="reason-tag '+r1.cls+'">'+r1.label+'</span>';
      } else if(!rows.length){
        document.getElementById('stockLastWhen').textContent = '—';
        document.getElementById('stockLastDelta').textContent = 'Aucun mouvement';
        document.getElementById('stockLastReason').textContent = '';
      }

      const tbody = document.getElementById('stockHistBody');
      if(!rows.length){
        tbody.innerHTML = '<tr><td colspan="6" style="color:var(--gris);padding:24px 14px">Aucun mouvement '+(stockState.reason?'pour ce filtre':'enregistré')+'.</td></tr>';
      } else {
        tbody.innerHTML = rows.map(h=>{
          const r2 = STOCK_REASONS[h.reason] || { label:h.reason, cls:'r-inventory_correction' };
          const notes = h.notes ? String(h.notes).slice(0,80).replace(/[<>]/g,'') : '<span style="color:#bbb">—</span>';
          const ord = h.order_numero ? '<span style="font-family:var(--serif);font-size:14px">'+h.order_numero+'</span>' : '<span style="color:#bbb">—</span>';
          return '<tr>'
            +'<td style="white-space:nowrap;color:var(--gris);font-size:13px">'+fmtStockDate(h.created_at)+'</td>'
            +'<td><span class="reason-tag '+r2.cls+'">'+r2.label+'</span></td>'
            +'<td style="text-align:right;font-family:var(--serif);font-size:18px">'+deltaCell(h.delta)+'</td>'
            +'<td style="text-align:right;color:var(--gris);font-size:13.5px">'+h.stock_before+' → <b style="color:var(--noir)">'+h.stock_after+'</b></td>'
            +'<td>'+ord+'</td>'
            +'<td style="color:var(--gris);font-size:13px">'+notes+'</td>'
          +'</tr>';
        }).join('');
      }
      document.getElementById('stockHistInfo').textContent = 'Affichage '+(rows.length?(stockState.offset+1):0)+'–'+(stockState.offset+rows.length)+' · page '+(Math.floor(stockState.offset/stockState.limit)+1);
      document.getElementById('stockHistPrev').disabled = stockState.offset === 0;
      document.getElementById('stockHistNext').disabled = rows.length < stockState.limit;
    } catch(e){
      console.error('loadStockPro', e);
    } finally {
      stockState.loading = false;
    }
  }

  // Modal motif
  let pendingStockAction = null; // {delta, sign} or {set, value}
  function openReasonModal(action, preview, defaultReason){
    pendingStockAction = action;
    document.getElementById('stockReasonPreview').textContent = preview;
    document.getElementById('stockReasonSelect').value = defaultReason || 'restock';
    document.getElementById('stockReasonNotes').value = '';
    document.getElementById('stockReasonModal').classList.add('open');
  }
  function closeReasonModal(){ document.getElementById('stockReasonModal').classList.remove('open'); pendingStockAction=null; }

  async function confirmStockAction(){
    if(!pendingStockAction) return;
    const reason = document.getElementById('stockReasonSelect').value;
    const notes  = document.getElementById('stockReasonNotes').value.trim() || null;
    const btn = document.getElementById('stockReasonConfirm');
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    try {
      let r;
      if(pendingStockAction.set != null){
        r = await fetch('/api/products/ELLIA-NOIR',{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ stock: pendingStockAction.set }) });
      } else {
        r = await fetch('/api/admin/stock/adjust',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ref:'ELLIA-NOIR', delta:pendingStockAction.delta, reason, notes }) });
      }
      if(!r.ok){
        const err = await r.json().catch(()=>({}));
        alert('Erreur : ' + (err.error||err.detail||r.statusText));
      } else {
        closeReasonModal();
        stockState.offset = 0;
        await loadStockPro();
      }
    } catch(e){
      alert('Erreur réseau : '+e.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Valider le mouvement';
    }
  }

  function bindStockPro(){
    // Boutons quick (+1/+5/+10/+25/+50) → motif restock par défaut
    document.querySelectorAll('.stock-quick').forEach(b=>b.addEventListener('click',()=>{
      const delta = Number(b.dataset.delta);
      openReasonModal({ delta }, 'Ajouter '+delta+' au stock', 'restock');
    }));
    // Custom add
    document.getElementById('stockCustomAdd').addEventListener('click',()=>{
      const v = Number(document.getElementById('stockCustomQty').value);
      if(!v || v<1) return alert('Quantité invalide');
      openReasonModal({ delta:v }, 'Ajouter '+v+' au stock', 'restock');
    });
    // Custom remove
    document.getElementById('stockCustomRemove').addEventListener('click',()=>{
      const v = Number(document.getElementById('stockCustomQty').value);
      if(!v || v<1) return alert('Quantité invalide');
      openReasonModal({ delta:-v }, 'Retirer '+v+' du stock', 'loss');
    });
    // Définir absolu
    document.getElementById('stockSetBtn').addEventListener('click',()=>{
      const v = document.getElementById('stockSetTo').value;
      if(v==='' || isNaN(Number(v)) || Number(v)<0) return alert('Stock invalide');
      const n = Number(v);
      if(!confirm('Définir le stock à '+n+' ? Cette action sera enregistrée dans l\'historique.')) return;
      // Set absolu : pas besoin de motif (motif='manual_set' côté DB)
      pendingStockAction = { set: n };
      confirmStockActionDirect();
    });
    // Modal buttons
    document.getElementById('stockReasonClose').addEventListener('click', closeReasonModal);
    document.getElementById('stockReasonCancel').addEventListener('click', closeReasonModal);
    document.getElementById('stockReasonConfirm').addEventListener('click', confirmStockAction);
    document.getElementById('stockReasonModal').addEventListener('click', e=>{ if(e.target.id==='stockReasonModal') closeReasonModal(); });
    // Filtres
    document.querySelectorAll('.hist-filter').forEach(f=>f.addEventListener('click',()=>{
      document.querySelectorAll('.hist-filter').forEach(o=>o.classList.remove('active'));
      f.classList.add('active');
      stockState.reason = f.dataset.reason || '';
      stockState.offset = 0;
      loadStockPro();
    }));
    // Pagination
    document.getElementById('stockHistPrev').addEventListener('click',()=>{
      if(stockState.offset===0) return;
      stockState.offset = Math.max(0, stockState.offset - stockState.limit);
      loadStockPro();
    });
    document.getElementById('stockHistNext').addEventListener('click',()=>{
      stockState.offset += stockState.limit;
      loadStockPro();
    });
  }

  async function confirmStockActionDirect(){
    if(!pendingStockAction) return;
    try {
      const r = await fetch('/api/products/ELLIA-NOIR',{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ stock: pendingStockAction.set }) });
      if(!r.ok){ const err = await r.json().catch(()=>({})); alert('Erreur : ' + (err.error||err.detail||r.statusText)); return; }
      pendingStockAction = null;
      stockState.offset = 0;
      await loadStockPro();
    } catch(e){ alert('Erreur : '+e.message); }
  }

  bindStockPro();

  /* Tabs */
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(o=>o.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(o=>o.classList.remove('active'));
    t.classList.add('active');
    document.getElementById(t.dataset.tab).classList.add('active');
    // Charger l'historique stock quand on entre dans l'onglet
    if(t.dataset.tab === 'stock') loadStockPro();
  }));

  /* ============================================================
     NOUVELLE COMMANDE — saisie manuelle + facture
     ============================================================ */
  (function(){
    const f = document.getElementById('ncForm'); if(!f) return;
    const $ = s => f.querySelector(s);
    const msg = document.getElementById('ncMsg');
    const btn = document.getElementById('ncSubmit');
    const sameAddr = document.getElementById('ncSameAddr');
    const factBlock = document.getElementById('ncFactBlock');
    const totTTC = document.getElementById('ncTotalTTC');
    const totHT  = document.getElementById('ncTotalHT');
    const totTVA = document.getElementById('ncTotalTVA');

    function fmt(n){ return Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'; }

    function recalc(){
      const q   = Math.max(1, Number($('[name="quantite"]').value)||1);
      const pP  = Math.max(0, Number($('[name="prix_pochette"]').value)||0);
      const pX  = Math.max(0, Number($('[name="prix_personnalisation"]').value)||0);
      const pT  = Math.max(0, Number($('[name="frais_port"]').value)||0);
      const tva = Math.max(0, Number($('[name="tva_rate"]').value)||0);
      const remise = Number(($('[name="promo_discount"]')||{}).value || window.__ordRemise || 0);
      const ttc = Math.max(0, (pP + pX) * q + pT - remise);   // aligne sur le calcul serveur
      const ht  = ttc / (1 + tva/100);
      const t   = ttc - ht;
      totTTC.textContent = fmt(ttc);
      totHT.textContent  = fmt(ht) + ' HT';
      totTVA.textContent = '+ ' + fmt(t) + ' TVA';
    }

    // Pas de tarif forfaitaire : la gravure se calcule 5 €/lettre + 2 €/caractère spécial + 10 €/symbole
    $('[name="initiales"]').addEventListener('input', e=>{
      const v = e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);
      e.target.value = v;
      const inp = $('[name="prix_personnalisation"]');
      // (ancien forfait 59 € supprime : il ne correspond plus a la grille tarifaire)
      if (v.length===0 && Number(inp.value)===59) inp.value = 0;
      recalc();
    });

    // Live recalc sur tout changement de prix/quantité
    ['quantite','prix_pochette','prix_personnalisation','frais_port','tva_rate'].forEach(n=>{
      const el = $('[name="'+n+'"]'); if(el) el.addEventListener('input', recalc);
    });

    // Toggle adresse de facturation
    sameAddr.addEventListener('change', ()=>{
      factBlock.style.display = sameAddr.checked ? 'none' : 'block';
    });

    // Reset
    document.getElementById('ncReset').addEventListener('click', ()=>{
      f.reset(); $('[name="pays_livraison"]').value='France'; $('[name="pays_facturation"]').value='France';
      $('[name="prix_pochette"]').value=159; $('[name="prix_personnalisation"]').value=0;
      $('[name="quantite"]').value=1; $('[name="tva_rate"]').value=20; $('[name="frais_port"]').value=0;
      $('[name="payment_status"]').value='Payé'; $('[name="statut"]').value='Nouvelle';
      sameAddr.checked=true; factBlock.style.display='none';
      msg.className='nc-msg'; msg.textContent=''; recalc();
    });

    // Submit
    f.addEventListener('submit', async function(e){
      e.preventDefault();
      msg.className='nc-msg'; msg.textContent='';
      const data = {};
      new FormData(f).forEach((v,k)=>{ data[k] = (typeof v==='string' ? v.trim() : v); });
      // Si adresse identique, on copie
      if (sameAddr.checked){
        data.adresse_facturation = data.adresse_livraison;
        data.cp_facturation = data.cp_livraison;
        data.ville_facturation = data.ville_livraison;
        data.pays_facturation = data.pays_livraison;
      }
      if(!data.client_nom || data.client_nom.length<2){
        msg.className='nc-msg err'; msg.textContent='Le nom du client est obligatoire.'; return;
      }
      const old = btn.textContent; btn.disabled=true; btn.textContent='Création en cours…';
      try{
        const r = await fetch('/api/admin/orders',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        const j = await r.json().catch(()=>({}));
        if(r.ok && j.ok){
          const inv = j.invoice_number || '—';
          const num = j.numero || '—';
          const sentMsg = (j.mail_client || j.mail_archive)
            ? ('Facture <b>'+inv+'</b> envoyée'
                + (j.mail_client ? ' au client' : '')
                + (j.mail_archive ? ' · archivée sur contact@ellia-paris.fr' : '') + '.')
            : ('N° de facture <b>'+inv+'</b> réservé. La facture sera envoyée automatiquement quand tu passeras la commande en <b>"Expédiée"</b>.');
          msg.className='nc-msg ok';
          msg.innerHTML = '✓ Commande <b>'+num+'</b> créée. '+sentMsg+
            ' <a href="/api/admin/orders/'+encodeURIComponent(num)+'/invoice" target="_blank" style="color:inherit;text-decoration:underline;font-weight:bold">Aperçu PDF</a>';
          // Recharger la liste des commandes
          try{ const o=await get('/api/orders',[]); renderOrders(o); }catch(_){}
        } else {
          msg.className='nc-msg err';
          msg.textContent = 'Erreur : '+(j.error||'inconnue')+(j.detail?(' — '+j.detail):'');
        }
      }catch(err){
        msg.className='nc-msg err';
        msg.textContent = 'Connexion impossible : '+err.message;
      }
      btn.disabled=false; btn.textContent=old;
    });

    recalc();
  })();

  

  /* ============================================================
     COMPTABILITE — exports CSV + dashboard CA + seuils
     ============================================================ */
  (function(){
    const yearSel = document.getElementById('comptaYear');
    if(!yearSel) return;
    const cur = new Date().getFullYear();
    const years = [cur, cur-1, cur-2];
    yearSel.innerHTML = years.map(y => '<option value="'+y+'">'+y+'</option>').join('');
    function fmtEur(n){ return Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'; }
    function fmtPct(n){ return Number(n||0).toFixed(1).replace('.',',')+' %'; }
    const MOIS_COURT = ['Jan','Fév','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'];

    async function loadCompta(){
      const y = yearSel.value;
      try {
        const r = await fetch('/api/admin/compta?year='+y,{cache:'no-store'});
        const d = await r.json();
        if(d.error){ throw new Error(d.error); }
        renderCompta(d);
        document.getElementById('comptaExportRecettes').href = '/api/admin/export/recettes.csv?year='+y;
        document.getElementById('comptaExportRecettes').setAttribute('download', 'livre-recettes-'+y+'.csv');
        document.getElementById('comptaExportFactures').href = '/api/admin/export/factures.csv?year='+y;
        document.getElementById('comptaExportFactures').setAttribute('download', 'factures-'+y+'.csv');
      } catch(e) {
        document.getElementById('comptaKpis').innerHTML = '<div style="grid-column:1/-1;padding:18px;background:#fbeae6;color:#b1432f;border-left:3px solid #b1432f">Impossible de charger les données comptables : '+e.message+'</div>';
      }
    }

    function renderCompta(d){
      // KPIs
      document.getElementById('comptaKpis').innerHTML =
        kpiCard('CA encaissé '+d.year, fmtEur(d.ca_ttc), d.nb_commandes+' commande'+(d.nb_commandes>1?'s':'')+' payée'+(d.nb_commandes>1?'s':''))+
        kpiCard('CA HT', fmtEur(d.ca_ht), 'Hors taxes')+
        kpiCard('TVA collectée', fmtEur(d.tva_collectee), 'À reverser')+
        kpiCard('En attente de paiement', fmtEur(d.ca_en_attente||0), (d.nb_en_attente||0)+' commande'+((d.nb_en_attente||0)>1?'s':'')+' — hors CA');

      // Seuils
      const pctMicro = Math.min(100, d.pct_micro);
      const pctTVA = Math.min(100, d.pct_franchise_tva);
      const colMicro = pctMicro >= 90 ? '#b1432f' : (pctMicro >= 70 ? '#9a6a14' : '#2f7d52');
      const colTVA = pctTVA >= 90 ? '#b1432f' : (pctTVA >= 70 ? '#9a6a14' : '#2f7d52');
      document.getElementById('comptaSeuils').innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:18px 0 12px">'+
        '  <div style="background:#fff;border:1px solid var(--ligne);padding:20px">'+
        '    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gris2);margin-bottom:10px">Seuil micro-entreprise (vente de biens)</div>'+
        '    <div style="font-family:var(--serif);font-size:24px;color:'+colMicro+'">'+fmtPct(d.pct_micro)+'</div>'+
        '    <div style="font-size:12px;color:var(--gris);margin-top:6px">'+fmtEur(d.ca_ttc)+' / '+fmtEur(d.seuil_micro)+'</div>'+
        '    <div style="height:6px;background:#eee;margin-top:10px;border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pctMicro+'%;background:'+colMicro+'"></div></div>'+
        '  </div>'+
        '  <div style="background:#fff;border:1px solid var(--ligne);padding:20px">'+
        '    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gris2);margin-bottom:10px">Seuil franchise TVA</div>'+
        '    <div style="font-family:var(--serif);font-size:24px;color:'+colTVA+'">'+fmtPct(d.pct_franchise_tva)+'</div>'+
        '    <div style="font-size:12px;color:var(--gris);margin-top:6px">'+fmtEur(d.ca_ttc)+' / '+fmtEur(d.seuil_franchise_tva)+'</div>'+
        '    <div style="height:6px;background:#eee;margin-top:10px;border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pctTVA+'%;background:'+colTVA+'"></div></div>'+
        '  </div>'+
        '</div>';

      // Chart mensuel
      const max = Math.max.apply(null, d.by_month) || 1;
      document.getElementById('comptaChart').innerHTML = d.by_month.map((v,i)=>
        '<div class="bar"><div class="val">'+(v ? fmtEur(v).replace(',00','') : '—')+'</div>'+
        '<div class="col" style="height:'+Math.round(v/max*100)+'%;min-height:'+(v>0?2:0)+'px"></div>'+
        '<div class="m">'+MOIS_COURT[i]+'</div></div>').join('');
    }
    function kpiCard(l,v,d){ return '<div class="kpi"><div class="l">'+l+'</div><div class="v">'+v+'</div><div class="d">'+(d||'')+'</div></div>'; }

    yearSel.addEventListener('change', loadCompta);
    document.getElementById('comptaRefresh').addEventListener('click', loadCompta);
    // Lazy load au premier affichage de l'onglet
    document.querySelector('.tab[data-tab="compta"]')?.addEventListener('click', loadCompta);
  })();

  

  /* ============================================================
     CODES PROMO — CRUD admin
     ============================================================ */
  (function(){
    const form = document.getElementById('promoForm');
    if(!form) return;
    const list = document.getElementById('promoList');
    const msg = document.getElementById('promoMsg');

    async function reload(){
      try {
        const r = await fetch('/api/admin/promo',{cache:'no-store'});
        const codes = await r.json();
        if(!Array.isArray(codes)){ list.innerHTML = '<div style="color:var(--gris)">Erreur de chargement.</div>'; return; }
        if(codes.length === 0){ list.innerHTML = '<div style="color:var(--gris);padding:20px 0">Aucun code promo créé pour le moment.</div>'; return; }
        list.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th>Code</th><th>Type</th><th>Valeur</th><th>Min</th><th>Utilisé</th><th>Expire</th><th>Statut</th><th></th></tr></thead><tbody>' +
          codes.map(c => {
            const exp = c.expires_at ? new Date(c.expires_at).toLocaleDateString('fr-FR') : '∞';
            const used = (c.used_count||0) + (c.max_uses ? ' / '+c.max_uses : ' / ∞');
            let val = '';
            if(c.discount_type==='percent') val = c.discount_value+' %';
            else if(c.discount_type==='fixed') val = Number(c.discount_value).toFixed(2)+' €';
            else if(c.discount_type==='shipping') val = 'Port offert';
            return '<tr>'+
              '<td><b style="font-family:monospace;font-size:13px">'+c.code+'</b>'+(c.description?'<br><span style="font-size:11px;color:var(--gris)">'+c.description+'</span>':'')+'</td>'+
              '<td>'+c.discount_type+'</td>'+
              '<td><b>'+val+'</b></td>'+
              '<td>'+(c.min_order>0 ? Number(c.min_order).toFixed(2)+' €' : '—')+'</td>'+
              '<td>'+used+'</td>'+
              '<td>'+exp+'</td>'+
              '<td><span style="display:inline-block;padding:3px 9px;border-radius:2px;font-size:11px;background:'+(c.active?'var(--vert-bg)':'#f5f5f5')+';color:'+(c.active?'var(--vert)':'var(--gris2)')+'">'+(c.active?'Actif':'Inactif')+'</span></td>'+
              '<td style="text-align:right;white-space:nowrap"><button data-toggle="'+c.code+'" data-state="'+(c.active?1:0)+'" style="border:1px solid var(--ligne);background:#fff;padding:5px 10px;font-size:11px;cursor:pointer;margin-right:4px">'+(c.active?'Désactiver':'Activer')+'</button>'+
              '<button data-del="'+c.code+'" style="border:1px solid #b1432f;background:#fff;color:#b1432f;padding:5px 10px;font-size:11px;cursor:pointer">Suppr.</button></td>'+
              '</tr>';
          }).join('') + '</tbody></table>';

        list.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', async ()=>{
          const code = btn.dataset.toggle; const active = btn.dataset.state !== '1';
          await fetch('/api/admin/promo/'+encodeURIComponent(code), { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({active}) });
          reload();
        }));
        list.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async ()=>{
          if(!confirm('Supprimer le code "'+btn.dataset.del+'" ?')) return;
          await fetch('/api/admin/promo/'+encodeURIComponent(btn.dataset.del), { method:'DELETE' });
          reload();
        }));
      } catch(e){ list.innerHTML = '<div style="color:#b1432f">Erreur : '+e.message+'</div>'; }
    }

    form.addEventListener('submit', async function(e){
      e.preventDefault();
      msg.textContent = ''; msg.style.color = '';
      const data = {};
      new FormData(form).forEach((v,k) => { data[k] = typeof v === 'string' ? v.trim() : v; });
      if(data.expires_at) data.expires_at = new Date(data.expires_at).toISOString();
      if(!data.max_uses) delete data.max_uses;
      try {
        const r = await fetch('/api/admin/promo', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        const j = await r.json().catch(()=>({}));
        if(r.ok && j.ok){
          msg.style.color = 'var(--vert)'; msg.textContent = '✓ Code créé';
          form.reset();
          reload();
        } else {
          msg.style.color = '#b1432f'; msg.textContent = 'Erreur : ' + (j.error || 'inconnue');
        }
      } catch(err){ msg.style.color = '#b1432f'; msg.textContent = 'Connexion impossible'; }
    });

    document.querySelector('.tab[data-tab="promo"]')?.addEventListener('click', reload);
  })();

  /* ============================================================
     2FA — Setup / Enable / Disable
     ============================================================ */
  (function(){
    const status = document.getElementById('sec2faStatus');
    if(!status) return;
    let pendingSecret = null;

    async function refresh(){
      try {
        const r = await fetch('/api/admin/2fa/status', { cache:'no-store' });
        const j = await r.json();
        if(j.enabled){
          status.style.background = 'var(--vert-bg)'; status.style.color = 'var(--vert)'; status.style.borderColor = 'var(--vert)';
          status.innerHTML = '✓ <b>Double authentification ACTIVÉE</b> — Tu dois entrer un code à 6 chiffres à chaque connexion.';
          document.getElementById('sec2faSetup').style.display = 'none';
          document.getElementById('sec2faDisable').style.display = 'block';
        } else {
          status.style.background = '#fbf6e8'; status.style.color = '#7a6320'; status.style.borderColor = '#ecdfbd';
          status.innerHTML = '⚠ <b>2FA non activée.</b> Recommandé pour protéger ton admin.';
          document.getElementById('sec2faSetup').style.display = 'none';
          document.getElementById('sec2faDisable').style.display = 'none';
          // Bouton pour démarrer le setup
          if(!document.getElementById('sec2faStartBtn')){
            const btn = document.createElement('button');
            btn.id = 'sec2faStartBtn';
            btn.textContent = 'Activer la 2FA';
            btn.style.cssText = 'font-family:var(--sans);font-size:11px;letter-spacing:.16em;text-transform:uppercase;padding:13px 22px;border:none;background:var(--noir);color:#fff;cursor:pointer';
            btn.addEventListener('click', startSetup);
            status.parentNode.insertBefore(btn, document.getElementById('sec2faSetup'));
          }
        }
      } catch(e){ status.textContent = 'Erreur de chargement.'; }
    }

    async function startSetup(){
      const r = await fetch('/api/admin/2fa/setup', { method:'POST' });
      const j = await r.json();
      if(!j.secret) return;
      pendingSecret = j.secret;
      document.getElementById('sec2faSecret').textContent = j.secret;
      // QR Code via qrcode-generator
      const qrDiv = document.getElementById('sec2faQr');
      qrDiv.innerHTML = '';
      try {
        const qr = qrcode(0, 'M');
        qr.addData(j.uri); qr.make();
        qrDiv.innerHTML = qr.createImgTag(5, 8);
      } catch(_){ qrDiv.innerHTML = '<div style="color:var(--gris);padding:20px;border:1px dashed var(--ligne)">Saisis la clé manuellement</div>'; }
      document.getElementById('sec2faSetup').style.display = 'block';
      const startBtn = document.getElementById('sec2faStartBtn'); if(startBtn) startBtn.remove();
    }

    document.getElementById('sec2faEnable').addEventListener('click', async ()=>{
      const code = document.getElementById('sec2faCode').value.trim();
      const m = document.getElementById('sec2faSetupMsg');
      if(!pendingSecret || code.length !== 6){ m.style.color='#b1432f'; m.textContent='Code à 6 chiffres requis.'; return; }
      const r = await fetch('/api/admin/2fa/enable', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ secret: pendingSecret, code }) });
      const j = await r.json();
      if(r.ok && j.ok){ m.style.color='var(--vert)'; m.textContent='✓ 2FA activée'; setTimeout(refresh, 800); }
      else { m.style.color='#b1432f'; m.textContent = 'Code invalide. Vérifie l\'heure de ton téléphone.'; }
    });

    document.getElementById('sec2faDisableBtn').addEventListener('click', async ()=>{
      const code = document.getElementById('sec2faCodeDisable').value.trim();
      const m = document.getElementById('sec2faDisableMsg');
      if(!confirm('Désactiver la 2FA ?')) return;
      const r = await fetch('/api/admin/2fa/disable', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code }) });
      const j = await r.json();
      if(r.ok && j.ok){ m.style.color='var(--vert)'; m.textContent='✓ 2FA désactivée'; setTimeout(refresh, 800); }
      else { m.style.color='#b1432f'; m.textContent = 'Code invalide.'; }
    });

    document.querySelector('.tab[data-tab="securite"]')?.addEventListener('click', refresh);
    // Initial load si onglet activé par défaut
    if(document.getElementById('securite')?.classList.contains('active')) refresh();
  })();

  /* ============================================================
     CLIENTS — vue agregee
     ============================================================ */
  (function(){
    const body = document.getElementById('clientsBody');
    const search = document.getElementById('clientSearch');
    const count = document.getElementById('clientCount');
    if(!body) return;
    let CLIENTS = [];
    const eur = n => Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:0}) + ' €';
    function render(){
      const q = (search && search.value || '').toLowerCase().trim();
      const list = q ? CLIENTS.filter(c => (c.nom||'').toLowerCase().includes(q) || (c.email||'').includes(q)) : CLIENTS;
      if(count) count.textContent = list.length + ' client' + (list.length>1?'s':'');
      if(!list.length){ body.innerHTML = '<tr><td colspan="7" style="color:var(--gris);padding:24px 14px">Aucun client.</td></tr>'; return; }
      body.innerHTML = list.map(c =>
        '<tr>'+
        '<td style="font-family:var(--serif);font-size:15px">'+esc(c.nom||'—')+'</td>'+
        '<td style="font-size:13px">'+esc(c.email)+'</td>'+
        '<td style="font-size:13px">'+esc(c.telephone||'—')+'</td>'+
        '<td>'+c.nb_commandes+'</td>'+
        '<td style="font-family:var(--serif);font-size:15px">'+eur(c.total_depense)+'</td>'+
        '<td style="font-size:13px">'+String(c.derniere_commande||'').slice(0,10)+'</td>'+
        '<td><button class="of client-orders-btn" data-email="'+esc(c.email)+'" style="font-size:11px">Voir commandes</button></td>'+
        '</tr>'
      ).join('');
      body.querySelectorAll('.client-orders-btn').forEach(b => b.addEventListener('click', ()=>{
        // Bascule vers l'onglet Commandes avec recherche pre-remplie
        const ordTab = document.querySelector('.tab[data-tab="orders"]'); if(ordTab) ordTab.click();
        const os = document.getElementById('ordSearch');
        if(os){ os.value = b.dataset.email; os.dispatchEvent(new Event('input')); }
      }));
    }
    async function load(){
      try{
        const r = await fetch('/api/admin/clients'); const j = await r.json();
        CLIENTS = j.clients || []; render();
      }catch(e){ body.innerHTML = '<tr><td colspan="7" style="color:#b1432f;padding:24px 14px">Erreur de chargement.</td></tr>'; }
    }
    if(search) search.addEventListener('input', render);
    document.querySelector('.tab[data-tab="clients"]')?.addEventListener('click', load);
  })();

  /* ============================================================
     AVIS — moderation
     ============================================================ */
  (function(){
    const list = document.getElementById('avisList');
    if(!list) return;
    let AVIS = [], FILTER = '';
    const stars = n => '★'.repeat(n) + '☆'.repeat(5-n);
    function render(){
      let rows = AVIS;
      if(FILTER==='pending') rows = AVIS.filter(a=>!a.validated);
      if(FILTER==='ok') rows = AVIS.filter(a=>a.validated);
      if(!rows.length){ list.innerHTML = '<div style="color:var(--gris);padding:12px 0">Aucun avis'+(FILTER==='pending'?' en attente':'')+'.</div>'; return; }
      list.innerHTML = rows.map(a =>
        '<div style="border:1px solid var(--ligne);background:#fff;padding:18px 20px;'+(a.validated?'':'border-left:3px solid #d18e3d;')+'">'+
          '<div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:baseline">'+
            '<div><b style="font-family:var(--serif);font-size:16px">'+esc(a.prenom||'')+'</b> <span style="color:#c9a227;letter-spacing:2px">'+stars(a.note||0)+'</span>'+
            (a.validated ? ' <span class="badge b-livree" style="margin-left:8px">Publié</span>' : ' <span class="badge b-wait" style="margin-left:8px">En attente</span>')+'</div>'+
            '<span style="font-size:12px;color:var(--gris)">'+String(a.created_at||'').slice(0,10)+' · '+esc(a.email||'')+'</span>'+
          '</div>'+
          (a.titre ? '<div style="font-style:italic;margin:8px 0 4px;font-family:var(--serif)">« '+esc(a.titre)+' »</div>' : '')+
          '<p style="font-size:13.5px;color:var(--gris);margin:6px 0 14px;line-height:1.6">'+esc(a.commentaire||'')+'</p>'+
          '<div style="display:flex;gap:10px">'+
            (a.validated
              ? '<button class="of avis-unpub" data-id="'+a.id+'">Dépublier</button>'
              : '<button class="of avis-pub" data-id="'+a.id+'" style="background:var(--noir);color:#fff;border-color:var(--noir)">✓ Valider et publier</button>')+
            '<button class="of avis-del" data-id="'+a.id+'" style="color:#b1432f;border-color:#e7cfc9">Supprimer</button>'+
          '</div>'+
        '</div>'
      ).join('');
      list.querySelectorAll('.avis-pub').forEach(b=>b.addEventListener('click',()=>setValid(b.dataset.id,true)));
      list.querySelectorAll('.avis-unpub').forEach(b=>b.addEventListener('click',()=>setValid(b.dataset.id,false)));
      list.querySelectorAll('.avis-del').forEach(b=>b.addEventListener('click',()=>{
        if(!confirm('Supprimer définitivement cet avis ?')) return;
        del(b.dataset.id);
      }));
    }
    async function setValid(id, v){
      try{ await fetch('/api/admin/reviews/'+id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({validated:v}) }); }catch(_){}
      load();
    }
    async function del(id){
      try{ await fetch('/api/admin/reviews/'+id,{ method:'DELETE' }); }catch(_){}
      load();
    }
    async function load(){
      try{
        const r = await fetch('/api/admin/reviews'); const j = await r.json();
        AVIS = j.reviews || []; render();
      }catch(e){ list.innerHTML = '<div style="color:#b1432f">Erreur de chargement.</div>'; }
    }
    document.querySelectorAll('[data-avisfilter]').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('[data-avisfilter]').forEach(o=>o.classList.remove('active'));
      b.classList.add('active');
      FILTER = b.dataset.avisfilter; render();
    }));
    document.querySelector('.tab[data-tab="avis"]')?.addEventListener('click', load);
  })();

  /* ============================================================
     NEWSLETTER — abonnes
     ============================================================ */
  (function(){
    const body = document.getElementById('nlBody');
    const count = document.getElementById('nlCount');
    if(!body) return;
    async function load(){
      try{
        const r = await fetch('/api/admin/newsletter'); const j = await r.json();
        const subs = j.subscribers || [];
        if(count) count.textContent = subs.length + ' abonné' + (subs.length>1?'s':'');
        if(!subs.length){ body.innerHTML = '<tr><td colspan="3" style="color:var(--gris);padding:24px 14px">Aucun abonné pour le moment.</td></tr>'; return; }
        body.innerHTML = subs.map(s =>
          '<tr><td>'+esc(s.email)+'</td><td style="font-size:13px">'+String(s.created_at||'').slice(0,10)+'</td>'+
          '<td><button class="of nl-del" data-id="'+s.id+'" style="font-size:11px;color:#b1432f;border-color:#e7cfc9">Désinscrire</button></td></tr>'
        ).join('');
        body.querySelectorAll('.nl-del').forEach(b=>b.addEventListener('click',async ()=>{
          if(!confirm('Désinscrire '+(b.closest('tr')?.firstChild?.textContent||'cet abonné')+' ?')) return;
          try{ await fetch('/api/admin/newsletter/'+b.dataset.id,{ method:'DELETE' }); }catch(_){}
          load();
        }));
      }catch(e){ body.innerHTML = '<tr><td colspan="3" style="color:#b1432f;padding:24px 14px">Erreur de chargement.</td></tr>'; }
    }
    document.querySelector('.tab[data-tab="newsletter"]')?.addEventListener('click', load);
  })();

  /* ============================================================
     ROLES — masque les onglets selon le compte connecte
     ============================================================ */
  const TABS_BY_ROLE = {
    admin:     null, // null = tous
    comptable: ['dash','orders','compta'],
    atelier:   ['dash','orders']
  };
  (async function(){
    try{
      const r = await fetch('/api/me'); if(!r.ok) throw new Error('me_failed');
      const me = await r.json();
      window.__role = me.role; window.__login = me.login;
      const allowed = TABS_BY_ROLE[me.role];
      if (allowed) {
        document.querySelectorAll('.tab').forEach(t=>{
          if (!allowed.includes(t.dataset.tab)) t.style.display = 'none';
        });
      }
      // Badge du compte connecte dans le header
      const tag = document.querySelector('.admin-top .tag');
      if (tag && me.role !== 'admin') tag.textContent = 'Espace Pro — ' + me.login + ' (' + me.role + ')';
      // Atelier : masquer les KPI financiers — refaisable apres chaque rendu (course init)
      window.__applyRoleMasks = function(){
        if (window.__role !== 'atelier') return;
        document.querySelectorAll('.kpi').forEach(k=>{
          const l = k.querySelector('.l');
          if (l && /chiffre|ca |panier/i.test(l.textContent)) k.style.display = 'none';
        });
      };
      window.__applyRoleMasks();
    }catch(_){
      // Impossible de connaitre le role : on applique le mode le plus restrictif
      window.__role = 'atelier';
      document.querySelectorAll('.tab').forEach(t=>{
        if(!['dash','orders'].includes(t.dataset.tab)) t.style.display='none';
      });
      window.__applyRoleMasks = function(){
        document.querySelectorAll('.kpi').forEach(k=>{
          const l=k.querySelector('.l');
          if(l && /chiffre|ca |panier/i.test(l.textContent)) k.style.display='none';
        });
      };
      window.__applyRoleMasks();
    }
  })();

  /* ============================================================
     EQUIPE — gestion des comptes (visible role admin uniquement)
     ============================================================ */
  (function(){
    const body = document.getElementById('usersBody');
    if(!body) return;
    const ROLE_LABELS = { admin:'Admin', comptable:'Comptable', atelier:'Atelier' };
    async function load(){
      try{
        const r = await fetch('/api/admin/users'); const j = await r.json();
        const users = j.users || [];
        if(!users.length){ body.innerHTML = '<tr><td colspan="5" style="color:var(--gris);padding:24px 14px">Aucun compte équipe. Le compte principal (mot de passe maître) reste toujours actif.</td></tr>'; return; }
        body.innerHTML = users.map(u =>
          '<tr>'+
          '<td style="font-family:var(--serif);font-size:15px">'+esc(u.login)+'</td>'+
          '<td><span class="badge '+(u.role==='admin'?'b-nouvelle':u.role==='comptable'?'b-prep':'b-exp')+'">'+ (ROLE_LABELS[u.role]||u.role) +'</span></td>'+
          '<td>'+(u.actif?'<span style="color:var(--vert)">● Actif</span>':'<span style="color:#b1432f">● Désactivé</span>')+'</td>'+
          '<td style="font-size:13px">'+String(u.created_at||'').slice(0,10)+'</td>'+
          '<td style="white-space:nowrap">'+
            '<button class="of u-toggle" data-id="'+u.id+'" data-actif="'+(u.actif?'1':'0')+'" style="font-size:11px">'+(u.actif?'Désactiver':'Réactiver')+'</button> '+
            '<button class="of u-pw" data-id="'+u.id+'" data-login="'+esc(u.login)+'" style="font-size:11px">Nouveau mdp</button> '+
            '<button class="of u-del" data-id="'+u.id+'" data-login="'+esc(u.login)+'" style="font-size:11px;color:#b1432f;border-color:#e7cfc9">Supprimer</button>'+
          '</td></tr>'
        ).join('');
        body.querySelectorAll('.u-toggle').forEach(b=>b.addEventListener('click',async ()=>{
          await fetch('/api/admin/users/'+b.dataset.id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ actif: b.dataset.actif!=='1' }) });
          load();
        }));
        body.querySelectorAll('.u-pw').forEach(b=>b.addEventListener('click',async ()=>{
          const np = prompt('Nouveau mot de passe pour "'+b.dataset.login+'" (8 caractères min.) :');
          if(!np) return;
          if(np.length<8){ alert('8 caractères minimum.'); return; }
          const r = await fetch('/api/admin/users/'+b.dataset.id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ password: np }) });
          alert(r.ok ? 'Mot de passe mis à jour. Transmets-le de façon sécurisée.' : 'Erreur.');
        }));
        body.querySelectorAll('.u-del').forEach(b=>b.addEventListener('click',async ()=>{
          if(!confirm('Supprimer définitivement le compte "'+b.dataset.login+'" ?')) return;
          await fetch('/api/admin/users/'+b.dataset.id,{ method:'DELETE' });
          load();
        }));
      }catch(e){ body.innerHTML = '<tr><td colspan="5" style="color:#b1432f;padding:24px 14px">Erreur de chargement.</td></tr>'; }
    }
    const btn = document.getElementById('nuCreate');
    if(btn) btn.addEventListener('click', async ()=>{
      const msg = document.getElementById('nuMsg');
      const login = (document.getElementById('nuLogin').value||'').trim().toLowerCase();
      const password = document.getElementById('nuPass').value||'';
      const role = document.getElementById('nuRole').value;
      msg.style.color = 'var(--gris)'; msg.textContent = 'Création…';
      const r = await fetch('/api/admin/users',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ login, password, role }) });
      const j = await r.json().catch(()=>({}));
      if (r.ok && j.ok) {
        msg.style.color = 'var(--vert)'; msg.textContent = 'Compte "'+login+'" créé ✓ — transmets l\'identifiant et le mot de passe de façon sécurisée.';
        document.getElementById('nuLogin').value=''; document.getElementById('nuPass').value='';
        load();
      } else {
        msg.style.color = '#b1432f'; msg.textContent = j.detail || j.error || 'Erreur.';
      }
    });
    document.querySelector('.tab[data-tab="equipe"]')?.addEventListener('click', load);
  })();

  /* Deconnexion */
  const lo=document.getElementById('logout');
  if(lo) lo.addEventListener('click',async e=>{ e.preventDefault(); try{await fetch('/api/logout',{method:'POST'});}catch(_){} location.href='/admin'; });

  /* Init */
  (async function(){
    const s=await get('/api/stats',MOCK.stats);
    const o=await get('/api/orders',MOCK.orders);
    const p=await get('/api/products',MOCK.products);
    // Chaque rendu est isole : si l'un plante (ex: champs financiers absents pour
    // le role atelier), les autres s'affichent quand meme.
    try{ renderKPIs(s); }catch(e){ console.warn('KPIs:',e); }
    try{ renderChart(Array.isArray(s.ca_mois)?s.ca_mois:[]); }catch(e){ console.warn('Chart:',e); }
    try{ renderOrders(o); }catch(e){ console.warn('Orders:',e); }
    try{ renderStock(p); }catch(e){ console.warn('Stock:',e); }
    if (window.__applyRoleMasks) window.__applyRoleMasks();
    showDataBanner();
  })();

  /* ---- Controle des paiements (reconciliation Stripe a la demande) ---- */
  (function(){
    var b = document.getElementById('btnRecon');
    if (!b) return;
    var out = document.getElementById('reconOut');
    function boite(couleur, fond, titre, corps){
      return '<div style="padding:14px 16px;border-left:3px solid '+couleur+';background:'+fond+';font-size:13.5px;line-height:1.7;color:#3d3a35">'
           + '<b>'+titre+'</b>' + (corps ? '<div style="margin-top:8px">'+corps+'</div>' : '') + '</div>';
    }
    b.addEventListener('click', async function(){
      var libelle = b.textContent;
      b.disabled = true; b.textContent = 'Vérification en cours…';
      out.innerHTML = '';
      try{
        var r = await fetch('/api/admin/reconcilier', { method:'POST' });
        var d = await r.json().catch(function(){ return {}; });
        if (!r.ok || !d.ok){
          out.innerHTML = boite('#b1432f','#fbeae6','Vérification impossible',
            esc(d.detail || d.error || ('Erreur ' + r.status)));
        } else if ((d.rattrapees||0) === 0 && !(d.anomalies||[]).length){
          out.innerHTML = boite('#2f7d4f','#eaf6ee','Tout est en ordre',
            (d.verifiees||0) + ' paiement(s) vérifié(s) sur les dernières 24 h. Chaque encaissement a bien sa commande.');
        } else {
          var c = '';
          if (d.rattrapees) c += '<p style="margin:0 0 8px"><b>'+d.rattrapees+' commande(s) rattrapée(s)</b> — un paiement confirmé chez Stripe n\'avait pas été enregistré. C\'est corrigé : vérifiez que le client a bien reçu sa confirmation.</p>';
          if ((d.anomalies||[]).length) c += '<ul style="margin:8px 0 0;padding-left:18px">' + d.anomalies.map(function(a){ return '<li style="margin-bottom:4px">'+esc(a)+'</li>'; }).join('') + '</ul>';
          out.innerHTML = boite('#a8791f','#fdf6e8', (d.rattrapees ? 'Action effectuée' : 'Points à vérifier'), c);
          if (d.rattrapees) setTimeout(function(){ location.reload(); }, 2500);   // reafficher les commandes rattrapees
        }
      }catch(e){
        out.innerHTML = boite('#b1432f','#fbeae6','Connexion impossible', esc(e.message||''));
      }
      b.disabled = false; b.textContent = libelle;
    });
  })();

})();
