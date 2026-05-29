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
     ADMIN_SECRET          = (secret HMAC pour le cookie de session)
     SMTP_USER / SMTP_PASS = (e-mails transactionnels)
   Ne JAMAIS exposer la cle service_role cote navigateur.
   ============================================================ */
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
let invoiceMod = null;
try { invoiceMod = require('./invoice'); }
catch(e){ console.warn('Module invoice.js indisponible :', e.message); }
let comptaMod = null;
try { comptaMod = require('./compta'); }
catch(e){ console.warn('Module compta.js indisponible :', e.message); }
let promoMod = null;
try { promoMod = require('./promo'); }
catch(e){ console.warn('Module promo.js indisponible :', e.message); }
let totpMod = null;
try { totpMod = require('./totp'); }
catch(e){ console.warn('Module totp.js indisponible :', e.message); }

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wwzaqbpyojpzjacbjyqi.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || '';
const USE_DB = !!SERVICE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ellia2026';
const SECRET = process.env.ADMIN_SECRET || ('ellia$' + ADMIN_PASSWORD);
const TOKEN = crypto.createHmac('sha256', SECRET).update('ellia-admin-v1').digest('hex');

/* Rate-limit generique en memoire (par IP, par bucket) */
const RATE = { login: new Map(), newsletter: new Map(), orders: new Map(), contact: new Map(), reviews: new Map() };
const RATE_LIMITS = {
  login:      { max: 5,  window: 5*60*1000 },
  newsletter: { max: 5,  window: 60*60*1000 },
  orders:     { max: 10, window: 60*60*1000 },
  contact:    { max: 3,  window: 60*60*1000 },
  reviews:    { max: 5,  window: 24*60*60*1000 }
};
function rateAllowed(bucket, ip){
  const cfg = RATE_LIMITS[bucket]; if(!cfg) return true;
  const now = Date.now();
  const arr = (RATE[bucket].get(ip)||[]).filter(t => now - t < cfg.window);
  arr.push(now); RATE[bucket].set(ip, arr);
  return arr.length <= cfg.max;
}
function clientIp(req){ return (req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.socket.remoteAddress || 'unknown'; }

function isHttps(req){
  if((req.headers['x-forwarded-proto']||'').toLowerCase()==='https') return true;
  if(req.connection && req.connection.encrypted) return true;
  return false;
}

function setSecurityHeaders(req, res){
  if(isHttps(req)) res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' https: data: blob:",
    "media-src 'self' https:",
    "connect-src 'self' https://wwzaqbpyojpzjacbjyqi.supabase.co wss://wwzaqbpyojpzjacbjyqi.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join('; '));
}

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
  return '<div style="margin:0;padding:40px 12px;background:#f3f1ec">' +
  '<div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">' +
    '<div style="text-align:center;padding:36px 0 14px">' +
      '<img src="' + LOGO + '" alt="ELLIA PARIS" style="height:46px;width:auto" />' +
      '<div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>' +
    '</div>' +
    '<div style="height:1px;background:#efece6;margin:0 40px"></div>' +
    '<div style="padding:36px 44px 40px;font-family:Georgia,\'Times New Roman\',serif;color:#0d0d0d;font-size:16px;line-height:1.65">' + inner + '</div>' +
    '<div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">' +
      '<div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>' +
      '<div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a> · <a href="https://ellia-paris.fr/entretien.html" style="color:#bdb8af;text-decoration:none">Entretien</a></div>' +
      '<div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>' +
    '</div>' +
  '</div></div>';
}
function lineItems(items){
  if(!items || !items.length) return '';
  const rows = items.map(it => '<tr>' +
    '<td style="padding:12px 0;border-bottom:1px solid #efece6">' + (it.nom||'La Pochette Ellia') +
    (it.initiales ? '<br/><span style="font-family:Arial,sans-serif;font-size:12px;color:#8a857d">Gravure ' + it.initiales + ' · ' + (it.finition||'') + ' · ' + (it.emplacement||'') + '</span>' : '') +
    '</td>' +
    '<td style="padding:12px 0;border-bottom:1px solid #efece6;text-align:right;white-space:nowrap">' + euro(it.prix) + '</td></tr>').join('');
  return '<table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;margin:18px 0">' + rows + '</table>';
}
function addressBlock(d){
  if(!d.adresse_livraison) return '';
  return '<p style="font-family:Arial,sans-serif;font-size:13px;color:#56524c;line-height:1.6;margin:16px 0 0">' +
    '<b style="font-family:Georgia,serif;color:#0d0d0d;font-size:15px">Adresse de livraison</b><br/>' +
    (d.client_nom||'') + '<br/>' + d.adresse_livraison + '<br/>' + (d.cp_livraison||'') + ' ' + (d.ville_livraison||'') + '<br/>' + (d.pays_livraison||'France') +
    (d.telephone ? ('<br/>'+d.telephone) : '') + '</p>';
}
function sendMail(to, subject, html){
  if (!transporter || !to) return;
  transporter.sendMail({ from: MAIL_FROM, to, subject, html }).catch(e=>console.warn('Mail KO :', e.message));
}
function sendMailWithAttachment(to, subject, html, attachments){
  if (!transporter || !to) return Promise.resolve(false);
  return transporter.sendMail({ from: MAIL_FROM, to, subject, html, attachments })
    .then(()=>true)
    .catch(e=>{ console.warn('Mail+PJ KO :', e.message); return false; });
}
function notifyNewOrder(d, numero){
  const inner = '<div style="text-align:center;margin:-10px -10px 22px;background:#f3f1ec;padding:18px"><img src="https://ellia-paris.fr/assets/product-1.jpg" alt="La Pochette Ellia" style="width:100%;max-width:460px;height:auto;display:inline-block;border:1px solid #e6e3dc"/></div>' +
    '<h1 style="font-weight:normal;font-size:27px;margin:0 0 12px;letter-spacing:.01em">Merci pour votre commande</h1>' +
    '<p style="margin:0 0 8px">Bonjour ' + (d.client_nom||'') + ',</p>' +
    '<p style="margin:0 0 4px">Votre commande <b>' + numero + '</b> a bien été enregistrée. En voici le détail :</p>' +
    lineItems(d.items) +
    '<table style="width:100%;font-family:Arial,sans-serif;font-size:15px"><tr>' +
      '<td><b style="font-family:Georgia,serif;font-size:17px">Total</b></td>' +
      '<td style="text-align:right"><b style="font-family:Georgia,serif;font-size:17px">' + euro(d.montant_total) + '</b></td></tr></table>' +
    addressBlock(d) +
    '<p style="margin:24px 0 0;font-size:14px;color:#56524c;font-family:Arial,sans-serif">Le paiement et l\'expédition vous seront confirmés par e-mail. Avec soin,<br/>ELLIA PARIS</p>';
  sendMail(d.client_email, 'Votre commande ELLIA PARIS — '+numero, emailLayout(inner));
  if (process.env.SMTP_USER) sendMail(process.env.SMTP_USER, 'Nouvelle commande '+numero,
    emailLayout('<h2 style="font-weight:normal;font-size:22px;margin:0 0 8px">Nouvelle commande ' + numero + '</h2><p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:14px">' + (d.client_nom||'') + ' — ' + (d.client_email||'') + (d.telephone?(' — '+d.telephone):'') + '</p>' + lineItems(d.items) + '<p style="font-family:Georgia,serif"><b>Total ' + euro(d.montant_total) + '</b></p>' + addressBlock(d)));
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
/* Envoi de la facture PDF au client + archivage interne.
   Appelé uniquement quand la commande passe à "Expédiée". */
async function sendInvoiceForOrder(order){
  if (!invoiceMod || !transporter) return { client:false, archive:false };
  // 1) S'assurer qu'on a un numero de facture (creation web : pas encore)
  if (!order.invoice_number) {
    try {
      const rpc = await sb('rpc/next_invoice_number',{ method:'POST', body:{} });
      order.invoice_number = (typeof rpc === 'string') ? rpc : (rpc && rpc.result) || ('F-EP-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-4));
      await sb('orders?numero=eq.'+encodeURIComponent(order.numero),{ method:'PATCH', body:{ invoice_number: order.invoice_number } });
    } catch(e){ console.warn('next_invoice_number KO :', e.message); }
  }
  let mailSent = false, archiveSent = false;
  try {
    const pdfBuf = await invoiceMod.generateInvoicePDF({ ...order, invoice_date: order.created_at || new Date() });
    const archiveTo = process.env.INVOICE_ARCHIVE_TO || process.env.CONTACT_TO || process.env.SMTP_USER;
    const fname = (order.invoice_number || order.numero) + '.pdf';
    const fullName = ((order.client_prenom||'')+' '+(order.client_nom||'')).trim() || (order.client_nom||'');
    const url = trackUrl(order.transporteur, order.suivi);
    const track = order.suivi ? '<p style="font-family:Arial,sans-serif;font-size:14px;margin-top:14px">Suivi ' + (order.transporteur||'') + ' : <b>' + order.suivi + '</b>' + (url?' &nbsp;—&nbsp; <a href="'+url+'" style="color:#0d0d0d;font-weight:bold">Suivre mon colis →</a>':'') + '</p>' : '';

    if (order.client_email) {
      const innerCli = '<h1 style="font-weight:normal;font-size:27px;margin:0 0 12px">Votre commande est en route</h1>' +
        '<p style="margin:0 0 8px">Bonjour ' + (order.client_prenom || order.client_nom || '') + ',</p>' +
        '<p style="margin:0 0 4px">Votre commande <b>' + order.numero + '</b> a été expédiée. Vous trouverez ci-joint la facture <b>' + order.invoice_number + '</b> correspondante.</p>' +
        track +
        '<p style="margin:16px 0 0;font-size:14px;color:#56524c;font-family:Arial,sans-serif">Montant total : <b style="font-family:Georgia,serif;color:#0d0d0d">' + euro(order.montant_total) + '</b></p>' +
        '<p style="margin:24px 0 0;font-size:14px;color:#56524c;font-family:Arial,sans-serif">Avec soin,<br/>ELLIA PARIS</p>';
      mailSent = await sendMailWithAttachment(
        order.client_email,
        'Votre commande ELLIA PARIS — expédiée · facture ' + order.invoice_number,
        emailLayout(innerCli),
        [{ filename: fname, content: pdfBuf, contentType:'application/pdf' }]
      );
    }
    if (archiveTo) {
      const innerArch = '<h2 style="font-weight:normal;font-family:Georgia,serif;font-size:22px;margin:0 0 14px">Facture émise — ' + order.invoice_number + '</h2>' +
        '<table style="width:100%;font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">' +
          '<tr><td style="padding:6px 0;color:#666;width:160px">Client</td><td style="padding:6px 0;color:#0d0d0d"><b>' + fullName + '</b>' + (order.client_email?(' &lt;' + order.client_email + '&gt;'):'') + '</td></tr>' +
          '<tr><td style="padding:6px 0;color:#666">N° commande</td><td style="padding:6px 0;color:#0d0d0d">' + order.numero + '</td></tr>' +
          '<tr><td style="padding:6px 0;color:#666">Mode paiement</td><td style="padding:6px 0;color:#0d0d0d">' + (order.payment_method||'—') + '</td></tr>' +
          '<tr><td style="padding:6px 0;color:#666">Statut paiement</td><td style="padding:6px 0;color:#0d0d0d">' + (order.payment_status||'—') + '</td></tr>' +
          '<tr><td style="padding:6px 0;color:#666">Total TTC</td><td style="padding:6px 0"><b style="font-family:Georgia,serif;font-size:16px">' + euro(order.montant_total) + '</b></td></tr>' +
        '</table>' +
        '<p style="margin:24px 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#8a857d">PDF en pièce jointe — archivé automatiquement par le filtre Gmail "Factures Ellia".</p>';
      archiveSent = await sendMailWithAttachment(
        archiveTo,
        '[Facture Ellia] ' + order.invoice_number + ' — ' + fullName + ' — ' + euro(order.montant_total),
        emailLayout(innerArch),
        [{ filename: fname, content: pdfBuf, contentType:'application/pdf' }]
      );
    }
    if (archiveSent || mailSent) {
      try { await sb('orders?numero=eq.'+encodeURIComponent(order.numero),{ method:'PATCH', body:{ invoice_sent_at: new Date().toISOString() } }); } catch(_){}
    }
  } catch(e){ console.warn('Facture PDF/mail KO :', e.message); }
  return { client:mailSent, archive:archiveSent };
}

function notifyStatus(order, numero, statut){
  // Normalise + retire les diacritiques (à → a) avant lookup
  const key = (statut||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const msg = STATUT_MSG[key] || ('est désormais : '+statut+'.');
  const recap = (order.montant_total!=null) ? '<p style="font-family:Arial,sans-serif;font-size:13px;color:#8a857d;margin-top:16px">Montant : ' + euro(order.montant_total) + (order.initiales?(' · Gravure '+order.initiales):'') + '</p>' : '';
  const url = trackUrl(order.transporteur, order.suivi);
  const track = order.suivi ? '<p style="font-family:Arial,sans-serif;font-size:14px;margin-top:14px">Suivi ' + (order.transporteur||'') + ' : <b>' + order.suivi + '</b>' + (url?' &nbsp;—&nbsp; <a href="'+url+'" style="color:#0d0d0d;font-weight:bold">Suivre mon colis →</a>':'') + '</p>' : '';
  const inner = '<h1 style="font-weight:normal;font-size:27px;margin:0 0 12px">Votre commande ' + numero + '</h1>' +
    '<p style="margin:0 0 8px">Bonjour ' + (order.client_nom||'') + ',</p>' +
    '<p style="margin:0 0 4px">Votre commande <b>' + numero + '</b> ' + msg + '</p>' +
    '<p style="margin:16px 0 0"><span style="display:inline-block;background:#0d0d0d;color:#ffffff;font-family:Arial,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;padding:9px 18px">' + statut + '</span></p>' +
    track + recap +
    '<p style="margin:24px 0 0;font-size:14px;color:#56524c;font-family:Arial,sans-serif">Avec soin,<br/>ELLIA PARIS</p>';
  sendMail(order.client_email, 'Commande '+numero+' — '+statut, emailLayout(inner));
}

const TYPES = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.svg':'image/svg+xml', '.webp':'image/webp', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.md':'text/plain; charset=utf-8',
  '.glb':'model/gltf-binary', '.gltf':'model/gltf+json',
  '.mp4':'video/mp4', '.webm':'video/webm', '.xml':'application/xml; charset=utf-8',
  '.txt':'text/plain; charset=utf-8'
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
async function sb(pathQuery, opts){
  opts = opts || {};
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
  const rows = await sb('orders?select=numero,client_prenom,client_nom,client_email,telephone,initiales,finition,emplacement,montant_total,statut,suivi,transporteur,adresse_livraison,cp_livraison,ville_livraison,pays_livraison,adresse_facturation,cp_facturation,ville_facturation,pays_facturation,invoice_number,manual_order,payment_method,payment_status,created_at&order=created_at.desc');
  const j=(a,cp,v,p)=>[a,((cp||'')+' '+(v||'')).trim(),p].filter(x=>x&&String(x).trim()).join(' · ');
  return rows.map(r=>({ id:r.numero, date:(r.created_at||'').slice(0,10),
    client:((r.client_prenom||'')+' '+(r.client_nom||'')).trim()||'—',
    client_prenom:r.client_prenom||'', client_nom:r.client_nom||'',
    email:r.client_email||'', telephone:r.telephone||'',
    initiales:r.initiales||'—', finition:r.finition||'—', emplacement:r.emplacement||'', total:Number(r.montant_total), statut:r.statut,
    suivi:r.suivi||'', transporteur:r.transporteur||'',
    invoice_number:r.invoice_number||'', manual:!!r.manual_order,
    payment_method:r.payment_method||'', payment_status:r.payment_status||'',
    adresse_livraison:r.adresse_livraison||'', cp_livraison:r.cp_livraison||'', ville_livraison:r.ville_livraison||'', pays_livraison:r.pays_livraison||'France',
    adresse_facturation:r.adresse_facturation||'', cp_facturation:r.cp_facturation||'', ville_facturation:r.ville_facturation||'', pays_facturation:r.pays_facturation||'France',
    adresse:j(r.adresse_livraison,r.cp_livraison,r.ville_livraison,r.pays_livraison),
    adresseFact:j(r.adresse_facturation,r.cp_facturation,r.ville_facturation,r.pays_facturation) }));
}

async function getOrderFull(numero){
  if(!USE_DB) return null;
  const rows = await sb('orders?numero=eq.'+encodeURIComponent(numero)+'&select=*');
  return (rows && rows[0]) || null;
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


/* Helpers admin_settings (TOTP) */
async function getAdminSetting(key){
  if(!USE_DB) return null;
  try { const r = await sb('admin_settings?key=eq.'+encodeURIComponent(key)+'&select=value'); return r && r[0] ? r[0].value : null; }
  catch(_){ return null; }
}
async function setAdminSetting(key, value){
  if(!USE_DB) return false;
  try {
    const existing = await sb('admin_settings?key=eq.'+encodeURIComponent(key));
    if(existing && existing.length){
      await sb('admin_settings?key=eq.'+encodeURIComponent(key), { method:'PATCH', body:{ value, updated_at:new Date().toISOString() } });
    } else {
      await sb('admin_settings', { method:'POST', body:{ key, value } });
    }
    return true;
  } catch(_){ return false; }
}
async function deleteAdminSetting(key){
  if(!USE_DB) return false;
  try { await sb('admin_settings?key=eq.'+encodeURIComponent(key), { method:'DELETE' }); return true; } catch(_){ return false; }
}

/* ----- Helpers ----- */
const MAX_BODY = 64 * 1024;
function sendJSON(res, obj, code){ if(code) res.statusCode=code; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(obj)); }
function readBody(req){
  return new Promise((resolve, reject)=>{
    let b=''; let size=0;
    req.on('data', c => {
      size += c.length;
      if(size > MAX_BODY){ reject(new Error('body_too_large')); req.destroy(); return; }
      b += c;
    });
    req.on('end', ()=> resolve(b));
    req.on('error', reject);
  });
}
function cookies(req){ const o={}; (req.headers.cookie||'').split(';').forEach(c=>{ const i=c.indexOf('='); if(i>0)o[c.slice(0,i).trim()]=c.slice(i+1).trim(); }); return o; }
function isAuthed(req){ return cookies(req)['ellia_session'] === TOKEN; }

function clean(v, maxLen){
  if(maxLen==null) maxLen = 200;
  return String(v||'').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0, maxLen);
}
function isEmail(s){ return /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/.test(s) && s.length <= 254; }
function validateOrder(d){
  if(!d || typeof d!=='object') return 'invalid';
  if(!d.client_email || !isEmail(String(d.client_email).toLowerCase())) return 'email';
  if(!d.client_nom || String(d.client_nom).trim().length < 2) return 'nom';
  if(!d.adresse_livraison || String(d.adresse_livraison).trim().length < 4) return 'adresse';
  if(!d.cp_livraison || String(d.cp_livraison).trim().length < 3) return 'cp';
  if(!d.ville_livraison || String(d.ville_livraison).trim().length < 2) return 'ville';
  if(d.montant_total != null && (isNaN(Number(d.montant_total)) || Number(d.montant_total) < 0 || Number(d.montant_total) > 100000)) return 'montant';
  if(d.items && !Array.isArray(d.items)) return 'items';
  if(d.items && d.items.length > 20) return 'too_many_items';
  return null;
}

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(req, res);

  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  const cookieSec = isHttps(req) ? ' Secure;' : '';

  if (pathname.startsWith('/api/')) {
    try{
      if (req.method==='GET' && pathname==='/api/health'){
        const ok = USE_DB && SUPABASE_URL && SERVICE_KEY;
        res.setHeader('Content-Type','application/json; charset=utf-8');
        return res.end(JSON.stringify({ status:'ok', db: !!ok, smtp: !!transporter, ts: new Date().toISOString() }));
      }

      if (req.method==='POST' && pathname==='/api/login'){
        if(!rateAllowed('login', clientIp(req))) return sendJSON(res,{ ok:false, error:'Trop de tentatives, réessayez dans quelques minutes.' }, 429);
        const d = JSON.parse((await readBody(req))||'{}');
        if (d.password !== ADMIN_PASSWORD) return sendJSON(res,{ ok:false, error:'Mot de passe incorrect' },401);
        // 2FA si configure
        const totpSecret = await getAdminSetting('totp_secret');
        if (totpSecret && totpMod) {
          if (!d.code) return sendJSON(res,{ ok:false, need_2fa:true });
          if (!totpMod.verify(totpSecret, d.code, 1)) return sendJSON(res,{ ok:false, error:'Code à 6 chiffres invalide', need_2fa:true }, 401);
        }
        res.setHeader('Set-Cookie','ellia_session='+TOKEN+'; HttpOnly;'+cookieSec+' Path=/; SameSite=Lax; Max-Age=86400');
        return sendJSON(res,{ ok:true });
      }
      if (req.method==='POST' && pathname==='/api/logout'){
        res.setHeader('Set-Cookie','ellia_session=; HttpOnly;'+cookieSec+' Path=/; Max-Age=0');
        return sendJSON(res,{ ok:true });
      }
      if (req.method==='POST' && pathname==='/api/newsletter'){
        if(!rateAllowed('newsletter', clientIp(req))) return sendJSON(res,{ ok:false, error:'rate' }, 429);
        const d = JSON.parse((await readBody(req))||'{}');
        const email = String(d.email||'').trim().toLowerCase();
        if(!isEmail(email)) return sendJSON(res,{ ok:false, error:'invalid' }, 400);
        if(!USE_DB) return sendJSON(res,{ ok:true, demo:true });
        try{ await sb('newsletters',{ method:'POST', body:{ email } }); }catch(e){}
        return sendJSON(res,{ ok:true });
      }

      if (req.method==='POST' && pathname==='/api/contact'){
        if(!rateAllowed('contact', clientIp(req))) return sendJSON(res,{ ok:false, error:'rate_limit' }, 429);
        const d = JSON.parse((await readBody(req))||'{}');
        const nom     = clean(String(d.nom||'').trim()).slice(0,80);
        const cEmail  = String(d.email||'').trim().toLowerCase();
        const sujet   = clean(String(d.sujet||'').trim()).slice(0,40);
        const cmd     = clean(String(d.commande||'').trim()).slice(0,40);
        const message = clean(String(d.message||'').trim()).slice(0,2000);
        const rgpd    = !!d.rgpd;
        if(!nom || !isEmail(cEmail) || !sujet || message.length<10 || !rgpd){
          return sendJSON(res,{ ok:false, error:'invalid' }, 400);
        }
        const subjects = {commande:'Question sur une commande',personnalisation:'Personnalisation',livraison:'Livraison & retours',entretien:'Entretien & SAV',presse:'Presse & partenariats',autre:'Autre demande'};
        const sujLabel = subjects[sujet] || sujet;
        const escapeMsg = String(message).replace(/[&<>]/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[ch])).replace(/\n/g,'<br>');
        const adminMail = process.env.CONTACT_TO || process.env.SMTP_USER;
        const innerAdmin = '<h2 style="font-family:Georgia,serif;font-size:22px;color:#0d0d0d;margin:0 0 18px">Nouveau message — ' + sujLabel + '</h2>' +
          '<table style="width:100%;border-collapse:collapse;font-size:14px;font-family:Arial,sans-serif">' +
            '<tr><td style="padding:8px 0;color:#666;width:140px">Nom</td><td style="padding:8px 0;color:#0d0d0d"><b>' + nom + '</b></td></tr>' +
            '<tr><td style="padding:8px 0;color:#666">E-mail</td><td style="padding:8px 0"><a href="mailto:' + cEmail + '" style="color:#0d0d0d">' + cEmail + '</a></td></tr>' +
            '<tr><td style="padding:8px 0;color:#666">Sujet</td><td style="padding:8px 0;color:#0d0d0d">' + sujLabel + '</td></tr>' +
            (cmd ? '<tr><td style="padding:8px 0;color:#666">Commande</td><td style="padding:8px 0;color:#0d0d0d">' + cmd + '</td></tr>' : '') +
          '</table>' +
          '<div style="margin-top:24px;padding:20px;background:#f8f6f1;border-left:3px solid #0d0d0d;font-size:14.5px;line-height:1.6;color:#333">' + escapeMsg + '</div>' +
          '<p style="margin-top:24px;font-size:12px;color:#999;font-family:Arial,sans-serif">Pour répondre : cliquer sur l\'adresse e-mail ci-dessus.</p>';
        if (adminMail) sendMail(adminMail, '[ELLIA PARIS] ' + sujLabel + ' — ' + nom, emailLayout(innerAdmin));
        const innerClient = '<h1 style="font-weight:normal;font-size:27px;margin:0 0 14px">Votre message est bien reçu</h1>' +
          '<p style="margin:0 0 14px">Bonjour ' + nom + ',</p>' +
          '<p style="margin:0 0 14px">Nous avons bien reçu votre demande et nos conseillers vous répondront sous <b>24 heures ouvrées</b>.</p>' +
          '<p style="margin:0 0 8px;font-size:14px;font-family:Arial,sans-serif;color:#56524c">Rappel de votre message :</p>' +
          '<div style="margin-top:8px;padding:18px;background:#f8f6f1;border-left:3px solid #0d0d0d;font-size:14px;line-height:1.6;color:#555;font-style:italic;font-family:Georgia,serif">' + escapeMsg + '</div>' +
          '<p style="margin:28px 0 0;font-size:14px;color:#56524c;font-family:Arial,sans-serif">Avec soin,<br/>ELLIA PARIS</p>';
        sendMail(cEmail, 'Votre message a bien été reçu — ELLIA PARIS', emailLayout(innerClient));
        return sendJSON(res,{ ok:true });
      }

      if (req.method==='GET' && pathname==='/api/reviews'){
        if(!USE_DB){
          // Demo data si pas de DB
          return sendJSON(res,{ reviews:[
            {prenom:'Camille',note:5,titre:'Un objet d\'exception',commentaire:'La qualité du cuir et la finition de la plaque chromée sont absolument remarquables. Le verrouillage biométrique fonctionne à merveille et la gravure de mes initiales est d\'une précision impressionnante. Un investissement qui vaut chaque euro.',created_at:'2026-04-22T10:00:00Z',validated:true},
            {prenom:'Élodie',note:5,titre:'Discrète et raffinée',commentaire:'J\'aime particulièrement le côté discret de la fermeture biométrique — on ne la remarque qu\'au second regard. La pochette accompagne aussi bien mes tenues du soir que celles de tous les jours.',created_at:'2026-04-18T14:30:00Z',validated:true},
            {prenom:'Margaux',note:4,titre:'Belle pièce',commentaire:'Très satisfaite de l\'achat. L\'écrin est magnifique, le cuir vraiment qualitatif. Petit bémol sur le délai de livraison, un peu long, mais l\'attente en vaut la peine.',created_at:'2026-04-10T09:15:00Z',validated:true},
            {prenom:'Pauline',note:5,titre:'Service client au top',commentaire:'J\'ai eu une question sur la personnalisation, l\'équipe a été d\'une grande disponibilité. Le résultat dépasse mes attentes : finition impeccable, et le picto Ellia gravé sur la plaque est superbe.',created_at:'2026-03-28T16:45:00Z',validated:true}
          ]});
        }
        try{
          const rows = await sb('reviews?validated=eq.true&order=created_at.desc&limit=50',{ method:'GET' });
          return sendJSON(res,{ reviews: rows||[] });
        }catch(e){ return sendJSON(res,{ reviews:[] }); }
      }

      if (req.method==='POST' && pathname==='/api/reviews'){
        if(!rateAllowed('reviews', clientIp(req))) return sendJSON(res,{ ok:false, error:'rate_limit' }, 429);
        const d = JSON.parse((await readBody(req))||'{}');
        const prenom     = clean(String(d.prenom||'').trim()).slice(0,40);
        const rEmail     = String(d.email||'').trim().toLowerCase();
        const note       = Math.max(1, Math.min(5, parseInt(d.note,10)||0));
        const titre      = clean(String(d.titre||'').trim()).slice(0,80);
        const commentaire= clean(String(d.commentaire||'').trim()).slice(0,1000);
        const rgpd       = !!d.rgpd;
        if(!prenom || !isEmail(rEmail) || !note || commentaire.length<20 || !rgpd){
          return sendJSON(res,{ ok:false, error:'invalid' }, 400);
        }
        const row = { prenom, email:rEmail, note, titre, commentaire, validated:false, ref_produit:'ELLIA-NOIR', created_at:new Date().toISOString() };
        if(!USE_DB) return sendJSON(res,{ ok:true, demo:true });
        try{
          await sb('reviews',{ method:'POST', body:row });
          const adminMail = process.env.CONTACT_TO || process.env.SMTP_USER;
          if (adminMail) sendMail(adminMail, '[ELLIA PARIS] Nouvel avis — ' + note + '★ ' + prenom, emailLayout('<h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px">Nouvel avis à modérer</h2><p><b>' + prenom + '</b> (' + rEmail + ') — ' + note + '/5</p>' + (titre?'<p><i>« ' + titre + ' »</i></p>':'') + '<div style="margin-top:14px;padding:18px;background:#f8f6f1;border-left:3px solid #0d0d0d;font-family:Georgia,serif;font-style:italic">' + commentaire.replace(/[&<>]/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[ch])) + '</div><p style="margin-top:18px;font-size:13px;color:#999;font-family:Arial,sans-serif">Validez l\'avis depuis votre admin pour le publier sur le site.</p>'));
        }catch(e){ return sendJSON(res,{ ok:false, error:'db' }, 500); }
        return sendJSON(res,{ ok:true });
      }

      if (req.method==='GET' && pathname==='/api/products') return sendJSON(res, await getProducts());

      if (req.method==='POST' && pathname==='/api/orders'){
        if(!rateAllowed('orders', clientIp(req))) return sendJSON(res,{ ok:false, error:'rate' }, 429);
        const d = JSON.parse((await readBody(req))||'{}');
        const err = validateOrder(d);
        if(err) return sendJSON(res,{ ok:false, error:'validation', field:err }, 400);
        const numero = 'EP-'+Date.now().toString().slice(-6);
        const qte = (Array.isArray(d.items) && d.items.length) ? d.items.length : 1;
        if(!USE_DB){ notifyNewOrder(d, numero); return sendJSON(res,{ ok:true, numero, demo:true }); }
        try{
          const sr = await sb('products?ref=eq.ELLIA-NOIR&select=stock');
          const stock = (sr && sr[0]) ? Number(sr[0].stock) : 0;
          if(stock < qte) return sendJSON(res,{ ok:false, error:'rupture', stock }, 409);
        }catch(_){}
        notifyNewOrder(d, numero);
        const row = { numero,
          client_nom: clean(d.client_nom, 120),
          client_email: clean(String(d.client_email||'').toLowerCase(), 254),
          telephone: clean(d.telephone, 30),
          initiales: clean(d.initiales, 20),
          finition: clean(d.finition, 40),
          emplacement: clean(d.emplacement, 40),
          adresse_livraison: clean(d.adresse_livraison, 200),
          cp_livraison: clean(d.cp_livraison, 20),
          ville_livraison: clean(d.ville_livraison, 80),
          pays_livraison: clean(d.pays_livraison, 60) || 'France',
          adresse_facturation: clean(d.adresse_facturation, 200),
          cp_facturation: clean(d.cp_facturation, 20),
          ville_facturation: clean(d.ville_facturation, 80),
          pays_facturation: clean(d.pays_facturation, 60) || 'France',
          user_id: d.user_id || null,
          montant_total: Math.min(100000, Math.max(0, Number(d.montant_total) || 0)),
          statut: 'Nouvelle' };
        const created = await sb('orders',{ method:'POST', body:row, prefer:'return=representation' });
        try{ await sb('rpc/decrement_stock',{ method:'POST', body:{ p_ref:'ELLIA-NOIR', p_qte:qte } }); }catch(_){}
        return sendJSON(res,{ ok:true, numero, order:created&&created[0] });
      }

      if (USE_DB && promoMod && req.method==='POST' && pathname==='/api/promo/validate'){
        const d = JSON.parse((await readBody(req))||'{}');
        try {
          const r = await promoMod.validatePromoCode(sb, d.code, Number(d.amount||0));
          return sendJSON(res, r);
        } catch(e){ return sendJSON(res,{ valid:false, error:'failed' },500); }
      }
      if (!isAuthed(req)) return sendJSON(res,{ error:'non autorise' },401);

      if (req.method==='GET' && pathname==='/api/stats')  return sendJSON(res, await getStats());
      if (req.method==='GET' && pathname==='/api/orders') return sendJSON(res, await getOrders());

      if (req.method==='PATCH' && pathname.startsWith('/api/orders/')){
        const numero = pathname.split('/').pop();
        const d = JSON.parse((await readBody(req))||'{}');
        if(!USE_DB) return sendJSON(res,{ ok:true, demo:true });
        const upd = {};
        // Statut + livraison
        if(d.statut!==undefined) upd.statut = clean(d.statut, 40);
        if(d.suivi!==undefined) upd.suivi = clean(d.suivi, 60);
        if(d.transporteur!==undefined) upd.transporteur = clean(d.transporteur, 40);
        // Client
        if(d.client_prenom!==undefined) upd.client_prenom = clean(d.client_prenom, 80);
        if(d.client_nom!==undefined)    upd.client_nom    = clean(d.client_nom, 120);
        if(d.client_email!==undefined)  upd.client_email  = clean(String(d.client_email||'').toLowerCase(), 254);
        if(d.telephone!==undefined)     upd.telephone     = clean(d.telephone, 30);
        // Adresses
        if(d.adresse_livraison!==undefined) upd.adresse_livraison = clean(d.adresse_livraison, 200);
        if(d.cp_livraison!==undefined)      upd.cp_livraison      = clean(d.cp_livraison, 20);
        if(d.ville_livraison!==undefined)   upd.ville_livraison   = clean(d.ville_livraison, 80);
        if(d.pays_livraison!==undefined)    upd.pays_livraison    = clean(d.pays_livraison, 60) || 'France';
        if(d.adresse_facturation!==undefined) upd.adresse_facturation = clean(d.adresse_facturation, 200);
        if(d.cp_facturation!==undefined)      upd.cp_facturation      = clean(d.cp_facturation, 20);
        if(d.ville_facturation!==undefined)   upd.ville_facturation   = clean(d.ville_facturation, 80);
        if(d.pays_facturation!==undefined)    upd.pays_facturation    = clean(d.pays_facturation, 60) || 'France';
        // Personnalisation
        if(d.initiales!==undefined)   upd.initiales   = clean(d.initiales, 20);
        if(d.finition!==undefined)    upd.finition    = clean(d.finition, 40);
        if(d.emplacement!==undefined) upd.emplacement = clean(d.emplacement, 40);
        // Paiement + notes
        if(d.payment_method!==undefined) upd.payment_method = clean(d.payment_method, 40);
        if(d.payment_status!==undefined) upd.payment_status = clean(d.payment_status, 30);
        if(d.notes_admin!==undefined)    upd.notes_admin    = clean(d.notes_admin, 500);
        // Montants (optionnels — pour ajustements manuels)
        if(d.prix_pochette!==undefined)         upd.prix_pochette = Math.max(0, Math.min(100000, Number(d.prix_pochette)||0));
        if(d.prix_personnalisation!==undefined) upd.prix_personnalisation = Math.max(0, Math.min(100000, Number(d.prix_personnalisation)||0));
        if(d.frais_port!==undefined)            upd.frais_port = Math.max(0, Math.min(1000, Number(d.frais_port)||0));
        if(d.tva_rate!==undefined)              upd.tva_rate = Math.max(0, Math.min(100, Number(d.tva_rate)||0));
        if(d.quantite!==undefined)              upd.quantite = Math.max(1, Math.min(100, Number(d.quantite)||1));
        // Recalcul total TTC si les composantes ont change
        if (upd.prix_pochette!==undefined || upd.prix_personnalisation!==undefined || upd.frais_port!==undefined || upd.quantite!==undefined || upd.tva_rate!==undefined){
          try {
            const cur = await sb('orders?numero=eq.'+encodeURIComponent(numero)+'&select=prix_pochette,prix_personnalisation,frais_port,quantite,tva_rate');
            const o = (cur && cur[0]) || {};
            const pP = upd.prix_pochette!=null ? upd.prix_pochette : Number(o.prix_pochette||0);
            const pX = upd.prix_personnalisation!=null ? upd.prix_personnalisation : Number(o.prix_personnalisation||0);
            const pT = upd.frais_port!=null ? upd.frais_port : Number(o.frais_port||0);
            const qte= upd.quantite!=null ? upd.quantite : Number(o.quantite||1);
            const tva= upd.tva_rate!=null ? upd.tva_rate : Number(o.tva_rate!=null?o.tva_rate:20);
            const ttc = (pP + pX) * qte + pT;
            const ht  = ttc / (1 + tva/100);
            upd.montant_total = Number(ttc.toFixed(2));
            upd.montant_ht    = Number(ht.toFixed(2));
            upd.montant_tva   = Number((ttc - ht).toFixed(2));
          } catch(_){}
        }
        if(Object.keys(upd).length) await sb('orders?numero=eq.'+encodeURIComponent(numero),{ method:'PATCH', body:upd });

        let invoice_sent_now = false;
        if(d.statut!==undefined){
          try {
            const rows = await sb('orders?numero=eq.'+encodeURIComponent(numero)+'&select=*');
            const ord = rows && rows[0];
            if (ord) {
              const key = (d.statut||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
              // Statut "Expediee" + facture pas encore envoyee → genere et envoie la facture
              if (key.startsWith('expedi') && !ord.invoice_sent_at) {
                await sendInvoiceForOrder({ ...ord, numero });
                invoice_sent_now = true;
              } else {
                // Email simple de changement de statut (pas de PDF)
                notifyStatus(ord, numero, d.statut);
              }
            }
          } catch(_){}
        }
        return sendJSON(res,{ ok:true, invoice_sent: invoice_sent_now });
      }

      if (req.method==='PATCH' && pathname.startsWith('/api/products/')){
        const ref = pathname.split('/').pop();
        const d = JSON.parse((await readBody(req))||'{}');
        if(!USE_DB) return sendJSON(res,{ ok:true, demo:true });
        const stock = Math.max(0, Math.min(99999, Number(d.stock)||0));
        await sb('products?ref=eq.'+encodeURIComponent(ref),{ method:'PATCH', body:{ stock } });
        return sendJSON(res,{ ok:true });
      }

      /* ----- Creation manuelle de commande (admin uniquement) -----
         Saisie d'un client en direct (vente offline, telephone, etc.)
         + generation de la facture PDF + envoi auto par mail. */
      if (req.method==='POST' && pathname==='/api/admin/orders'){
        const d = JSON.parse((await readBody(req))||'{}');
        if(!d.client_nom || String(d.client_nom).trim().length < 2) return sendJSON(res,{ ok:false, error:'nom' }, 400);
        if(d.client_email && !isEmail(String(d.client_email).toLowerCase())) return sendJSON(res,{ ok:false, error:'email' }, 400);
        if(!USE_DB) return sendJSON(res,{ ok:false, error:'no_db' }, 503);

        // 1) Numero commande + numero facture
        const numero = 'EP-'+Date.now().toString().slice(-6);
        let invoice_number = null;
        try {
          const rpc = await sb('rpc/next_invoice_number',{ method:'POST', body:{} });
          invoice_number = (typeof rpc === 'string') ? rpc : (rpc && rpc.result) || null;
        } catch(_) {
          invoice_number = 'F-EP-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-4);
        }

        // 2) Calcul montants (saisie en TTC, on stocke HT/TVA aussi)
        const tva = Number(d.tva_rate != null ? d.tva_rate : 20);
        const prix_pochette         = Math.max(0, Math.min(100000, Number(d.prix_pochette||159)));
        const prix_personnalisation = Math.max(0, Math.min(100000, Number(d.prix_personnalisation||0)));
        const frais_port            = Math.max(0, Math.min(1000,   Number(d.frais_port||0)));
        const quantite              = Math.max(1, Math.min(100,    Number(d.quantite||1)));
        const totalTTC = (prix_pochette + prix_personnalisation) * quantite + frais_port;
        const totalHT  = totalTTC / (1 + tva/100);
        const totalTVA = totalTTC - totalHT;

        // 3) Insert
        const row = {
          numero,
          invoice_number,
          manual_order: true,
          client_prenom:        clean(d.client_prenom, 80),
          client_nom:           clean(d.client_nom, 120),
          client_email:         clean(String(d.client_email||'').toLowerCase(), 254),
          telephone:            clean(d.telephone, 30),
          initiales:            clean(d.initiales, 20),
          finition:             clean(d.finition, 40),
          emplacement:          clean(d.emplacement, 40),
          adresse_livraison:    clean(d.adresse_livraison, 200),
          cp_livraison:         clean(d.cp_livraison, 20),
          ville_livraison:      clean(d.ville_livraison, 80),
          pays_livraison:       clean(d.pays_livraison, 60) || 'France',
          adresse_facturation:  clean(d.adresse_facturation || d.adresse_livraison, 200),
          cp_facturation:       clean(d.cp_facturation || d.cp_livraison, 20),
          ville_facturation:    clean(d.ville_facturation || d.ville_livraison, 80),
          pays_facturation:     clean(d.pays_facturation || d.pays_livraison, 60) || 'France',
          quantite,
          prix_pochette,
          prix_personnalisation,
          frais_port,
          tva_rate: tva,
          montant_ht:  Number(totalHT.toFixed(2)),
          montant_tva: Number(totalTVA.toFixed(2)),
          montant_total: Number(totalTTC.toFixed(2)),
          payment_method: clean(d.payment_method, 40) || null,
          payment_status: clean(d.payment_status, 30) || 'En attente',
          payment_date: d.payment_status === 'Payé' ? new Date().toISOString() : null,
          notes_admin: clean(d.notes_admin, 500) || null,
          statut: clean(d.statut, 40) || 'Nouvelle'
        };

        let created = null;
        try {
          const ins = await sb('orders',{ method:'POST', body:row, prefer:'return=representation' });
          created = (ins && ins[0]) || null;
        } catch(e){
          return sendJSON(res,{ ok:false, error:'db', detail:String(e.message||e) }, 500);
        }

        // 4) Envoi facture UNIQUEMENT si la commande est creee en statut "Expediee"
        //    (sinon, l'envoi se declenchera au changement de statut)
        let mailSent = false, archiveSent = false;
        const statutKey = (row.statut||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
        if (statutKey.startsWith('expedi')) {
          const res2 = await sendInvoiceForOrder({ ...row });
          mailSent = res2.client; archiveSent = res2.archive;
        }

        return sendJSON(res,{ ok:true, numero, invoice_number, mail_client:mailSent, mail_archive:archiveSent, order: created });
      }

      /* ----- Fetch d'une commande complete pour edition ----- */
      if (req.method==='GET' && pathname.startsWith('/api/admin/orders/') && !pathname.endsWith('/invoice')){
        const numero = pathname.split('/').pop();
        const o = await getOrderFull(numero);
        if(!o) return sendJSON(res,{ error:'introuvable' }, 404);
        return sendJSON(res, o);
      }

      /* ----- Téléchargement / reimpression de la facture PDF ----- */
      if (req.method==='GET' && pathname.startsWith('/api/admin/orders/') && pathname.endsWith('/invoice')){
        if(!invoiceMod) return sendJSON(res,{ error:'pdf_indisponible' }, 500);
        const numero = pathname.split('/')[4];
        if(!USE_DB) return sendJSON(res,{ error:'no_db' }, 503);
        const rows = await sb('orders?numero=eq.'+encodeURIComponent(numero)+'&select=*');
        const o = rows && rows[0];
        if(!o) return sendJSON(res,{ error:'introuvable' }, 404);
        try {
          const pdfBuf = await invoiceMod.generateInvoicePDF({ ...o, invoice_date: o.created_at });
          res.setHeader('Content-Type','application/pdf');
          res.setHeader('Content-Disposition','inline; filename="'+(o.invoice_number||numero)+'.pdf"');
          res.setHeader('Cache-Control','no-cache, no-store, must-revalidate');
          return res.end(pdfBuf);
        } catch(e){
          console.warn('PDF KO :', e.message);
          return sendJSON(res,{ error:'pdf_failed' }, 500);
        }
      }

      /* ----- COMPTABILITE — stats + exports CSV (auth admin) ----- */
      if (req.method==='GET' && pathname==='/api/admin/compta'){
        if(!USE_DB) return sendJSON(res,{ error:'no_db' }, 503);
        if(!comptaMod) return sendJSON(res,{ error:'no_module' }, 500);
        const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
        try {
          const data = await comptaMod.getCompta(sb, year);
          const { orders, ...stats } = data;
          stats.nb_factures_emises = orders.filter(o => o.invoice_number).length;
          return sendJSON(res, stats);
        } catch(e){ return sendJSON(res,{ error:'compta_failed', detail:String(e.message||e) }, 500); }
      }
      if (req.method==='GET' && pathname==='/api/admin/export/recettes.csv'){
        if(!USE_DB) return sendJSON(res,{ error:'no_db' }, 503);
        if(!comptaMod) return sendJSON(res,{ error:'no_module' }, 500);
        const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
        try {
          const csv = await comptaMod.exportRecettesCSV(sb, year);
          res.setHeader('Content-Type','text/csv; charset=utf-8');
          res.setHeader('Content-Disposition','attachment; filename="livre-recettes-' + year + '.csv"');
          return res.end(csv);
        } catch(e){ return sendJSON(res,{ error:'csv_failed', detail:String(e.message||e) }, 500); }
      }
      if (req.method==='GET' && pathname==='/api/admin/export/factures.csv'){
        if(!USE_DB) return sendJSON(res,{ error:'no_db' }, 503);
        if(!comptaMod) return sendJSON(res,{ error:'no_module' }, 500);
        const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
        try {
          const csv = await comptaMod.exportFacturesCSV(sb, year);
          res.setHeader('Content-Type','text/csv; charset=utf-8');
          res.setHeader('Content-Disposition','attachment; filename="factures-' + year + '.csv"');
          return res.end(csv);
        } catch(e){ return sendJSON(res,{ error:'csv_failed', detail:String(e.message||e) }, 500); }
      }

      /* ----- PROMO CODES (admin) ----- */
      if (USE_DB && promoMod && req.method==='GET' && pathname==='/api/admin/promo'){
        try { return sendJSON(res, await promoMod.listPromoCodes(sb)); }
        catch(e){ return sendJSON(res,{ error:'failed' },500); }
      }
      if (USE_DB && promoMod && req.method==='POST' && pathname==='/api/admin/promo'){
        const d = JSON.parse((await readBody(req))||'{}');
        try { const r = await promoMod.createPromoCode(sb, d); return sendJSON(res,{ ok:true, promo:r && r[0] }); }
        catch(e){ return sendJSON(res,{ ok:false, error:String(e.message||e) },400); }
      }
      if (USE_DB && promoMod && req.method==='PATCH' && pathname.startsWith('/api/admin/promo/')){
        const code = pathname.split('/').pop();
        const d = JSON.parse((await readBody(req))||'{}');
        try { await promoMod.togglePromoCode(sb, code, !!d.active); return sendJSON(res,{ ok:true }); }
        catch(e){ return sendJSON(res,{ ok:false, error:'failed' },500); }
      }
      if (USE_DB && promoMod && req.method==='DELETE' && pathname.startsWith('/api/admin/promo/')){
        const code = pathname.split('/').pop();
        try { await promoMod.deletePromoCode(sb, code); return sendJSON(res,{ ok:true }); }
        catch(e){ return sendJSON(res,{ ok:false, error:'failed' },500); }
      }

      /* ----- 2FA admin (TOTP) ----- */
      if (totpMod && req.method==='GET' && pathname==='/api/admin/2fa/status'){
        const sec = await getAdminSetting('totp_secret');
        return sendJSON(res,{ enabled: !!sec });
      }
      if (totpMod && req.method==='POST' && pathname==='/api/admin/2fa/setup'){
        const secret = totpMod.generateSecret();
        const uri = totpMod.otpauthUri(secret, process.env.SMTP_USER || 'admin@ellia-paris.fr', 'ELLIA PARIS');
        return sendJSON(res,{ secret, uri });
      }
      if (totpMod && req.method==='POST' && pathname==='/api/admin/2fa/enable'){
        const d = JSON.parse((await readBody(req))||'{}');
        if (!d.secret || !d.code) return sendJSON(res,{ ok:false, error:'missing_params' },400);
        if (!totpMod.verify(d.secret, d.code, 1)) return sendJSON(res,{ ok:false, error:'invalid_code' },400);
        await setAdminSetting('totp_secret', d.secret);
        return sendJSON(res,{ ok:true });
      }
      if (totpMod && req.method==='POST' && pathname==='/api/admin/2fa/disable'){
        const d = JSON.parse((await readBody(req))||'{}');
        const existing = await getAdminSetting('totp_secret');
        if (!existing) return sendJSON(res,{ ok:true });
        if (!totpMod.verify(existing, d.code||'', 1)) return sendJSON(res,{ ok:false, error:'invalid_code' },400);
        await deleteAdminSetting('totp_secret');
        return sendJSON(res,{ ok:true });
      }

      return sendJSON(res,{ error:'route inconnue' },404);
    }catch(e){
      const msg = String(e.message||e);
      console.error('[API error]', req.method, pathname, '—', msg);
      if(msg === 'body_too_large') return sendJSON(res,{ error:'payload_trop_volumineux' }, 413);
      return sendJSON(res,{ error:'erreur_serveur' }, 500);
    }
  }

  if (pathname==='/admin' || pathname==='/admin/'){
    pathname = isAuthed(req) ? '/admin.html' : '/admin-login.html';
  }

  if (pathname === '/') pathname = '/index.html';
  const safe = path.normalize(pathname).replace(/^(\.\.[\/\\])+/,'');
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT)) { res.statusCode=403; return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      fs.readFile(path.join(ROOT,'404.html'),(e2,html)=>{
        res.statusCode = 404;
        res.setHeader('Content-Type','text/html; charset=utf-8');
        res.end(e2 ? '<h1 style="font-family:serif">404 — page introuvable</h1>' : html);
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    if (['.html','.css','.js','.json'].includes(ext)) res.setHeader('Cache-Control','no-cache, no-store, must-revalidate');
    else res.setHeader('Cache-Control','public, max-age=86400, immutable');
    res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log('ELLIA PARIS — http://localhost:' + PORT + (USE_DB ? '  [Supabase: ACTIF]' : '  [donnees DEMO]'));
  console.log('Admin : http://localhost:' + PORT + '/admin   (mot de passe : ' + (process.env.ADMIN_PASSWORD ? '****' : 'ellia2026 — a changer') + ')');
});