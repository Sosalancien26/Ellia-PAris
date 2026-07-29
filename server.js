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
const zlib   = require('zlib');
const cluster = require('cluster');
const os      = require('os');
/* Cache des fichiers deja compresses (evite de recompresser a chaque visite) */
const GZ_CACHE = new Map();
const GZ_CACHE_MAX = 60;
/* Nombre de processus.
   IMPORTANT : par defaut 1 seul processus.
   L'hebergement Node de Hostinger surveille le processus PRINCIPAL et exige
   qu'il appelle lui-meme listen() dans les 3 secondes. En mode cluster, le
   processus chef delegue aux enfants et n'ouvre pas le port -> Hostinger croit
   a un plantage et redemarre l'app en boucle.
   Le mode multi-processus ne s'active donc QUE si WEB_CONCURRENCY est
   explicitement defini (utile sur un VPS ou derriere un reverse proxy). */
const WORKERS = Math.max(1, Math.min(Number(process.env.WEB_CONCURRENCY) || 1, 8));
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
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('[Stripe] Mode', process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST', 'initialise');
  }
} catch(e){ console.warn('Module stripe indisponible :', e.message); }

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wwzaqbpyojpzjacbjyqi.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || '';
const USE_DB = !!SERVICE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ellia2026';
const SECRET = process.env.ADMIN_SECRET || ('ellia$' + ADMIN_PASSWORD);
const TOKEN = crypto.createHmac('sha256', SECRET).update('ellia-admin-v1').digest('hex');

/* Rate-limit generique en memoire (par IP, par bucket) */
const RATE = {};   // rempli automatiquement depuis RATE_TARGET (voir plus bas)
/* Limites GLOBALES visees (toutes IP confondues sur la fenetre).
   Note : les operateurs mobiles (Orange, SFR, Free) font passer des milliers de
   clients derriere une meme IP -> "orders" doit rester genereux, sinon un client
   legitime en 4G se voit refuser sa commande un jour de forte affluence. */
const RATE_TARGET = {
  login:      { max: 8,   window: 5*60*1000 },
  newsletter: { max: 20,  window: 60*60*1000 },
  orders:     { max: 60,  window: 60*60*1000 },   // etait 10 : bloquait les clients mobiles
  contact:    { max: 12,  window: 60*60*1000 },
  reviews:    { max: 10,  window: 24*60*60*1000 },
  authreset:  { max: 6,   window: 60*60*1000 },
  lookup:     { max: 120, window: 60*60*1000 },  // suivi de commande : bucket separe de la creation
  promo:      { max: 30,  window: 60*60*1000 },  // anti-enumeration des codes promo
  abandoned:  { max: 10,  window: 60*60*1000 }   // anti-relais d'emails
};
/* Chaque processus a son propre compteur : on divise pour que le TOTAL corresponde.
   On cree AUSSI la Map de chaque bucket ici — sinon un bucket oublie dans RATE
   ferait planter rateAllowed() (TypeError) et renverrait 500 sur la route. */
const RATE_LIMITS = {};
for (const k of Object.keys(RATE_TARGET)) {
  RATE_LIMITS[k] = { max: Math.max(2, Math.ceil(RATE_TARGET[k].max / WORKERS)), window: RATE_TARGET[k].window };
  RATE[k] = new Map();
}
// Purge periodique des buckets de rate-limit (sinon la memoire grossit indefiniment)
setInterval(() => {
  const now = Date.now();
  for (const bucket of Object.keys(RATE)) {
    const cfg = RATE_LIMITS[bucket]; if(!cfg) continue;
    for (const [ip, arr] of RATE[bucket]) {
      const alive = arr.filter(t => now - t < cfg.window);
      if (alive.length) RATE[bucket].set(ip, alive); else RATE[bucket].delete(ip);
    }
  }
}, 10*60*1000);
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
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net blob:",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' https: data: blob:",
    "media-src 'self' https:",
    "connect-src 'self' https://wwzaqbpyojpzjacbjyqi.supabase.co wss://wwzaqbpyojpzjacbjyqi.supabase.co https://cdn.jsdelivr.net https://unpkg.com",
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
function emailLayout(inner, preheader){
  // Email HTML complet avec doctype + <html><body> pour deliverability (SpamAssassin)
  return '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +
  '<html xmlns="http://www.w3.org/1999/xhtml" lang="fr">' +
  '<head>' +
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
    '<title>ELLIA PARIS</title>' +
  '</head>' +
  '<body style="margin:0;padding:0;background:#f3f1ec;font-family:Georgia,\'Times New Roman\',serif">' +
  // Preheader : texte d'apercu dans la boite de reception (masque dans le mail)
  '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">' + (preheader || 'ELLIA PARIS — maison de maroquinerie parisienne') + '</div>' +
  '<div style="margin:0;padding:40px 12px;background:#f3f1ec">' +
  // Table + largeur fixe : Outlook Windows ignore max-width sur un div (mail etale sur tout l'ecran)
  '<table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:580px;width:100%;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)"><tr><td>' +
  '<div>' +
    '<div style="text-align:center;padding:36px 0 14px">' +
      '<img src="' + LOGO + '" alt="ELLIA PARIS" style="height:46px;width:auto" />' +
      '<div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>' +
    '</div>' +
    '<div style="height:1px;background:#efece6;margin:0 40px"></div>' +
    '<div style="padding:36px 44px 40px;font-family:Georgia,\'Times New Roman\',serif;color:#0d0d0d;font-size:16px;line-height:1.65">' + inner + '</div>' +
    '<div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">' +
      '<div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>' +
      '<div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a> · <a href="https://ellia-paris.fr/entretien.html" style="color:#bdb8af;text-decoration:none">Entretien</a></div>' +
      '<div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Maison de maroquinerie française · Tous droits réservés.</div>' +
    '</div>' +
  '</div></td></tr></table></div>' +
  '</body></html>';
}

// Convertit le HTML en version texte brut pour le multipart text/plain
// (requis par SpamAssassin pour ne pas pénaliser les emails HTML-only)
function htmlToText(html){
  return String(html||'')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Conserver les URL des liens : sinon la version texte du mail de reinitialisation
    // ne contient aucun lien cliquable et devient inutilisable.
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, label) => {
      const txt = String(label).replace(/<[^>]+>/g,'').trim();
      return txt ? (txt + ' : ' + href) : href;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&euro;/g, '€')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
