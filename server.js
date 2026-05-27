/* ============================================================
   ELLIA PARIS — Serveur Node.js (sans dependance)
   Sert le site + API + admin protege par mot de passe.
   Branche Supabase si les variables d'env sont presentes.

   Lancer :  npm start          Boutique : http://localhost:3000/
   Admin  :  http://localhost:3000/admin   (mot de passe requis)

   Variables d'environnement :
     SUPABASE_URL          = https://wwzaqbpyojpzjacbjyqi.supabase.co
     SUPABASE_SERVICE_KEY  = (cle service_role SECRETE — vraies donnees)
     ADMIN_PASSWORD        = (mot de passe de l'espace admin ; defaut : ellia2026)
   Ne JAMAIS exposer la cle service_role cote navigateur.
   ============================================================ */
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wwzaqbpyojpzjacbjyqi.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || '';
const USE_DB = !!SERVICE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ellia2026';
const SECRET = process.env.ADMIN_SECRET || ('ellia$' + ADMIN_PASSWORD);
const TOKEN = crypto.createHmac('sha256', SECRET).update('ellia-admin-v1').digest('hex');

/* ----- E-mails (SMTP Workspace via nodemailer, optionnel) ----- */
let transporter = null;
try {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
} catch (e) { console.warn('Nodemailer indisponible :', e.message); }
const MAIL_FROM = process.env.MAIL_FROM || ('ELLIA PARIS <' + (process.env.SMTP_USER || 'no-reply@ellia-paris.fr') + '>');
function euro(n){ return Number(n||0).toLocaleString('fr-FR') + ' €'; }
const LOGO = 'https://ellia-paris.fr/assets/logo_black_trim.png';
function emailLayout(inner){
  return `<div style="margin:0;padding:30px 12px;background:#f3f1ec">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e3dc">
    <div style="text-align:center;padding:30px 0 20px;border-bottom:1px solid #efece6">
      <img src="${LOGO}" alt="ELLIA PARIS" style="height:44px;width:auto" />
    </div>
    <div style="padding:34px 40px;font-family:Georgia,'Times New Roman',serif;color:#0d0d0d;font-size:16px;line-height:1.6">${inner}</div>
    <div style="padding:22px 40px;border-top:1px solid #efece6;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.06em;color:#8a857d">
      ELLIA PARIS — Maison de maroquinerie · Paris<br/>
      <a href="https://ellia-paris.fr" style="color:#8a857d;text-decoration:none">ellia-paris.fr</a>
    </div>
  </div>
</div>`;
}
function lineItems(items){
  if(!items || !items.length) return '';
  const rows = items.map(it=>`<tr>
    <td style="padding:12px 0;border-bottom:1px solid #efece6">${it.nom||'La Pochette Ellia'}${it.initiales?`<br/><span style="font-family:Arial,sans-serif;font-size:12px;color:#8a857d">Gravure ${it.initiales} · ${it.finition||''} · ${it.emplacement||''}</span>`:''}</td>
    <td style="padding:12px 0;border-bottom:1px solid #efece6;text-align:right;white-space:nowrap">${euro(it.prix)}</td></tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;margin:18px 0">${rows}</table>`;
}
function addressBlock(d){
  if(!d.adresse_livraison) return '';
  return `<p style="font-family:Arial,sans-serif;font-size:13px;color:#56524c;line-height:1.6;margin:16px 0 0">
    <b style="font-family:Georgia,serif;color:#0d0d0d;font-size:15px">Adresse de livraison</b><br/>
    ${d.client_nom||''}<br/>${d.adresse_livraison}<br/>${(d.cp_livraison||'')} ${(d.ville_livraison||'')}<br/>${d.pays_livraison||'France'}${d.telephone?('<br/>'+d.telephone):''}</p>`;
}
function sendMail(to, subject, html){
  if (!transporter || !to) return;
  transporter.sendMail({ from: MAIL_FROM, to, subject, html }).catch(e=>console.warn('Mail KO :', e.message));
}
function notifyNewOrder(d, numero){
  const inner = `<h1 style="font-weight:normal;font-size:27px;margin:0 0 12px;letter-spacing:.01em">Merci pour votre commande</h1>
    <p style="margin:0 0 8px">Bonjour ${d.client_nom||''},</p>
    <p style="margin:0 0 4px">Votre commande <b>${numero}</b> a bien été enregistrée. En voici le détail :</p>
    ${lineItems(d.items)}
    <table style="width:100%;font-family:Arial,sans-serif;font-size:15px"><tr>
      <td><b style="font-family:Georgia,serif;font-size:17px">Total</b></td>
      <td style="text-align:right"><b style="font-family:Georgia,serif;font-size:17px">${euro(d.montant_total)}</b></td></tr></table>
    ${addressBlock(d)}
    <p style="margin:24px 0 0;font-size:14px;color:#56524c;font-family:Arial,sans-serif">Le paiement et l'expédition vous seront confirmés par e-mail. Avec soin,<br/>ELLIA PARIS</p>`;
  sendMail(d.client_email, 'Votre commande ELLIA PARIS — '+numero, emailLayout(inner));
  if (process.env.SMTP_USER) sendMail(process.env.SMTP_USER, 'Nouvelle commande '+numero,
    emailLayout(`<h2 style="font-weight:normal;font-size:22px;margin:0 0 8px">Nouvelle commande ${numero}</h2><p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:14px">${d.client_nom||''} — ${d.client_email||''}${d.telephone?(' — '+d.telephone):''}</p>${lineItems(d.items)}<p style="font-family:Georgia,serif"><b>Total ${euro(d.montant_total)}</b></p>${addressBlock(d)}`));
}
const STATUT_MSG = {
  'nouvelle':'a bien été reçue et est en cours de traitement.',
  'en preparation':'est en cours de préparation dans nos ateliers.',
  'expediee':'a été expédiée — elle est en route vers vous.',
  'livree':'a été livrée. Nous espérons qu\'elle vous comble.',
  'annulee':'a été annulée. Pour toute question, répondez à cet e-mail.'
};
function trackUrl(transporteur, suivi){
  if(!suivi) return '';
  const t=(transporteur||'').toLowerCase(); const n=encodeURIComponent(suivi);
  if(t.includes('colissimo')||t.includes('poste')) return 'https://www.laposte.fr/outils/suivre-vos-envois?code='+n;
  if(t.includes('chrono')) return 'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT='+n;
  if(t.includes('ups')) return 'https://www.ups.com/track?tracknum='+n;
  if(t.includes('dhl')) return 'https://www.dhl.com/fr-fr/home/tracking.html?tracking-id='+n;
  if(t.includes('mondial')) return 'https://www.mondialrelay.fr/suivi-de-colis/?NumeroExpedition='+n;
  return '';
}
function notifyStatus(order, numero, statut){
  const key = (statut||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const msg = STATUT_MSG[key] || ('est désormais : '+statut+'.');
  const recap = (order.montant_total!=null) ? `<p style="font-family:Arial,sans-serif;font-size:13px;color:#8a857d;margin-top:16px">Montant : ${euro(order.montant_total)}${order.initiales?(' · Gravure '+order.initiales):''}</p>` : '';
  const url = trackUrl(order.transporteur, order.suivi);
  const track = order.suivi ? `<p style="font-family:Arial,sans-serif;font-size:14px;margin-top:14px">Suivi ${order.transporteur||''} : <b>${order.suivi}</b>${url?` &nbsp;—&nbsp; <a href="${url}" style="color:#0d0d0d;font-weight:bold">Suivre mon colis →</a>`:''}</p>` : '';
  const inner = `<h1 style="font-weight:normal;font-size:27px;margin:0 0 12px">Votre commande ${numero}</h1>
    <p style="margin:0 0 8px">Bonjour ${order.client_nom||''},</p>
    <p style="margin:0 0 4px">Votre commande <b>${numero}</b> ${msg}</p>
    <p style="margin:16px 0 0"><span style="display:inline-block;background:#0d0d0d;color:#ffffff;font-family:Arial,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;padding:9px 18px">${statut}</span></p>
    ${track}
    ${recap}
    <p style="margin:24px 0 0;font-size:14px;color:#56524c;font-family:Arial,sans-serif">Avec soin,<br/>ELLIA PARIS</p>`;
  sendMail(order.client_email, 'Commande '+numero+' — '+statut, emailLayout(inner));
}

const TYPES = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.svg':'image/svg+xml', '.webp':'image/webp', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.md':'text/plain; charset=utf-8'
};

/* ----- Donnees de demonstration (si Supabase non configure) ----- */
const MOCK_PRODUCTS = [
  { ref:'ELLIA-NOIR', nom:'La Pochette Ellia — Noir', prix:159, stock:24, seuil:8 },
  { ref:'ELLIA-PERSO', nom:'Gravure initiales (option)', prix:59, stock:999, seuil:0 }
];
const MOCK_ORDERS = [
  { id:'EP-1042', date:'2026-05-26', client:'Camille D.', initiales:'C·D', finition:'Or', total:218, statut:'Nouvelle' },
  { id:'EP-1041', date:'2026-05-26', client:'Hugo M.', initiales:'H·M', finition:'Argent', total:218, statut:'En préparation' },
  { id:'EP-1040', date:'2026-05-25', client:'Sofia L.', initiales:'—', finition:'—', total:159, statut:'Expédiée' },
  { id:'EP-1039', date:'2026-05-24', client:'Adrien P.', initiales:'A·P·G', finition:'Or rose', total:218, statut:'Livrée' },
  { id:'EP-1038', date:'2026-05-23', client:'Léa R.', initiales:'L·R', finition:'Noir', total:218, statut:'Livrée' }
];
const MOCK_STATS = {
  ca_total:12460, commandes:57, panier_moyen:218, taux_perso:78,
  ca_mois:[{mois:'Déc',ca:1180},{mois:'Jan',ca:1620},{mois:'Fév',ca:1840},{mois:'Mars',ca:2150},{mois:'Avr',ca:2480},{mois:'Mai',ca:3190}]
};
const MOIS = ['Jan','Fév','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'];

/* ----- Supabase REST ----- */
async function sb(pathQuery, opts={}){
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + pathQuery, {
    headers: { apikey:SERVICE_KEY, Authorization:'Bearer '+SERVICE_KEY,
               'Content-Type':'application/json', Prefer: opts.prefer || '' },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if(!res.ok) throw new Error('Supabase '+res.status+' '+await res.text());
  return res.status===204 ? null : res.json();
}
async function getProducts(){
  if(!USE_DB) return MOCK_PRODUCTS;
  const rows = await sb('products?select=ref,nom,prix,stock,seuil&order=prix.desc');
  return rows.map(r=>({ ref:r.ref, nom:r.nom, prix:Number(r.prix), stock:r.stock, seuil:r.seuil }));
}
async function getOrders(){
  if(!USE_DB) return MOCK_ORDERS;
  const rows = await sb('orders?select=numero,client_nom,client_email,telephone,initiales,finition,emplacement,montant_total,statut,suivi,transporteur,adresse_livraison,cp_livraison,ville_livraison,pays_livraison,adresse_facturation,cp_facturation,ville_facturation,pays_facturation,created_at&order=created_at.desc');
  const j=(a,cp,v,p)=>[a,((cp||'')+' '+(v||'')).trim(),p].filter(x=>x&&String(x).trim()).join(' · ');
  return rows.map(r=>({ id:r.numero, date:(r.created_at||'').slice(0,10), client:r.client_nom||'—', email:r.client_email||'', telephone:r.telephone||'',
    initiales:r.initiales||'—', finition:r.finition||'—', emplacement:r.emplacement||'', total:Number(r.montant_total), statut:r.statut,
    suivi:r.suivi||'', transporteur:r.transporteur||'',
    adresse:j(r.adresse_livraison,r.cp_livraison,r.ville_livraison,r.pays_livraison),
    adresseFact:j(r.adresse_facturation,r.cp_facturation,r.ville_facturation,r.pays_facturation) }));
}
async function getStats(){
  if(!USE_DB) return MOCK_STATS;
  const orders = await getOrders();
  const ca_total = orders.reduce((s,o)=>s+o.total,0);
  const commandes = orders.length;
  const panier_moyen = commandes ? Math.round(ca_total/commandes) : 0;
  const perso = orders.filter(o=>o.initiales && o.initiales!=='—').length;
  const taux_perso = commandes ? Math.round(perso/commandes*100) : 0;
  const byMonth = {};
  orders.forEach(o=>{ const d=new Date(o.date); if(!isNaN(d)){ const k=d.getFullYear()+'-'+('0'+d.getMonth()).slice(-2); byMonth[k]=(byMonth[k]||0)+o.total; }});
  const ca_mois = Object.keys(byMonth).sort().slice(-6).map(k=>({ mois:MOIS[parseInt(k.split('-')[1],10)], ca:byMonth[k] }));
  return { ca_total, commandes, panier_moyen, taux_perso, ca_mois: ca_mois.length?ca_mois:[] };
}

/* ----- Helpers ----- */
function sendJSON(res, obj, code=200){ res.statusCode=code; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(obj)); }
function readBody(req){ return new Promise(r=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>r(b)); }); }
function cookies(req){ const o={}; (req.headers.cookie||'').split(';').forEach(c=>{ const i=c.indexOf('='); if(i>0)o[c.slice(0,i).trim()]=c.slice(i+1).trim(); }); return o; }
function isAuthed(req){ return cookies(req)['ellia_session'] === TOKEN; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);

  /* ---------- API ---------- */
  if (pathname.startsWith('/api/')) {
    try{
      /* Auth */
      if (req.method==='POST' && pathname==='/api/login'){
        const d = JSON.parse((await readBody(req))||'{}');
        if (d.password === ADMIN_PASSWORD){
          res.setHeader('Set-Cookie','ellia_session='+TOKEN+'; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400');
          return sendJSON(res,{ ok:true });
        }
        return sendJSON(res,{ ok:false, error:'Mot de passe incorrect' },401);
      }
      if (req.method==='POST' && pathname==='/api/logout'){
        res.setHeader('Set-Cookie','ellia_session=; HttpOnly; Path=/; Max-Age=0');
        return sendJSON(res,{ ok:true });
      }

      /* Public : catalogue + creation de commande (checkout) */
      if (req.method==='GET' && pathname==='/api/products') return sendJSON(res, await getProducts());
      if (req.method==='POST' && pathname==='/api/orders'){
        const d = JSON.parse((await readBody(req))||'{}');
        const numero = 'EP-'+Date.now().toString().slice(-6);
        notifyNewOrder(d, numero);
        if(!USE_DB) return sendJSON(res,{ ok:true, numero, demo:true });
        const row = { numero, client_nom:d.client_nom, client_email:d.client_email, telephone:d.telephone,
          initiales:d.initiales, finition:d.finition, emplacement:d.emplacement,
          adresse_livraison:d.adresse_livraison, cp_livraison:d.cp_livraison, ville_livraison:d.ville_livraison, pays_livraison:d.pays_livraison||'France',
          adresse_facturation:d.adresse_facturation, cp_facturation:d.cp_facturation, ville_facturation:d.ville_facturation, pays_facturation:d.pays_facturation||'France',
          user_id:d.user_id||null, montant_total:d.montant_total||0, statut:'Nouvelle' };
        const created = await sb('orders',{ method:'POST', body:row, prefer:'return=representation' });
        return sendJSON(res,{ ok:true, numero, order:created&&created[0] });
      }

      /* Prive : tout le reste exige l'authentification admin */
      if (!isAuthed(req)) return sendJSON(res,{ error:'non autorise' },401);

      if (req.method==='GET' && pathname==='/api/stats')  return sendJSON(res, await getStats());
      if (req.method==='GET' && pathname==='/api/orders') return sendJSON(res, await getOrders());

      /* MAJ statut d'une commande : PATCH /api/orders/EP-xxxx */
      if (req.method==='PATCH' && pathname.startsWith('/api/orders/')){
        const numero = pathname.split('/').pop();
        const d = JSON.parse((await readBody(req))||'{}');
        if(!USE_DB) return sendJSON(res,{ ok:true, demo:true });
        const upd = {};
        if(d.statut!==undefined) upd.statut = d.statut;
        if(d.suivi!==undefined) upd.suivi = d.suivi;
        if(d.transporteur!==undefined) upd.transporteur = d.transporteur;
        if(Object.keys(upd).length) await sb('orders?numero=eq.'+encodeURIComponent(numero),{ method:'PATCH', body:upd });
        if(d.statut!==undefined){
          try{ const rows=await sb('orders?numero=eq.'+encodeURIComponent(numero)+'&select=client_email,client_nom,montant_total,initiales,suivi,transporteur'); if(rows&&rows[0]) notifyStatus(rows[0], numero, d.statut); }catch(_){}
        }
        return sendJSON(res,{ ok:true });
      }
      /* MAJ stock d'un produit : PATCH /api/products/REF */
      if (req.method==='PATCH' && pathname.startsWith('/api/products/')){
        const ref = pathname.split('/').pop();
        const d = JSON.parse((await readBody(req))||'{}');
        if(!USE_DB) return sendJSON(res,{ ok:true, demo:true });
        await sb('products?ref=eq.'+encodeURIComponent(ref),{ method:'PATCH', body:{ stock:Number(d.stock) } });
        return sendJSON(res,{ ok:true });
      }
      return sendJSON(res,{ error:'route inconnue' },404);
    }catch(e){ return sendJSON(res,{ error:String(e.message||e) },500); }
  }

  /* ---------- Admin (protege) ---------- */
  if (pathname==='/admin' || pathname==='/admin/'){
    pathname = isAuthed(req) ? '/admin.html' : '/admin-login.html';
  }

  /* ---------- Fichiers statiques ---------- */
  if (pathname === '/') pathname = '/index.html';
  const safe = path.normalize(pathname).replace(/^(\.\.[\/\\])+/,'');
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT)) { res.statusCode=403; return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode=404; res.setHeader('Content-Type','text/html; charset=utf-8'); return res.end('<h1 style="font-family:serif">404 — page introuvable</h1>'); }
    const ext = path.extname(file).toLowerCase();
    // Anti-cache : HTML/CSS/JS toujours frais ; images/polices mises en cache 1 jour
    if (['.html','.css','.js','.json'].includes(ext)) res.setHeader('Cache-Control','no-cache, no-store, must-revalidate');
    else res.setHeader('Cache-Control','public, max-age=86400');
    res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log('ELLIA PARIS — http://localhost:' + PORT + (USE_DB ? '  [Supabase: ACTIF]' : '  [donnees DEMO]'));
  console.log('Admin : http://localhost:' + PORT + '/admin   (mot de passe : ' + (process.env.ADMIN_PASSWORD ? '****' : 'ellia2026 — a changer') + ')');
});
