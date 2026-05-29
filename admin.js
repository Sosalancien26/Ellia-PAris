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
  let ORDERS=[], FILTER='', SEARCH='';
  function ocard(o){
    return '<div class="ord-row" data-id="'+o.id+'">'+
      '<div class="orow-l"><div class="orow-top"><span class="oid">'+o.id+'</span><span class="badge '+badgeClass(o.statut)+'" data-badge="'+o.id+'">'+o.statut+'</span></div>'+
        '<div class="orow-sub">'+o.date+' · '+(o.client||'')+'</div></div>'+
      '<div class="orow-r"><span class="orow-total">'+eur(o.total)+'</span><span class="orow-go">Voir le détail ›</span></div>'+
    '</div>';
  }
  function applyFilter(){
    let list = FILTER ? ORDERS.filter(o=>norm(o.statut).includes(FILTER)) : ORDERS.slice();
    if(SEARCH){
      const q=SEARCH.toLowerCase();
      list = list.filter(o => (o.id||'').toLowerCase().includes(q) || (o.client||'').toLowerCase().includes(q) || (o.email||'').toLowerCase().includes(q));
    }
    const box=document.getElementById('ordersBody');
    box.innerHTML = list.length ? list.map(ocard).join('') : '<div class="ord-empty">Aucune commande dans cette vue.</div>';
    box.querySelectorAll('.ord-row').forEach(r=>r.addEventListener('click',()=>openOrder(r.dataset.id)));
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
  function renderOrders(list){ ORDERS=list; updateCounts(); applyFilter(); }
  (function(){
    document.querySelectorAll('#ordFilters .of').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('#ordFilters .of').forEach(o=>o.classList.remove('active'));
      b.classList.add('active'); FILTER=b.dataset.f||''; applyFilter();
    }));
    const s=document.getElementById('ordSearch'); if(s) s.addEventListener('input',()=>{ SEARCH=s.value||''; applyFilter(); });
    const x=document.getElementById('ordExport'); if(x) x.addEventListener('click', exportCsv);
  })();
  function omRow(k,v){ return v ? ('<div class="om-row"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>') : ''; }
  function esc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function renderViewMode(o){
    const sOpts=STATUTS.map(s=>'<option'+(norm(s)===norm(o.statut)?' selected':'')+'>'+s+'</option>').join('');
    const tOpts=TRANSPORTEURS.map(t=>'<option value="'+t+'"'+((o.transporteur||'')===t?' selected':'')+'>'+(t||'— Transporteur —')+'</option>').join('');
    const manualTag = o.manual ? '<span style="display:inline-block;background:#0d0d0d;color:#fff;font-size:9.5px;letter-spacing:.16em;padding:3px 8px;text-transform:uppercase;margin-left:10px;vertical-align:middle">Manuelle</span>' : '';
    const invoiceRow = o.invoice_number
      ? '<div class="om-row"><span class="k">Facture</span><span class="v"><b>'+o.invoice_number+'</b> &nbsp; <a href="/api/admin/orders/'+encodeURIComponent(o.id)+'/invoice" target="_blank" style="color:#0d0d0d;font-weight:500;text-decoration:underline;font-size:12.5px">Ouvrir PDF</a></span></div>'
      : '<div class="om-row"><span class="k">Facture</span><span class="v"><a href="/api/admin/orders/'+encodeURIComponent(o.id)+'/invoice" target="_blank" style="color:#0d0d0d;font-weight:500;text-decoration:underline;font-size:12.5px">Générer / Télécharger PDF</a></span></div>';
    const payRow = (o.payment_method || o.payment_status) ? ('<div class="om-row"><span class="k">Paiement</span><span class="v">'+(o.payment_method||'—')+' &middot; '+(o.payment_status||'—')+'</span></div>') : '';
    document.getElementById('ordModalBox').innerHTML=
      '<button class="om-close" id="omClose">×</button>'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">'+
        '<div><h3 style="margin:0">Commande '+o.id+manualTag+'</h3><div style="color:var(--gris);font-size:13px;margin-top:4px">'+o.date+'</div></div>'+
        '<button id="omEdit" style="font-family:var(--sans);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;padding:9px 16px;border:1px solid var(--ligne);background:#fff;cursor:pointer;color:var(--noir)">Modifier</button>'+
      '</div>'+
      '<div style="height:14px"></div>'+
      omRow('Client',o.client)+omRow('E-mail',o.email)+omRow('Téléphone',o.telephone)+
      omRow('Adresse de livraison',o.adresse)+omRow('Adresse de facturation',o.adresseFact||o.adresse)+
      omRow('Personnalisation',gravure(o))+omRow('Total','<b>'+eur(o.total)+'</b>')+
      payRow+invoiceRow+
      '<div style="margin:20px 0 8px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gris2)">Gestion de la commande</div>'+
      '<div class="om-actions">'+
        '<select class="om-statut">'+sOpts+'</select>'+
        '<select class="om-transp">'+tOpts+'</select>'+
        '<input class="om-suivi" placeholder="N° de suivi" value="'+esc(o.suivi||'')+'">'+
        '<button class="ord-save" id="omSave">Enregistrer</button>'+
        '<span class="ord-saved" id="omSaved" style="display:none">✓ Enregistré</span>'+
      '</div>';
    document.getElementById('omClose').addEventListener('click',closeOrder);
    document.getElementById('omEdit').addEventListener('click',()=>openEditMode(o.id));
    document.getElementById('omSave').addEventListener('click',()=>{
      const statut=document.querySelector('.om-statut').value;
      const transporteur=document.querySelector('.om-transp').value;
      const suivi=document.querySelector('.om-suivi').value.trim();
      o.statut=statut; o.transporteur=transporteur; o.suivi=suivi;
      const b=document.querySelector('[data-badge="'+o.id+'"]'); if(b){ b.textContent=statut; b.className='badge '+badgeClass(statut); }
      fetch('/api/orders/'+encodeURIComponent(o.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({statut:statut,transporteur:transporteur,suivi:suivi})}).catch(()=>{});
      const sv=document.getElementById('omSaved'); sv.style.display='inline'; setTimeout(()=>{sv.style.display='none';},2000);
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
    const o = full || ORDERS.find(x=>x.id===id) || {};
    const FINITIONS = ['','Or','Argent','Or rose','Noir'];
    const EMPLACEMENTS = ['','Plaque chromée','Sous-rabat','Intérieur'];
    const MODES = ['','Virement bancaire','Chèque','Espèces','Carte bancaire (en main)','PayPal','Autre'];
    const STATUTS_PAY = ['En attente','Payé','Partiel','Annulé'];
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

  /* Tabs */
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(o=>o.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(o=>o.classList.remove('active'));
    t.classList.add('active');
    document.getElementById(t.dataset.tab).classList.add('active');
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
      const ttc = (pP + pX) * q + pT;
      const ht  = ttc / (1 + tva/100);
      const t   = ttc - ht;
      totTTC.textContent = fmt(ttc);
      totHT.textContent  = fmt(ht) + ' HT';
      totTVA.textContent = '+ ' + fmt(t) + ' TVA';
    }

    // Auto-fill 59€ perso si initiales remplies
    $('[name="initiales"]').addEventListener('input', e=>{
      const v = e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);
      e.target.value = v;
      const inp = $('[name="prix_personnalisation"]');
      if (v.length>0 && Number(inp.value)===0) inp.value = 59;
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
t('/api/stats',MOCK.stats);
    const o=await get('/api/orders',MOCK.orders);
    const p=await get('/api/products',MOCK.products);
    renderKPIs(s);renderChart(s.ca_mois);renderOrders(o);renderStock(p);
  })();
})();
tton type="submit" id="omEditSave" style="font-family:var(--sans);font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:11px 22px;border:none;background:var(--noir);color:#fff;cursor:pointer">Enregistrer</button>'+
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
          try{ const list = await get('/api/orders',[]); renderOrders(list); }catch(_){}
          setTimeout(()=>{
            const updated = ORDERS.find(x=>x.id===id);
            if(updated) renderViewMode(updated);
          }, 600);
        } else {
          msgEl.style.color='#b1432f'; msgEl.textContent="Erreur d'enregistrement";
        }
      }catch(_){ msgEl.style.color='#b1432f'; msgEl.textContent='Connexion impossible'; }
      btnEl.disabled=false; btnEl.textContent='Enregistrer';
    });
  }