function engravingLines(it){
  // Affiche TOUS les details de gravure : initiales + jusqu'a 4 symboles
  const parts = [];
  if (it.initiales) parts.push('Initiales « ' + escH(it.initiales) + ' » · ' + escH(it.finition||'') + ' · ' + escH(it.emplacement||''));
  if (it.flame && it.flame.enabled) parts.push(escH(it.flame.symbol_name||'Symbole') + ' : ' + escH(it.flame.finish||'') + ' · ' + escH(it.flame.placement||''));
  if (it.extra && it.extra.enabled) parts.push(escH(it.extra.symbol_name||'Symbole') + ' : ' + escH(it.extra.finish||'') + ' · ' + escH(it.extra.placement||''));
  if (it.extra2 && it.extra2.enabled) parts.push(escH(it.extra2.symbol_name||'Symbole') + ' : ' + escH(it.extra2.finish||'') + ' · ' + escH(it.extra2.placement||''));
  if (it.extra3 && it.extra3.enabled) parts.push(escH(it.extra3.symbol_name||'Symbole') + ' : ' + escH(it.extra3.finish||'') + ' · ' + escH(it.extra3.placement||''));
  if (!parts.length) return '';
  return '<br/><span style="font-family:Arial,sans-serif;font-size:12px;color:#8a857d;line-height:1.7">Gravure :<br/>· ' + parts.join('<br/>· ') + '</span>';
}
function lineItems(items){
  if(!items || !items.length) return '';
  const rows = items.map(it => '<tr>' +
    '<td style="padding:12px 0;border-bottom:1px solid #efece6">' + escH(it.nom||'La Pochette ELLIA') +
    engravingLines(it) +
    '</td>' +
    '<td style="padding:12px 0;border-bottom:1px solid #efece6;text-align:right;white-space:nowrap;vertical-align:top">' + euro(it.prix) + '</td></tr>').join('');
  return '<table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;margin:18px 0">' + rows + '</table>';
}
function addressBlock(d){
  if(!d.adresse_livraison) return '';
  return '<p style="font-family:Arial,sans-serif;font-size:13px;color:#56524c;line-height:1.6;margin:16px 0 0">' +
    '<b style="font-family:Georgia,serif;color:#0d0d0d;font-size:15px">Adresse de livraison</b><br/>' +
    escH(d.client_nom||'') + '<br/>' + escH(d.adresse_livraison) + '<br/>' + escH(d.cp_livraison||'') + ' ' + escH(d.ville_livraison||'') + '<br/>' + escH(d.pays_livraison||'France') +
    (d.telephone ? ('<br/>'+escH(d.telephone)) : '') + '</p>';
}
// Headers communs pour bonne deliverability (compat SpamAssassin + RFC 8058)
function mailHeaders(){
  return {
    'List-Unsubscribe': '<mailto:contact@ellia-paris.fr?subject=Désinscription>, <https://ellia-paris.fr/contact.html>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'X-Mailer': 'ELLIA PARIS Mailer',
    'X-Entity-Ref-ID': String(Date.now())
  };
}
function sendMail(to, subject, html){
  if (!transporter || !to) return;
  transporter.sendMail({
    from: MAIL_FROM,
    // Le client peut repondre directement a l'email (invite a le faire dans certains messages)
    replyTo: process.env.CONTACT_TO || 'contact@ellia-paris.fr',
    to,
    subject,
    html,
    text: htmlToText(html),  // version text/plain (multipart alternative)
    headers: mailHeaders()
  }).catch(e=>console.warn('Mail KO :', e.message));
}
function sendMailWithAttachment(to, subject, html, attachments){
  if (!transporter || !to) return Promise.resolve(false);
  return transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    html,
    text: htmlToText(html),
    attachments,
    headers: mailHeaders()
  })
    .then(()=>true)
    .catch(e=>{ console.warn('Mail+PJ KO :', e.message); return false; });
}
function notifyNewOrder(d, numero){
  // Email client APRES paiement confirme — inclut preview pochette personnalisee
  return _notifyNewOrderInternal(d, numero);
}
function _notifyNewOrderInternal(d, numero){
  // Preview pochette : Gmail/Outlook bloquent les images data: URI inline pour des raisons de securite.
  // Solution : extraire le base64 et le passer en piece jointe avec un Content-ID (cid),
  // ce qui permet aux clients mail de charger l'image (multipart MIME).
  const previewMatch = (d.preview && typeof d.preview === 'string')
    ? d.preview.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i)
    : null;
  const hasPreview = !!previewMatch;
  const previewMime = hasPreview ? ('image/' + (previewMatch[1].toLowerCase() === 'jpg' ? 'jpeg' : previewMatch[1].toLowerCase())) : null;
  const previewBase64 = hasPreview ? previewMatch[2] : null;
  const previewCid = 'pochette-preview-' + numero;
  // Header image : preview pochette personnalisee (via CID) OU product-1.jpg en fallback
  const headerImg = hasPreview
    ? '<img src="cid:' + previewCid + '" alt="Votre pochette personnalisee" style="width:100%;max-width:480px;height:auto;display:inline-block;border:1px solid #e6e3dc;border-radius:3px"/>'
    : '<img src="https://ellia-paris.fr/assets/product-1.jpg" alt="La Pochette ELLIA" style="width:100%;max-width:460px;height:auto;display:inline-block;border:1px solid #e6e3dc"/>';
  const previewLabel = hasPreview
    ? '<div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8a857d;margin-top:10px">Aperçu de votre personnalisation</div>'
    : '';
  // Bloc "Étapes de votre commande" — cohérent avec la page confirmation.html
  const stepsBlock = '<table style="width:100%;border-collapse:collapse;margin:26px 0 8px;font-family:Arial,Helvetica,sans-serif">' +
    '<tr>' +
    '<td style="width:33%;padding:14px 10px 14px 0;vertical-align:top;border-top:1px solid #efece6;border-bottom:1px solid #efece6">' +
      '<div style="font-family:Georgia,serif;font-size:22px;color:#0d0d0d;line-height:1">01</div>' +
      '<div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#7a7363;margin:7px 0 4px">Aujourd\'hui</div>' +
      '<div style="font-size:12.5px;color:#5c5852;line-height:1.5">Votre dossier de gravure est transmis aux artisans.</div>' +
    '</td>' +
    '<td style="width:33%;padding:14px 10px;vertical-align:top;border-top:1px solid #efece6;border-bottom:1px solid #efece6">' +
      '<div style="font-family:Georgia,serif;font-size:22px;color:#0d0d0d;line-height:1">02</div>' +
      '<div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#7a7363;margin:7px 0 4px">5 à 7 jours</div>' +
      '<div style="font-size:12.5px;color:#5c5852;line-height:1.5">Pressage manuel au foil chaud dans le cuir grainé.</div>' +
    '</td>' +
    '<td style="width:33%;padding:14px 0 14px 10px;vertical-align:top;border-top:1px solid #efece6;border-bottom:1px solid #efece6">' +
      '<div style="font-family:Georgia,serif;font-size:22px;color:#0d0d0d;line-height:1">03</div>' +
      '<div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#7a7363;margin:7px 0 4px">Expédition</div>' +
      '<div style="font-size:12.5px;color:#5c5852;line-height:1.5">Suivi Colissimo envoyé dès le départ de l\'atelier.</div>' +
    '</td>' +
    '</tr></table>';
  const inner = '<div style="text-align:center;margin:-10px -10px 22px;background:#f3f1ec;padding:22px 18px">' + headerImg + previewLabel + '</div>' +
    '<h1 style="font-weight:normal;font-size:27px;margin:0 0 12px;letter-spacing:.01em">Paiement reçu — merci !</h1>' +
    '<p style="margin:0 0 8px">Bonjour ' + escH(d.client_nom||'') + ',</p>' +
    '<p style="margin:0 0 4px">Votre paiement a bien été reçu et votre commande <b>' + numero + '</b> est confirmée. En voici le détail :</p>' +
    lineItems(d.items) +
    '<table style="width:100%;font-family:Arial,sans-serif;font-size:15px"><tr>' +
      '<td><b style="font-family:Georgia,serif;font-size:17px">Total payé</b></td>' +
      '<td style="text-align:right"><b style="font-family:Georgia,serif;font-size:17px">' + euro(d.montant_total) + '</b></td></tr></table>' +
    addressBlock(d) +
    stepsBlock +
    '<p style="margin:18px 0 0;font-size:14px;color:#56524c;font-family:Arial,sans-serif;line-height:1.6">Suivez votre commande à tout moment : <a href="https://ellia-paris.fr/commande.html?n=' + encodeURIComponent(numero) + '" style="color:#0d0d0d">voir le suivi</a> (votre e-mail suffit, aucun compte requis).<br/><br/>Avec soin,<br/>ELLIA PARIS</p>' +
    // Mention legale obligatoire : article personnalise = pas de droit de retractation (art. L221-28 3° C. conso.)
    '<div style="margin:26px 0 0;padding:14px 16px;background:#faf8f4;border-left:2px solid #e0dbd0;font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:#8a857d;line-height:1.6">' +
      'Votre pochette étant personnalisée à votre demande, elle est exclue du droit de rétractation de 14 jours (article L221-28 3° du Code de la consommation). ' +
      'Nos <a href="https://ellia-paris.fr/cgv.html" style="color:#56524c">conditions générales de vente</a> restent consultables à tout moment. En cas de défaut, écrivez-nous : notre garantie légale s\'applique pleinement.' +
    '</div>';
  const clientHtml = emailLayout(inner, 'Commande ' + numero + ' confirmée — votre pochette est en préparation');
  if (hasPreview) {
    // Piece jointe inline avec Content-ID -> Gmail/Outlook chargent l'image normalement
    const attachments = [{
      filename: 'pochette-' + numero + (previewMime === 'image/png' ? '.png' : '.jpg'),
      content: Buffer.from(previewBase64, 'base64'),
      contentType: previewMime,
      cid: previewCid,
      contentDisposition: 'inline'
    }];
    sendMailWithAttachment(d.client_email, 'Commande confirmée — '+numero, clientHtml, attachments);
  } else {
    sendMail(d.client_email, 'Commande confirmée — '+numero, clientHtml);
  }
  if (process.env.SMTP_USER) sendMail(process.env.SMTP_USER, 'Nouvelle commande '+numero,
    emailLayout('<h2 style="font-weight:normal;font-size:22px;margin:0 0 8px">Nouvelle commande ' + escH(numero) + '</h2><p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:14px">' + escH(d.client_nom||'') + ' — ' + escH(d.client_email||'') + (d.telephone?(' — '+escH(d.telephone)):'') + '</p>' + lineItems(d.items) + '<p style="font-family:Georgia,serif"><b>Total ' + euro(d.montant_total) + '</b></p>' + addressBlock(d), 'Nouvelle commande ' + numero));
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
  // Fallback : un n° commencant par 1Z est un n° UPS, meme si le transporteur n'est pas renseigne
  if(/^1Z/i.test(String(suivi).trim())) return 'https://www.ups.com/track?tracknum='+n;
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
    const track = order.suivi ? '<p style="font-family:Arial,sans-serif;font-size:14px;margin-top:14px">Suivi ' + (order.transporteur||'') + ' : <b>' + escH(order.suivi) + '</b>' + (url?' &nbsp;—&nbsp; <a href="'+url+'" style="color:#0d0d0d;font-weight:bold">Suivre mon colis →</a>':'') + '</p>' : '';

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
        '[Facture Ellia] ' + order.invoice_number + ' — ' + escH(fullName) + ' — ' + euro(order.montant_total),
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
  const recap = (order.montant_total!=null) ? '<p style="font-family:Arial,sans-serif;font-size:13px;color:#8a857d;margin-top:16px">Montant : ' + euro(order.montant_total) + (order.initiales?(' · Gravure '+escH(order.initiales)):'') + '</p>' : '';
  const url = trackUrl(order.transporteur, order.suivi);
  const track = order.suivi ? '<p style="font-family:Arial,sans-serif;font-size:14px;margin-top:14px">Suivi ' + (order.transporteur||'') + ' : <b>' + escH(order.suivi) + '</b>' + (url?' &nbsp;—&nbsp; <a href="'+url+'" style="color:#0d0d0d;font-weight:bold">Suivre mon colis →</a>':'') + '</p>' : '';
  const inner = '<h1 style="font-weight:normal;font-size:27px;margin:0 0 12px">Votre commande ' + numero + '</h1>' +
    '<p style="margin:0 0 8px">Bonjour ' + escH(order.client_nom||'') + ',</p>' +
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
  { ref:'ELLIA-NOIR', nom:'La Pochette ELLIA — Noir', prix:159, stock:24, seuil:8 },
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
  // ATTENTION : la fiche admin renvoie TOUS ces champs lors d'un enregistrement.
  // Un champ absent ici = valeur par defaut du formulaire ecrite en base
  // (montant ecrase a 159 €, notes internes videes...). Ne rien retirer.
  const rows = await sb('orders?select=numero,client_prenom,client_nom,client_email,telephone,initiales,finition,emplacement,montant_total,statut,suivi,transporteur,adresse_livraison,cp_livraison,ville_livraison,pays_livraison,adresse_facturation,cp_facturation,ville_facturation,pays_facturation,invoice_number,manual_order,payment_method,payment_status,preview,items_data,created_at,quantite,prix_pochette,prix_personnalisation,frais_port,tva_rate,notes_admin,promo_code&order=created_at.desc');
  const j=(a,cp,v,p)=>[a,((cp||'')+' '+(v||'')).trim(),p].filter(x=>x&&String(x).trim()).join(' · ');
  return rows.map(r=>({ id:r.numero, date:(r.created_at||'').slice(0,10),
    client:((r.client_prenom||'')+' '+(r.client_nom||'')).trim()||'—',
    client_prenom:r.client_prenom||'', client_nom:r.client_nom||'',
    email:r.client_email||'', telephone:r.telephone||'',
    initiales:r.initiales||'—', finition:r.finition||'—', emplacement:r.emplacement||'', total:Number(r.montant_total), statut:r.statut,
    suivi:r.suivi||'', transporteur:r.transporteur||'',
    invoice_number:r.invoice_number||'', manual:!!r.manual_order,
    payment_method:r.payment_method||'', payment_status:r.payment_status||'',
    preview:r.preview||null,
    items_data: r.items_data || null,
    // Montants detailles : indispensables pour que la fiche admin ne reecrive pas
    // des valeurs par defaut lors d'un simple enregistrement.
    quantite: r.quantite==null ? 1 : Number(r.quantite),
    prix_pochette: r.prix_pochette==null ? null : Number(r.prix_pochette),
    prix_personnalisation: r.prix_personnalisation==null ? null : Number(r.prix_personnalisation),
    frais_port: r.frais_port==null ? null : Number(r.frais_port),
    tva_rate: r.tva_rate==null ? null : Number(r.tva_rate),
    notes_admin: r.notes_admin || '',
    promo_code: r.promo_code || '',
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
const MAX_BODY = 256 * 1024;  // 256 KB — assez pour commandes avec metadata, refuse les abus
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
/* ----- Sessions multi-roles -----
   Legacy : cookie === TOKEN  → compte principal (role admin)
   V2     : cookie === 'v2.' + base64(login|role) + '.' + hmac  → comptes equipe */
function makeSession(login, role){
  const payload = Buffer.from(login + '|' + role).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update('ellia-v2.' + payload).digest('hex');
  return 'v2.' + payload + '.' + sig;
}
function getAuth(req){
  const c = cookies(req)['ellia_session'] || '';
  if (c === TOKEN) return { login:'principal', role:'admin' };
  if (c.startsWith('v2.')){
    const parts = c.split('.');
    if (parts.length !== 3) return null;
    const expected = crypto.createHmac('sha256', SECRET).update('ellia-v2.' + parts[1]).digest('hex');
    if (parts[2] !== expected) return null;
    try {
      const [login, role] = Buffer.from(parts[1], 'base64url').toString().split('|');
      if (!['admin','comptable','atelier'].includes(role)) return null;
      return { login, role };
    } catch(_) { return null; }
  }
  return null;
}
function isAuthed(req){ return !!getAuth(req); }
function hashPassword(pw, salt){
  return crypto.scryptSync(String(pw), String(salt), 32).toString('hex');
}
/* Champs financiers masques pour le role atelier */
const FINANCE_FIELDS = ['montant_total','montant_ht','montant_tva','prix_pochette','prix_personnalisation','frais_port','tva_rate','payment_method','payment_status','payment_date','invoice_number','invoice_date','promo_code','promo_discount','total'];
function stripFinance(o){
  if (!o || typeof o !== 'object') return o;
  const copy = { ...o };
  for (const f of FINANCE_FIELDS) delete copy[f];
  // perso_detail contient persoInitiales / persoSymbol = des MONTANTS en euros :
  // sans ce nettoyage, le role atelier reconstitue le prix de la commande.
  const stripItems = arr => (Array.isArray(arr) ? arr : []).map(it => {
    const c = { ...it };
    delete c.prix; delete c.total; delete c.prix_unitaire; delete c.perso_detail;
    return c;
  });
  if (Array.isArray(copy.cart_data)) copy.cart_data = stripItems(copy.cart_data);
  if (Array.isArray(copy.items)) copy.items = stripItems(copy.items);
  if (Array.isArray(copy.items_data)) copy.items_data = stripItems(copy.items_data);
  return copy;
}
/* Echappement HTML pour les templates email (les donnees client sont libres) */
function escH(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

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

/* FILET DE SECURITE : une erreur imprevue ne doit JAMAIS tuer le site.
   On journalise et on continue — le processus reste debout. */
process.on('uncaughtException', (e) => {
  console.error('[FATAL evite] uncaughtException :', e && e.stack || e);
});
process.on('unhandledRejection', (e) => {
  console.error('[FATAL evite] unhandledRejection :', e && e.stack || e);
});

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(req, res);

  let url, pathname;
  try {
    url = new URL(req.url, 'http://localhost');
    pathname = decodeURIComponent(url.pathname);
  } catch(_) {
    // URL malformee (ex: /%) : reponse propre au lieu d'un crash du processus
    res.statusCode = 400;
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    return res.end('Requete invalide');
  }
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
        const loginId = clean(String(d.login||'').trim().toLowerCase(), 60);
        // --- Compte EQUIPE (identifiant renseigne) ---
        if (loginId) {
          if(!USE_DB) return sendJSON(res,{ ok:false, error:'Comptes équipe indisponibles (pas de base)' }, 503);
          let u = null;
          try {
            const rows = await sb('admin_users?login=eq.'+encodeURIComponent(loginId)+'&actif=eq.true&select=*');
            u = rows && rows[0];
          } catch(_){}
          if (!u || hashPassword(d.password, u.salt) !== u.password_hash) {
            return sendJSON(res,{ ok:false, error:'Identifiant ou mot de passe incorrect' },401);
          }
          res.setHeader('Set-Cookie','ellia_session='+makeSession(u.login, u.role)+'; HttpOnly;'+cookieSec+' Path=/; SameSite=Lax; Max-Age=86400');
          return sendJSON(res,{ ok:true, role:u.role });
        }
        // --- Compte PRINCIPAL (mot de passe maitre, 2FA si configuree) ---
        if (d.password !== ADMIN_PASSWORD) return sendJSON(res,{ ok:false, error:'Mot de passe incorrect' },401);
        const totpSecret = await getAdminSetting('totp_secret');
        if (totpSecret && totpMod) {
          if (!d.code) return sendJSON(res,{ ok:false, need_2fa:true });
          if (!totpMod.verify(totpSecret, d.code, 1)) return sendJSON(res,{ ok:false, error:'Code à 6 chiffres invalide', need_2fa:true }, 401);
        }
        res.setHeader('Set-Cookie','ellia_session='+TOKEN+'; HttpOnly;'+cookieSec+' Path=/; SameSite=Lax; Max-Age=86400');
        return sendJSON(res,{ ok:true, role:'admin' });
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

      /* ----- STATUT DE PAIEMENT (public, lecture minimale) — pour la page de confirmation ----- */
      if (req.method==='GET' && pathname==='/api/order-paystatus'){
        if(!rateAllowed('lookup', clientIp(req))) return sendJSON(res,{ paid:false }, 429);
        const n = clean(url.searchParams.get('n')||'', 30);
        if(!n || !/^EP-[A-Z0-9]{4,14}$/i.test(n)) return sendJSON(res,{ paid:false }, 400);
        if(!USE_DB) return sendJSON(res,{ paid:true, demo:true });
        try{
          const rows = await sb('orders?numero=eq.'+encodeURIComponent(n)+'&select=payment_status,statut');
          const o = rows && rows[0];
          if(!o) return sendJSON(res,{ paid:false, found:false });
          return sendJSON(res,{ paid: o.payment_status==='Payee', found:true });
        }catch(_){ return sendJSON(res,{ paid:false, error:'db' }, 503); }
      }

      /* ----- SUIVI DE COMMANDE SANS COMPTE (numero + email) -----
         Un acheteur invite n'a pas de compte : il ne peut pas lire sa commande
         via Supabase (RLS = auth.uid() = user_id). Cet endpoint lui rend
         uniquement les infos de suivi, et exige de connaitre numero ET email. */
      if (req.method==='POST' && pathname==='/api/order-lookup'){
        if(!rateAllowed('lookup', clientIp(req))) return sendJSON(res,{ ok:false, error:'rate' }, 429);
        const d = JSON.parse((await readBody(req))||'{}');
        const n = clean(String(d.numero||'').trim().toUpperCase(), 30);
        const em = String(d.email||'').trim().toLowerCase();
        if(!/^EP-[A-Z0-9]{4,14}$/.test(n) || !isEmail(em)) return sendJSON(res,{ ok:false, error:'invalid' }, 400);
        if(!USE_DB) return sendJSON(res,{ ok:false, error:'no_db' }, 503);
        try{
          const rows = await sb('orders?numero=eq.'+encodeURIComponent(n)+
            '&select=numero,created_at,statut,suivi,transporteur,initiales,finition,emplacement,montant_total,client_prenom,client_nom,client_email,adresse_livraison,cp_livraison,ville_livraison,pays_livraison');
          const o = rows && rows[0];
          // Reponse identique si introuvable OU email different (pas d'enumeration)
          if(!o || String(o.client_email||'').toLowerCase() !== em){
            return sendJSON(res,{ ok:false, error:'not_found' }, 404);
          }
          delete o.client_email;
          return sendJSON(res,{ ok:true, order:o });
        }catch(e){ return sendJSON(res,{ ok:false, error:'db' }, 503); }
      }

      /* ----- MOT DE PASSE OUBLIE — envoi via NOTRE SMTP (bypass email Supabase) ----- */
      if (req.method==='POST' && pathname==='/api/auth/reset'){
        if(!rateAllowed('authreset', clientIp(req))) return sendJSON(res,{ ok:true }); // silencieux anti-abus
        const d = JSON.parse((await readBody(req))||'{}');
        const email = String(d.email||'').trim().toLowerCase();
        // Reponse toujours identique (pas d'enumeration de comptes)
        if(!isEmail(email) || !USE_DB) return sendJSON(res,{ ok:true });
        try{
          const r = await fetch(SUPABASE_URL + '/auth/v1/admin/generate_link', {
            method:'POST',
            headers:{ 'apikey':SERVICE_KEY, 'Authorization':'Bearer '+SERVICE_KEY, 'Content-Type':'application/json' },
            body: JSON.stringify({ type:'recovery', email, redirect_to:'https://ellia-paris.fr/connexion.html' })
          });
          const j = await r.json().catch(()=>({}));
          const link = j.action_link || (j.properties && j.properties.action_link);
          if (link) {
            const inner = '<h1 style="font-weight:normal;font-size:27px;margin:0 0 14px">Réinitialiser votre mot de passe</h1>' +
              '<p style="margin:0 0 14px">Bonjour,</p>' +
              '<p style="margin:0 0 14px">Vous avez demandé à réinitialiser le mot de passe de votre compte ELLIA PARIS. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>' +
              '<p style="margin:26px 0"><a href="' + link + '" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;padding:14px 30px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase">Choisir un nouveau mot de passe</a></p>' +
              '<p style="margin:0 0 8px;font-size:13px;color:#8a857d;font-family:Arial,sans-serif">Ce lien est valable 1 heure. Si vous n\'êtes pas à l\'origine de cette demande, ignorez simplement cet e-mail — votre mot de passe restera inchangé.</p>' +
              '<p style="margin:24px 0 0;font-size:14px;color:#56524c;font-family:Arial,sans-serif">Avec soin,<br/>ELLIA PARIS</p>';
            sendMail(email, 'Réinitialisation de votre mot de passe — ELLIA PARIS', emailLayout(inner));
          }
        }catch(e){ console.warn('Reset password KO :', e.message); }
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
          '<p style="margin:0 0 14px">Bonjour ' + escH(nom) + ',</p>' +
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
          if (adminMail) sendMail(adminMail, '[ELLIA PARIS] Nouvel avis — ' + note + '★ ' + prenom, emailLayout('<h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px">Nouvel avis à modérer</h2><p><b>' + prenom + '</b> (' + rEmail + ') — ' + note + '/5</p>' + (titre?'<p><i>« ' + escH(titre) + ' »</i></p>':'') + '<div style="margin-top:14px;padding:18px;background:#f8f6f1;border-left:3px solid #0d0d0d;font-family:Georgia,serif;font-style:italic">' + commentaire.replace(/[&<>]/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[ch])) + '</div><p style="margin-top:18px;font-size:13px;color:#999;font-family:Arial,sans-serif">Validez l\'avis depuis votre admin pour le publier sur le site.</p>'));
        }catch(e){ return sendJSON(res,{ ok:false, error:'db' }, 500); }
        return sendJSON(res,{ ok:true });
      }

      if (req.method==='GET' && pathname==='/api/products') return sendJSON(res, await getProducts());

      if (req.method==='POST' && pathname==='/api/orders'){
        if(!rateAllowed('orders', clientIp(req))) return sendJSON(res,{ ok:false, error:'rate' }, 429);
        const d = JSON.parse((await readBody(req))||'{}');
        const err = validateOrder(d);
        if(err) return sendJSON(res,{ ok:false, error:'validation', field:err }, 400);
        // Numero unique : timestamp + 4 hex aleatoires (l'ancien format se repetait toutes les ~16 min)
        const numero = 'EP-'+Date.now().toString().slice(-6)+crypto.randomBytes(2).toString('hex').toUpperCase();
        const qte = (Array.isArray(d.items) && d.items.length) ? d.items.length : 1;
        // MODE DEMO uniquement : envoi mail immediat (pas de Stripe pour valider)
        if(!USE_DB){ notifyNewOrder(d, numero); return sendJSON(res,{ ok:true, numero, demo:true }); }
        let prixCatalogue = 159; // repli
        try{
          const sr = await sb('products?ref=eq.ELLIA-NOIR&select=stock,prix');
          if(!sr || !sr[0]) return sendJSON(res,{ ok:false, error:'produit_indisponible' }, 503);
          const stock = Number(sr[0].stock);
          prixCatalogue = Number(sr[0].prix) || 159;
          if(stock < qte) return sendJSON(res,{ ok:false, error:'rupture', stock }, 409);
        }catch(_){ return sendJSON(res,{ ok:false, error:'stock_indisponible' }, 503); }
        // GARDE-FOU FINANCIER : le total envoye par le navigateur ne peut pas etre
        // inferieur au prix catalogue x quantite (moins une eventuelle remise promo validee serveur).
        // Le navigateur envoie le total BRUT (remise non deduite : voir checkout.html).
        // On valide d'abord ce brut, PUIS on calcule la remise sur cette meme base
        // — sinon le client verrait -21,80 € a l'ecran et serait debite de -15,90 €.
        const totalBrut = Math.min(100000, Math.max(0, Number(d.montant_total)||0));
        const plancherBrut = prixCatalogue * qte;   // gravure et options ne peuvent qu'augmenter
        if (totalBrut + 0.01 < plancherBrut) {
          console.warn('[SECURITE] Total brut client', totalBrut, '< plancher', plancherBrut, '— commande refusee');
          return sendJSON(res,{ ok:false, error:'montant_invalide' }, 400);
        }
        let promoDiscount = 0, promoCode = '';
        if (d.promo_code && promoMod) {
          try {
            const pv = await promoMod.validatePromoCode(sb, String(d.promo_code).trim().toUpperCase(), totalBrut);
            if (pv && pv.valid) { promoDiscount = Number(pv.discount)||0; promoCode = String(d.promo_code).trim().toUpperCase().slice(0,30); }
          } catch(_){}
        }
        // La remise ne peut jamais rendre le paiement impossible (Stripe refuse < 0,50 €)
        if (promoDiscount > totalBrut - 0.5) promoDiscount = Math.max(0, totalBrut - 0.5);
        const totalClient = totalBrut;
        // PAS de notifyNewOrder ici — l'email partira UNIQUEMENT apres confirmation Stripe (webhook)
        // Preview : on accepte seulement les data URL JPEG/PNG, taille max ~200 KB
        let preview = null;
        if (typeof d.preview === 'string' && d.preview.length > 0 && d.preview.length < 220000) {
          if (/^data:image\/(jpeg|png|webp);base64,/i.test(d.preview)) preview = d.preview;
        }
        // Items_data : on serialise tout le panier (incluant flame/extra/extra2/extra3) pour reconstruire la commande apres paiement
        let itemsData = null;
        try {
          if (Array.isArray(d.items)) {
            // Nettoyage : on supprime le preview de chaque item (deja stocke separement) pour limiter la taille
            const lite = d.items.map(it => {
              const c = Object.assign({}, it);
              delete c.preview; // evite le double stockage du PNG
              return c;
            });
            const s = JSON.stringify(lite);
            if (s.length < 60000) itemsData = lite;
          }
        } catch(_){}
        const row = { numero,
          client_nom: clean(d.client_nom, 120),
          client_email: clean(String(d.client_email||'').toLowerCase(), 254),
          telephone: clean(d.telephone, 30),
          initiales: clean(d.initiales, 50),
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
          // Total NET : remise promo (validee serveur) deduite → c'est ce montant que Stripe facturera
          montant_total: Math.max(0, totalClient - promoDiscount),
          quantite: qte,   // necessaire pour restituer le BON stock si le paiement echoue
          // DETAIL FINANCIER : sans ces champs, la facture PDF retombe sur 159 €
          // et la comptabilite range du TTC dans la colonne HT.
          prix_pochette: prixCatalogue,
          prix_personnalisation: Math.max(0, Math.round(((totalBrut / qte) - prixCatalogue) * 100) / 100),
          frais_port: 0,
          tva_rate: 20,
          montant_ht:  Math.round(((totalBrut - promoDiscount) / 1.2) * 100) / 100,
          montant_tva: Math.round(((totalBrut - promoDiscount) - (totalBrut - promoDiscount) / 1.2) * 100) / 100,
          promo_discount: promoDiscount || 0,
          preview: preview,
          items_data: itemsData,
          statut: 'En attente paiement' };
        if (promoCode) {
          row.promo_code = promoCode;
          row.notes_admin = ((row.notes_admin||'') + ' [PROMO '+promoCode+' -'+promoDiscount+'€]').trim();
        }
        const created = await sb('orders',{ method:'POST', body:row, prefer:'return=representation' });
        try{ await sb('rpc/decrement_stock',{ method:'POST', body:{ p_ref:'ELLIA-NOIR', p_qte:qte, p_order:numero } }); }catch(_){}
        // Mark abandoned cart as converted
        try{ if(d.client_email){ await sb('abandoned_carts?email=eq.'+encodeURIComponent(String(d.client_email).toLowerCase())+'&converted_at=is.null',{ method:'PATCH', body:{ converted_at: new Date().toISOString() } }); } }catch(_){}
        return sendJSON(res,{ ok:true, numero, order:created&&created[0] });
      }

      /* ===== STRIPE : creation session de paiement ===== */
      if (req.method==='POST' && pathname==='/api/checkout/session'){
        if(!rateAllowed('lookup', clientIp(req))) return sendJSON(res,{ ok:false, error:'rate' }, 429);
        if (!stripe) return sendJSON(res,{ ok:false, error:'stripe_not_configured' }, 500);
        const d = JSON.parse((await readBody(req))||'{}');
        const numero = clean(d.numero, 30);
        if (!numero) return sendJSON(res,{ ok:false, error:'numero_required' }, 400);
        try {
          let amount = 0, clientEmail = '', items = [];
          if (USE_DB) {
            const rows = await sb('orders?numero=eq.'+encodeURIComponent(numero)+'&select=numero,client_email,montant_total,initiales,finition,emplacement');
            if (!rows || !rows[0]) return sendJSON(res,{ ok:false, error:'order_not_found' }, 404);
            const o = rows[0];
            amount = Math.round(Number(o.montant_total) * 100);
            clientEmail = o.client_email || '';
            items = [{
              name: 'La Pochette ELLIA' + (o.initiales ? ' personnalisee' : ''),
              description: o.initiales ? ('Gravure "' + o.initiales + '" - ' + (o.finition||'') + ' - ' + (o.emplacement||'')) : 'Pochette en cuir graine',
              amount: amount
            }];
          } else {
            amount = Math.round(Number(d.amount||218) * 100);
            clientEmail = clean(d.email, 254);
            items = [{ name:'La Pochette ELLIA', description:'Mode demo', amount: amount }];
          }
          if (amount < 50) return sendJSON(res,{ ok:false, error:'amount_too_low' }, 400);
          const origin = (req.headers.origin || 'https://ellia-paris.fr').replace(/\/$/,'');
          const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            customer_email: clientEmail || undefined,
            line_items: items.map(it => ({
              price_data: { currency:'eur', product_data:{ name:it.name, description:it.description }, unit_amount: it.amount },
              quantity: 1
            })),
            metadata: { numero: numero },
            // Stripe ne recopie PAS les metadata de la session vers le PaymentIntent :
            // sans ceci, l'evenement payment_failed n'a pas le numero et le stock
            // n'est jamais restitue.
            payment_intent_data: { metadata: { numero: numero } },
            success_url: origin + '/confirmation.html?n=' + encodeURIComponent(numero) + '&session_id={CHECKOUT_SESSION_ID}',
            cancel_url:  origin + '/checkout.html?cancelled=1&n=' + encodeURIComponent(numero),
            locale: 'fr',
            shipping_address_collection: { allowed_countries: ['FR','BE','CH','LU','MC','GB','DE','ES','IT','US','CA'] }
          });
          if (USE_DB) {
            // Filtre sur le statut : une commande DEJA PAYEE ne doit jamais
            // repasser en "En attente" (sinon un tiers casse le suivi de paiement).
            try { await sb('orders?numero=eq.'+encodeURIComponent(numero)+'&statut=eq.'+encodeURIComponent('En attente paiement'),{ method:'PATCH', body:{ payment_method:'Stripe', payment_status:'En attente' } }); } catch(_){}
          }
          return sendJSON(res,{ ok:true, url: session.url, session_id: session.id });
        } catch(e) {
          console.error('[Stripe] checkout session error:', e.message);
          return sendJSON(res,{ ok:false, error:'stripe_error', message: e.message }, 500);
        }
      }

      /* ===== STRIPE : webhook (paiement confirme) ===== */
      if (req.method==='POST' && pathname==='/api/stripe/webhook'){
        if (!stripe) return sendJSON(res,{ ok:false, error:'stripe_not_configured' }, 500);
        const sig = req.headers['stripe-signature'];
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        // Accumuler des BUFFERS : concatener des strings coupe les caracteres
        // accentues a la frontiere des paquets -> signature Stripe invalide
        // (noms/adresses francais = accents tres frequents).
        let rawBody = Buffer.alloc(0);
        const chunks = []; let rawLen = 0;
        try {
          await new Promise((resolve, reject) => {
            req.on('data', c => {
              rawLen += c.length;
              if (rawLen > 1048576) { reject(new Error('webhook_too_large')); return; }
              chunks.push(c);
            });
            req.on('end', () => { rawBody = Buffer.concat(chunks); resolve(); });
            req.on('error', reject);
          });
        } catch(_){ return sendJSON(res,{ received:false }, 400); }
        let event;
        try {
          if (!secret) {
            // JAMAIS de webhook sans verification de signature : sinon n'importe qui
            // peut marquer une commande "payee" avec un simple POST forge.
            console.error('[Stripe webhook] STRIPE_WEBHOOK_SECRET non configure — evenement rejete');
            return sendJSON(res,{ received:false, error:'webhook_secret_missing' }, 500);
          }
          event = stripe.webhooks.constructEvent(rawBody, sig, secret);
        } catch (err) {
          console.error('[Stripe webhook] signature invalide:', err.message);
          return sendJSON(res,{ received:false, error:'invalid_signature' }, 400);
        }
        try {
          if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
            const obj = event.data.object;
            const numero = (obj.metadata && obj.metadata.numero) || null;
            if (numero && USE_DB) {
              // 1. Marquer la commande comme payee — UNIQUEMENT si encore en attente
              //    (idempotence : un rejeu du webhook ne retrograde pas une commande deja expediee)
              await sb('orders?numero=eq.'+encodeURIComponent(numero)+'&statut=eq.'+encodeURIComponent('En attente paiement'),{ method:'PATCH', body:{
                payment_status:'Payee',
                payment_date: new Date().toISOString(),
                statut: 'Nouvelle'
              }});
              console.log('[Stripe webhook] Commande', numero, 'marquee payee');
              // 2. Envoyer l'email de confirmation au client AVEC le preview
              try {
                const rows = await sb('orders?numero=eq.'+encodeURIComponent(numero)+'&select=*');
                if (rows && rows[0]) {
                  const o = rows[0];
                  // Eviter double envoi : si deja envoye, on skip
                  if (!o.email_sent_at) {
                    const orderForEmail = {
                      client_nom: o.client_nom,
                      client_email: o.client_email,
                      telephone: o.telephone,
                      adresse_livraison: o.adresse_livraison,
                      cp_livraison: o.cp_livraison,
                      ville_livraison: o.ville_livraison,
                      pays_livraison: o.pays_livraison,
                      adresse_facturation: o.adresse_facturation,
                      cp_facturation: o.cp_facturation,
                      ville_facturation: o.ville_facturation,
                      pays_facturation: o.pays_facturation,
                      montant_total: o.montant_total,
                      preview: o.preview, // INCLUS dans l'email !
                      // Reconstruit items depuis items_data (JSONB) OU fallback sur initiales seules
                      items: Array.isArray(o.items_data) && o.items_data.length ? o.items_data : [{
                        nom:'La Pochette ELLIA', prix: o.montant_total,
                        initiales: o.initiales, finition: o.finition, emplacement: o.emplacement
                      }]
                    };
                    notifyNewOrder(orderForEmail, numero);
                    // Marquer comme envoye
                    await sb('orders?numero=eq.'+encodeURIComponent(numero),{ method:'PATCH', body:{ email_sent_at: new Date().toISOString() }});
                    console.log('[Stripe webhook] Email confirmation envoye a', o.client_email);
                    // Compter l'utilisation du code promo (uniquement sur paiement confirme)
                    if (o.promo_code && promoMod && promoMod.incrementPromoUsage) {
                      try { await promoMod.incrementPromoUsage(sb, o.promo_code); } catch(pe){ console.warn('Promo count KO:', pe.message); }
                    }
                  }
                }
              } catch(mailErr) {
                console.error('[Stripe webhook] erreur envoi mail:', mailErr.message);
              }
            }
          } else if (event.type === 'payment_intent.payment_failed' || event.type === 'checkout.session.expired') {
            const obj = event.data.object;
            const numero = (obj.metadata && obj.metadata.numero) || null;
            if (numero && USE_DB) {
              // Marquer echouee + RESTITUER le stock (decremente a la creation de commande)
              // Filtre payment_status : ne restituer qu'une fois (idempotence sur rejeu webhook)
              try {
                const rows = await sb('orders?numero=eq.'+encodeURIComponent(numero)+'&or=(payment_status.is.null,payment_status.neq.Echouee)&select=numero,quantite,statut');
                const ord = rows && rows[0];
                if (ord && String(ord.statut||'').includes('attente')) {
                  await sb('orders?numero=eq.'+encodeURIComponent(numero),{ method:'PATCH', body:{ payment_status:'Echouee' }});
                  const q = Math.max(1, Number(ord.quantite)||1);
                  await sb('rpc/adjust_stock',{ method:'POST', body:{
                    p_ref:'ELLIA-NOIR', p_delta:q, p_reason:'return',
                    p_notes:'Restitution auto — paiement echoue/expire ('+numero+')',
                    p_admin:'system', p_order:numero, p_source:'webhook'
                  }});
                  console.log('[Stripe webhook] Stock restitue (+'+q+') pour', numero);
                }
              } catch(se){ console.warn('[Stripe webhook] restitution stock KO:', se.message); }
            }
          }
        } catch(e) { console.error('[Stripe webhook] handler error:', e.message); }
        return sendJSON(res,{ received:true });
      }

      if (USE_DB && promoMod && req.method==='POST' && pathname==='/api/promo/validate'){
        if(!rateAllowed('promo', clientIp(req))) return sendJSON(res,{ valid:false, error:'rate' }, 429);
        const d = JSON.parse((await readBody(req))||'{}');
        try {
          const r = await promoMod.validatePromoCode(sb, d.code, Number(d.amount||0));
          return sendJSON(res, r);
        } catch(e){ return sendJSON(res,{ valid:false, error:'failed' },500); }
      }
      /* ----- PANIER ABANDONNE (capture) ----- */
      if (USE_DB && req.method==='POST' && pathname==='/api/abandoned-cart'){
        if(!rateAllowed('abandoned', clientIp(req))) return sendJSON(res,{ ok:false, error:'rate' }, 429);
        const d = JSON.parse((await readBody(req))||'{}');
        const email = String(d.email||'').toLowerCase().trim();
        if(!isEmail(email)) return sendJSON(res,{ ok:false, error:'invalid_email' }, 400);
        try {
          // Si meme email recent (<30 min) on update au lieu de creer
          const recent = await sb('abandoned_carts?email=eq.'+encodeURIComponent(email)+'&converted_at=is.null&created_at=gte.'+encodeURIComponent(new Date(Date.now()-30*60*1000).toISOString())+'&select=id');
          if (recent && recent.length) {
            await sb('abandoned_carts?id=eq.'+recent[0].id, { method:'PATCH', body:{
              cart_total: Number(d.cart_total||0),
              cart_data: d.cart_data || [],
              client_nom: clean(d.client_nom, 120),
              client_prenom: clean(d.client_prenom, 80)
            }});
          } else {
            await sb('abandoned_carts', { method:'POST', body:{
              email,
              cart_total: Number(d.cart_total||0),
              cart_data: d.cart_data || [],
              client_nom: clean(d.client_nom, 120),
              client_prenom: clean(d.client_prenom, 80)
            }});
          }
          return sendJSON(res,{ ok:true });
        } catch(e){ return sendJSON(res,{ ok:false, error:'failed' }, 500); }
      }

      const AUTH = getAuth(req);
      if (!AUTH) return sendJSON(res,{ error:'non autorise' },401);
      // Revalidation des comptes EQUIPE : un compte desactive/supprime/retrograde
      // perd son acces immediatement (cache 60 s pour ne pas marteler la base)
      if (AUTH.login !== 'principal' && USE_DB) {
        const now = Date.now();
        global.__userCache = global.__userCache || {};
        let cached = global.__userCache[AUTH.login];
        if (!cached || now - cached.at > 60*1000) {
          try {
            const rows = await sb('admin_users?login=eq.'+encodeURIComponent(AUTH.login)+'&select=role,actif');
            cached = { at: now, u: rows && rows[0] };
            global.__userCache[AUTH.login] = cached;
          } catch(_){ cached = cached || { at: now, u: null }; }
        }
        if (!cached.u || !cached.u.actif || cached.u.role !== AUTH.role) {
          return sendJSON(res,{ error:'session_revoquee' },401);
        }
      }
      const ROLE = AUTH.role;

      /* Qui suis-je (pour l'UI) */
      if (req.method==='GET' && pathname==='/api/me') return sendJSON(res,{ login:AUTH.login, role:ROLE });

      /* ----- CONTROLE D'ACCES PAR ROLE (whitelist) -----
         admin     : tout
         comptable : lecture financiere (stats, commandes, factures, compta, exports compta)
         atelier   : commandes SANS donnees financieres + maj statut/suivi          */
      if (ROLE === 'comptable') {
        const okComptable =
          (req.method==='GET' && (
            pathname==='/api/stats' || pathname==='/api/orders' ||
            pathname.startsWith('/api/admin/orders/') ||       // detail + facture PDF
            pathname==='/api/admin/compta' ||
            pathname==='/api/admin/export/recettes.csv' ||
            pathname==='/api/admin/export/factures.csv'
          ));
        if (!okComptable) return sendJSON(res,{ error:'acces_refuse', detail:'Compte comptable : lecture seule (commandes, compta, factures).' },403);
      }
      if (ROLE === 'atelier') {
        const okAtelier =
          (req.method==='GET' && (pathname==='/api/stats' || pathname==='/api/orders')) ||
          (req.method==='GET' && pathname.startsWith('/api/admin/orders/') && !pathname.endsWith('/invoice')) ||
          (req.method==='PATCH' && pathname.startsWith('/api/orders/'));
        if (!okAtelier) return sendJSON(res,{ error:'acces_refuse', detail:'Compte atelier : commandes et statuts uniquement.' },403);
      }

      if (req.method==='GET' && pathname==='/api/stats'){
        const s = await getStats();
        if (ROLE === 'atelier'){
          const copy = { ...s };
          for (const k of Object.keys(copy)) if (/^ca_|panier|revenu|montant/i.test(k)) delete copy[k];
          return sendJSON(res, copy);
        }
        return sendJSON(res, s);
      }
      if (req.method==='GET' && pathname==='/api/orders'){
        const list = await getOrders();
        return sendJSON(res, ROLE==='atelier' ? (list||[]).map(stripFinance) : list);
      }

      if (req.method==='PATCH' && pathname.startsWith('/api/orders/')){
        const numero = pathname.split('/').pop();
        let d = JSON.parse((await readBody(req))||'{}');
        // Atelier : seuls le statut, le suivi colis et les notes sont modifiables
        if (ROLE === 'atelier') {
          const allowed = {};
          for (const k of ['statut','suivi','transporteur','notes_admin']) if (d[k]!==undefined) allowed[k] = d[k];
          d = allowed;
        }
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
                // Envoi facture + repli : si le PDF echoue (module absent, erreur),
                // le client doit AU MOINS recevoir sa notification d'expedition + suivi.
                const inv = await sendInvoiceForOrder({ ...ord, numero });
                if (!inv || !inv.client) {
                  console.warn('[Expedition] Facture non envoyee pour', numero, '— repli sur email de statut');
                  notifyStatus(ord, numero, d.statut);
                }
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
        // Route via set_stock_absolute pour traquer dans stock_history
        try {
          await sb('rpc/set_stock_absolute',{ method:'POST', body:{
            p_ref: decodeURIComponent(ref),
            p_new_stock: stock,
            p_notes: 'Definition manuelle depuis admin',
            p_admin: 'admin'
          }});
        } catch(e) {
          return sendJSON(res,{ ok:false, error:'stock_update_failed', detail:String(e.message||e) }, 500);
        }
        return sendJSON(res,{ ok:true });
      }

      /* ===== STOCK PRO : ajustement avec motif + historique ===== */
      if (req.method==='POST' && pathname==='/api/admin/stock/adjust'){
        if(!isAuthed(req)) return sendJSON(res,{ error:'unauthorized' }, 401);
        if(!USE_DB) return sendJSON(res,{ ok:false, error:'no_db' }, 503);
        const d = JSON.parse((await readBody(req))||'{}');
        const ref = clean(d.ref, 60) || 'ELLIA-NOIR';
        const delta = Number(d.delta);
        const reason = clean(d.reason, 40);
        const notes = clean(d.notes, 500) || null;
        const validReasons = ['restock','return','loss','inventory_correction','manual_set'];
        if(!validReasons.includes(reason)) return sendJSON(res,{ ok:false, error:'invalid_reason' }, 400);
        if(!Number.isFinite(delta) || delta === 0) return sendJSON(res,{ ok:false, error:'invalid_delta' }, 400);
        if(Math.abs(delta) > 9999) return sendJSON(res,{ ok:false, error:'delta_too_large' }, 400);
        try {
          const r = await sb('rpc/adjust_stock',{ method:'POST', body:{
            p_ref: ref,
            p_delta: Math.round(delta),
            p_reason: reason,
            p_notes: notes,
            p_admin: 'admin',
            p_order: null,
            p_source: 'admin'
          }});
          const after = Array.isArray(r) ? (r[0] && (r[0].stock_after ?? r[0])) : (r && (r.stock_after ?? r));
          return sendJSON(res,{ ok:true, stock_after: after });
        } catch(e) {
          return sendJSON(res,{ ok:false, error:'rpc_failed', detail:String(e.message||e) }, 500);
        }
      }

      if (req.method==='GET' && pathname==='/api/admin/stock/history'){
        if(!isAuthed(req)) return sendJSON(res,{ error:'unauthorized' }, 401);
        if(!USE_DB) return sendJSON(res,{ rows:[], demo:true });
        const ref = (url.searchParams.get('ref') || 'ELLIA-NOIR').slice(0,60);
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit'))||50));
        const offset = Math.max(0, Number(url.searchParams.get('offset'))||0);
        let q = 'stock_history?product_ref=eq.'+encodeURIComponent(ref)+'&order=created_at.desc&limit='+limit+'&offset='+offset;
        const reasonFilter = url.searchParams.get('reason');
        if(reasonFilter){
          const allowed = ['restock','order_online','order_manual','return','loss','inventory_correction','manual_set'];
          if(allowed.includes(reasonFilter)) q += '&reason=eq.'+encodeURIComponent(reasonFilter);
        }
        try {
          const rows = await sb(q);
          // Stock courant
          const pr = await sb('products?ref=eq.'+encodeURIComponent(ref)+'&select=stock,seuil');
          const product = (pr && pr[0]) ? { stock: Number(pr[0].stock), seuil: Number(pr[0].seuil) } : { stock: 0, seuil: 0 };
          return sendJSON(res,{ ok:true, ref, product, rows: rows||[] });
        } catch(e) {
          return sendJSON(res,{ ok:false, error:'db', detail:String(e.message||e) }, 500);
        }
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

        // 3b) Decrement stock pour commande manuelle (traque dans stock_history)
        try {
          await sb('rpc/adjust_stock',{ method:'POST', body:{
            p_ref:'ELLIA-NOIR',
            p_delta: -quantite,
            p_reason: 'order_manual',
            p_notes: 'Commande manuelle '+numero,
            p_admin: null,
            p_order: numero,
            p_source: 'system'
          }});
        } catch(_) {}

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
        return sendJSON(res, ROLE==='atelier' ? stripFinance(o) : o);
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

      /* ----- EQUIPE — gestion des comptes admin (role admin uniquement, garanti par whitelists) ----- */
      if (req.method==='GET' && pathname==='/api/admin/users'){
        if(!USE_DB) return sendJSON(res,{ users:[] });
        try{
          const rows = await sb('admin_users?select=id,login,role,actif,created_at&order=created_at.asc');
          return sendJSON(res,{ users: rows||[] });
        }catch(e){ return sendJSON(res,{ error:'db' }, 500); }
      }
      if (req.method==='POST' && pathname==='/api/admin/users'){
        if(!USE_DB) return sendJSON(res,{ error:'no_db' }, 503);
        const d = JSON.parse((await readBody(req))||'{}');
        const login = clean(String(d.login||'').trim().toLowerCase(), 60);
        const password = String(d.password||'');
        const role = String(d.role||'');
        if (!/^[a-z0-9._-]{3,60}$/.test(login)) return sendJSON(res,{ error:'login_invalide', detail:'3-60 caractères : lettres, chiffres, points, tirets.' }, 400);
        if (password.length < 8) return sendJSON(res,{ error:'mdp_trop_court', detail:'8 caractères minimum.' }, 400);
        if (!['admin','comptable','atelier'].includes(role)) return sendJSON(res,{ error:'role_invalide' }, 400);
        const salt = crypto.randomBytes(16).toString('hex');
        try{
          await sb('admin_users',{ method:'POST', body:{ login, salt, password_hash: hashPassword(password, salt), role } });
          return sendJSON(res,{ ok:true });
        }catch(e){
          const msg = String(e.message||'');
          if (msg.includes('duplicate') || msg.includes('23505')) return sendJSON(res,{ error:'login_deja_pris' }, 409);
          return sendJSON(res,{ error:'db' }, 500);
        }
      }
      if (req.method==='PATCH' && pathname.startsWith('/api/admin/users/')){
        if(!USE_DB) return sendJSON(res,{ error:'no_db' }, 503);
        const uid = pathname.split('/').pop();
        if(!/^[0-9a-f-]{36}$/.test(uid)) return sendJSON(res,{ error:'bad_id' }, 400);
        const d = JSON.parse((await readBody(req))||'{}');
        const upd = {};
        if (d.actif !== undefined) upd.actif = !!d.actif;
        if (d.role !== undefined) {
          if (!['admin','comptable','atelier'].includes(d.role)) return sendJSON(res,{ error:'role_invalide' }, 400);
          upd.role = d.role;
        }
        if (d.password !== undefined) {
          if (String(d.password).length < 8) return sendJSON(res,{ error:'mdp_trop_court' }, 400);
          upd.salt = crypto.randomBytes(16).toString('hex');
          upd.password_hash = hashPassword(d.password, upd.salt);
        }
        if (!Object.keys(upd).length) return sendJSON(res,{ error:'rien_a_modifier' }, 400);
        try{
          await sb('admin_users?id=eq.'+uid, { method:'PATCH', body:upd });
          global.__userCache = {}; // revocation immediate (pas d'attente des 60 s de cache)
          return sendJSON(res,{ ok:true });
        }catch(e){ return sendJSON(res,{ error:'db' }, 500); }
      }
      if (req.method==='DELETE' && pathname.startsWith('/api/admin/users/')){
        if(!USE_DB) return sendJSON(res,{ error:'no_db' }, 503);
        const uid = pathname.split('/').pop();
        if(!/^[0-9a-f-]{36}$/.test(uid)) return sendJSON(res,{ error:'bad_id' }, 400);
        try{
          await sb('admin_users?id=eq.'+uid, { method:'DELETE' });
          global.__userCache = {}; // revocation immediate
          return sendJSON(res,{ ok:true });
        }catch(e){ return sendJSON(res,{ error:'db' }, 500); }
      }

      /* ----- AVIS — moderation admin ----- */
      if (req.method==='GET' && pathname==='/api/admin/reviews'){
        if(!USE_DB) return sendJSON(res,{ reviews:[] });
        try{
          const rows = await sb('reviews?select=id,prenom,email,note,titre,commentaire,validated,created_at&order=created_at.desc');
          return sendJSON(res,{ reviews: rows||[] });
        }catch(e){ return sendJSON(res,{ error:'db' }, 500); }
      }
      if (req.method==='PATCH' && pathname.startsWith('/api/admin/reviews/')){
        if(!USE_DB) return sendJSON(res,{ error:'no_db' }, 503);
        const rid = pathname.split('/').pop();
        if(!/^[0-9a-f-]{36}$/.test(rid)) return sendJSON(res,{ error:'bad_id' }, 400);
        const d = JSON.parse((await readBody(req))||'{}');
        try{
          await sb('reviews?id=eq.'+rid, { method:'PATCH', body:{ validated: !!d.validated } });
          return sendJSON(res,{ ok:true });
        }catch(e){ return sendJSON(res,{ error:'db' }, 500); }
      }
      if (req.method==='DELETE' && pathname.startsWith('/api/admin/reviews/')){
        if(!USE_DB) return sendJSON(res,{ error:'no_db' }, 503);
        const rid = pathname.split('/').pop();
        if(!/^[0-9a-f-]{36}$/.test(rid)) return sendJSON(res,{ error:'bad_id' }, 400);
        try{
          await sb('reviews?id=eq.'+rid, { method:'DELETE' });
          return sendJSON(res,{ ok:true });
        }catch(e){ return sendJSON(res,{ error:'db' }, 500); }
      }

      /* ----- NEWSLETTER — liste + export + suppression (admin) ----- */
      if (req.method==='GET' && pathname==='/api/admin/newsletter'){
        if(!USE_DB) return sendJSON(res,{ subscribers:[] });
        try{
          const rows = await sb('newsletters?select=id,email,created_at&order=created_at.desc');
          return sendJSON(res,{ subscribers: rows||[] });
        }catch(e){ return sendJSON(res,{ error:'db' }, 500); }
      }
      if (req.method==='GET' && pathname==='/api/admin/export/newsletter.csv'){
        if(!USE_DB) return sendJSON(res,{ error:'no_db' }, 503);
        try{
          const rows = await sb('newsletters?select=email,created_at&order=created_at.desc');
          const csv = 'email;date_inscription\n' + (rows||[]).map(r => r.email + ';' + String(r.created_at||'').slice(0,10)).join('\n');
          res.setHeader('Content-Type','text/csv; charset=utf-8');
          res.setHeader('Content-Disposition','attachment; filename="newsletter-abonnes.csv"');
          return res.end('﻿'+csv);
        }catch(e){ return sendJSON(res,{ error:'db' }, 500); }
      }
      if (req.method==='DELETE' && pathname.startsWith('/api/admin/newsletter/')){
        if(!USE_DB) return sendJSON(res,{ error:'no_db' }, 503);
        const nid = pathname.split('/').pop();
        if(!/^[0-9a-f-]{36}$/.test(nid)) return sendJSON(res,{ error:'bad_id' }, 400);
        try{
          await sb('newsletters?id=eq.'+nid, { method:'DELETE' });
          return sendJSON(res,{ ok:true });
        }catch(e){ return sendJSON(res,{ error:'db' }, 500); }
      }

      /* ----- CLIENTS — vue agregee depuis les commandes (admin) ----- */
      if (req.method==='GET' && pathname==='/api/admin/clients'){
        if(!USE_DB) return sendJSON(res,{ clients:[] });
        try{
          const rows = await sb('orders?select=client_nom,client_prenom,client_email,telephone,montant_total,statut,created_at&order=created_at.desc');
          const map = {};
          for (const o of (rows||[])) {
            const em = String(o.client_email||'').toLowerCase();
            if(!em) continue;
            if(!map[em]) map[em] = { email:em, nom:'', telephone:'', nb_commandes:0, total_depense:0, derniere_commande:null, statuts:{} };
            const c = map[em];
            c.nb_commandes++;
            // Ne compte pas les commandes annulees / en attente de paiement dans le total depense
            const st = String(o.statut||'').toLowerCase();
            if (!st.includes('annul') && !st.includes('attente')) c.total_depense += Number(o.montant_total||0);
            c.statuts[st] = (c.statuts[st]||0)+1;
            const nomComplet = ((o.client_prenom||'')+' '+(o.client_nom||'')).trim();
            if (nomComplet && !c.nom) c.nom = nomComplet;
            if (o.telephone && !c.telephone) c.telephone = o.telephone;
            if (!c.derniere_commande || o.created_at > c.derniere_commande) c.derniere_commande = o.created_at;
          }
          const clients = Object.values(map).sort((a,b) => b.total_depense - a.total_depense);
          return sendJSON(res,{ clients });
        }catch(e){ return sendJSON(res,{ error:'db' }, 500); }
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
  // Fichiers serveur / sensibles : JAMAIS servis publiquement
  const baseName = path.basename(file).toLowerCase();
  const SERVER_FILES = ['server.js','invoice.js','compta.js','promo.js','totp.js','package.json','package-lock.json'];
  if (SERVER_FILES.includes(baseName) || baseName.startsWith('.env') || baseName.endsWith('.bak') ||
      safe.includes('.git') || baseName.endsWith('.sql') || baseName.endsWith('.md')) {
    res.statusCode = 403; return res.end('Forbidden');
  }
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
    // Compression gzip pour les types texte (HTML/CSS/JS/JSON/SVG/XML) — divise le transfert par ~4
    const compressible = ['.html','.css','.js','.json','.svg','.xml','.txt'].includes(ext);
    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (compressible && acceptsGzip && buf.length > 1024) {
      res.setHeader('Vary','Accept-Encoding');
      // CACHE : on ne recompresse pas le meme fichier a chaque visite.
      // Cle = chemin + taille (change des que le fichier est modifie/redeploye).
      const key = file + '|' + buf.length + '|' + crypto.createHash('sha1').update(buf).digest('hex').slice(0,12);
      const hit = GZ_CACHE.get(key);
      if (hit) {
        res.setHeader('Content-Encoding','gzip');
        return res.end(hit);
      }
      zlib.gzip(buf, { level: 6 }, (zerr, zbuf) => {
        if (zerr) { res.end(buf); return; }
        if (GZ_CACHE.size >= GZ_CACHE_MAX) GZ_CACHE.delete(GZ_CACHE.keys().next().value);
        GZ_CACHE.set(key, zbuf);
        res.setHeader('Content-Encoding','gzip');
        res.end(zbuf);
      });
      return;
    }
    res.end(buf);
  });
});


/* ----- CRON INTERNE — relance panier abandonne (toutes les 10 min) ----- */
async function processAbandonedCarts(){
  if (!USE_DB || !transporter) return;
  try {
    const cutoff = new Date(Date.now() - 60*60*1000).toISOString(); // 1h
    const recent = new Date(Date.now() - 24*60*60*1000).toISOString(); // pas au-delà 24h
    const rows = await sb('abandoned_carts?reminder_sent_at=is.null&converted_at=is.null&created_at=lte.'+encodeURIComponent(cutoff)+'&created_at=gte.'+encodeURIComponent(recent)+'&select=*&limit=20');
    for (const c of (rows||[])) {
      const inner = '<h1 style="font-weight:normal;font-size:27px;margin:0 0 14px">Votre pochette vous attend</h1>' +
        '<p style="margin:0 0 12px">Bonjour ' + escH(c.client_prenom || '') + ',</p>' +
        '<p style="margin:0 0 14px">Nous avons remarqué que vous avez laissé un article dans votre panier. Souhaitez-vous finaliser votre commande ?</p>' +
        '<p style="margin:0 0 14px;font-size:14px;color:#56524c;font-family:Arial,sans-serif">Montant : <b style="font-family:Georgia,serif;color:#0d0d0d">' + euro(c.cart_total) + '</b></p>' +
        '<p style="margin:24px 0"><a href="https://ellia-paris.fr/panier.html" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;padding:14px 28px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase">Reprendre ma commande</a></p>' +
        '<p style="margin:24px 0 0;font-size:14px;color:#56524c;font-family:Arial,sans-serif">Avec soin,<br/>ELLIA PARIS</p>';
      sendMail(c.email, 'Votre pochette vous attend — ELLIA PARIS', emailLayout(inner));
      try { await sb('abandoned_carts?id=eq.'+c.id, { method:'PATCH', body:{ reminder_sent_at: new Date().toISOString() } }); } catch(_){}
    }
  } catch(e){ console.warn('Abandoned cart cron KO :', e.message); }
}
/* ============================================================
   DEMARRAGE — mode multi-processus (1 par coeur, max 4)
   Chaque processus sert les requetes en parallele : ~4x plus de
   visiteurs simultanes. Le CRON "panier abandonne" ne tourne QUE
   dans le processus chef, sinon chaque client recevrait 4 emails.
   ============================================================ */