l.disabled=false; btnEl.textContent='Enregistrer';
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
      const ttc = (pP + pX) * q + pT;
      const ht  = ttc / (1 + tva/100);
      const t   = ttc - ht;
      totTTC.textContent = fmt(ttc);
      totHT.textContent  = fmt(ht) + ' HT';
      totTVA.textContent = '+ ' + fmt(t) + ' TVA';
    }

    $('[name="initiales"]').addEventListener('input', e=>{
      const v = e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);
      e.target.value = v;
      const inp = $('[name="prix_personnalisation"]');
      if (v.length>0 && Number(inp.value)===0) inp.value = 59;
      if (v.length===0 && Number(inp.value)===59) inp.value = 0;
      recalc();
    });

    ['quantite','prix_pochette','prix_personnalisation','frais_port','tva_rate'].forEach(n=>{
      const el = $('[name="'+n+'"]'); if(el) el.addEventListener('input', recalc);
    });

    sameAddr.addEventListener('change', ()=>{
      factBlock.style.display = sameAddr.checked ? 'none' : 'block';
    });

    document.getElementById('ncReset').addEventListener('click', ()=>{
      f.reset(); $('[name="pays_livraison"]').value='France'; $('[name="pays_facturation"]').value='France';
      $('[name="prix_pochette"]').value=159; $('[name="prix_personnalisation"]').value=0;
      $('[name="quantite"]').value=1; $('[name="tva_rate"]').value=20; $('[name="frais_port"]').value=0;
      $('[name="payment_status"]').value='Payé'; $('[name="statut"]').value='Nouvelle';
      sameAddr.checked=true; factBlock.style.display='none';
      msg.className='nc-msg'; msg.textContent=''; recalc();
    });

    f.addEventListener('submit', async function(e){
      e.preventDefault();
      msg.className='nc-msg'; msg.textContent='';
      const data = {};
      new FormData(f).forEach((v,k)=>{ data[k] = (typeof v==='string' ? v.trim() : v); });
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
(async function(){
    const s=await get('/api/stats',MOCK.stats);
    const o=await get('/api/orders',MOCK.orders);
    const p=await get('/api/products',MOCK.products);
    renderKPIs(s);renderChart(s.ca_mois);renderOrders(o);renderStock(p);
  })();
})();