function startServer(tag){
  server.listen(PORT, () => {
    console.log('ELLIA PARIS — http://localhost:' + PORT + (USE_DB ? '  [Supabase: ACTIF]' : '  [donnees DEMO]') + (tag||''));
  });
}

if (WORKERS > 1 && cluster.isPrimary) {
  console.log('ELLIA PARIS — demarrage de ' + WORKERS + ' processus (port ' + PORT + ')');
  console.log('Admin : /admin   (mot de passe : ' + (process.env.ADMIN_PASSWORD ? '****' : 'ellia2026 — A CHANGER') + ')');
  for (let i = 0; i < WORKERS; i++) cluster.fork();
  // Un processus qui tombe est immediatement remplace (auto-guerison)
  cluster.on('exit', (worker, code) => {
    console.warn('[cluster] processus ' + worker.process.pid + ' arrete (code ' + code + ') — relance');
    cluster.fork();
  });
  // CRON dans le chef uniquement (il ne sert aucune requete)
  if (USE_DB) setInterval(processAbandonedCarts, 10*60*1000);
} else {
  if (USE_DB && WORKERS === 1) setInterval(processAbandonedCarts, 10*60*1000);
  startServer(cluster.worker ? '  [processus ' + cluster.worker.id + '/' + WORKERS + ']' : '');
}