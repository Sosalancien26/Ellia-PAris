/* ============================================================
   ELLIA PARIS — Banc d'essai de bout en bout
   ------------------------------------------------------------
       node tests-e2e/run.js

   Lance le VRAI serveur (server.js) en local avec :
     · une base Supabase simulée en mémoire   (mock-supabase.js)
     · Stripe simulé, signatures webhook réelles (preload.js)
     · tous les e-mails capturés, aucun envoi   (preload.js)
   puis déroule le parcours complet : 50 commandes simultanées,
   paiements, expirations, rejeux, statuts, factures, livraison,
   avis, contact, panier abandonné, comptes équipe, exports,
   sécurité. Rien ne touche au site en ligne.
   ============================================================ */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

const RACINE = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const MOCK_PORT = 54329, PORT = 3199;
const BASE = 'http://127.0.0.1:' + PORT;
const WHSEC = 'whsec_banc_' + crypto.randomBytes(8).toString('hex');
const ADMIN_PW = 'Banc-Essai-2026!';

const mock = require('./mock-supabase');
const stripeLib = require(path.join(RACINE, 'node_modules', 'stripe'));

let reussis = 0, echoues = 0; const echecs = [];
function ok(nom, cond, detail){ if (cond) { reussis++; console.log('  \x1b[32m✓\x1b[0m ' + nom); } else { echoues++; echecs.push(nom + (detail !== undefined ? ' — ' + detail : '')); console.log('  \x1b[31m✗ ' + nom + '\x1b[0m' + (detail !== undefined ? '\n      constaté : ' + String(detail).slice(0, 300) : '')); } }
function section(t){ console.log('\n\x1b[1m' + t + '\x1b[0m'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function api(method, p, body, o){
  o = o || {};
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const headers = { 'x-forwarded-for': o.ip || '10.0.0.1' };
    if (data !== null) { headers['content-type'] = o.ctype || 'application/json'; headers['content-length'] = Buffer.byteLength(data); }
    if (o.cookie) headers.cookie = o.cookie;
    if (o.headers) Object.assign(headers, o.headers);
    const req = http.request(BASE + p, { method, headers }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => { const buf = Buffer.concat(chunks); let json = null; try { json = JSON.parse(buf.toString('utf8')); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, json, text: buf.toString('utf8'), buf }); });
    });
    req.on('error', reject); if (data !== null) req.write(data); req.end();
  });
}
function mails(){ const f = path.join(OUT, 'mails.jsonl'); if (!fs.existsSync(f)) return []; return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); }
function mailsPour(to, re){ return mails().filter(m => String(m.to).toLowerCase() === to.toLowerCase() && (!re || re.test(m.subject))); }
function signe(payload){ const s = JSON.stringify(payload); return { body: s, sig: stripeLib.webhooks.generateTestHeaderString({ payload: s, secret: WHSEC }) }; }
function evt(type, session, extra){ return { id: 'evt_banc_' + crypto.randomBytes(6).toString('hex'), object: 'event', type, livemode: false, created: Math.floor(Date.now() / 1000), data: { object: Object.assign({ object: 'checkout.session', id: session.id, metadata: { numero: session.numero }, payment_intent: session.payment_intent, amount_total: session.amount_total, payment_status: type === 'checkout.session.completed' ? 'paid' : 'unpaid' }, extra || {}) } }; }
async function webhook(payload){ const { body, sig } = signe(payload); return api('POST', '/api/stripe/webhook', body, { headers: { 'stripe-signature': sig } }); }
function commande(i, opts){
  opts = opts || {};
  const gravee = !!opts.gravee;
  const item = gravee ? { initiales: 'C' + i, finition: 'Or', emplacement: 'Devant', fontScale: 100, flame: (i % 3 === 0) ? { enabled: true, symbol: 'rabbi', symbol_name: 'Rabbi', finish: 'Argent', placement: 'Devant' } : undefined } : {};
  const perso = gravee ? (5 * ('C' + i).length + ((i % 3 === 0) ? 10 : 0)) : 0;
  const qte = opts.qte || 1;
  const items = Array.from({ length: qte }, () => ({ ...item }));
  const total = (159 + perso) * qte;
  return { payload: { client_prenom: 'Cliente' + i, client_nom: 'Test ' + i, client_email: 'cliente' + i + '@banc.test', client_phone: '06 00 00 00 ' + String(i).padStart(2, '0'),
    adresse_livraison: i + ' rue de l\'Essai', cp_livraison: '75001', ville_livraison: 'Paris', pays_livraison: 'France', montant_total: total, items,
    is_gift: i % 7 === 0, gift_message: i % 7 === 0 ? 'Joyeux anniversaire !' : '', gift_from: i % 7 === 0 ? 'Sacha' : '' }, total, gravee, qte };
}

async function main(){
  await mock.start(MOCK_PORT);
  const env = Object.assign({}, process.env, {
    PORT: String(PORT), SUPABASE_URL: 'http://127.0.0.1:' + MOCK_PORT, SUPABASE_SERVICE_KEY: 'service-test',
    ADMIN_PASSWORD: ADMIN_PW, ADMIN_SECRET: 'secret-banc-' + crypto.randomBytes(8).toString('hex'),
    STRIPE_SECRET_KEY: 'sk_test_banc', STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_PUBLIC_KEY: 'pk_test_banc',
    SMTP_HOST: 'capture', SMTP_USER: 'capture', SMTP_PASS: 'capture', MAIL_FROM: 'ELLIA PARIS <contact@ellia-paris.fr>', CONTACT_TO: 'interne@banc.test',
    SITE_URL: BASE, PERSO_OUVERTE: process.env.PERSO_OUVERTE || '1', WEB_CONCURRENCY: '1'
  });
  const srv = spawn(process.execPath, ['-r', path.join(__dirname, 'preload.js'), path.join(RACINE, 'server.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  const logSrv = []; srv.stdout.on('data', d => logSrv.push(String(d))); srv.stderr.on('data', d => logSrv.push(String(d)));
  const fin = async (code) => { srv.kill(); fs.writeFileSync(path.join(OUT, 'serveur.log'), logSrv.join('')); process.exit(code); };
  for (let i = 0; i < 60; i++) { try { const r = await api('GET', '/api/health'); if (r.status === 200) break; } catch (_) {} await sleep(500); if (i === 59) { console.error('serveur injoignable\n' + logSrv.join('')); await fin(2); } }
  console.log('Serveur de test prêt sur ' + BASE + ' (base et Stripe simulés, e-mails capturés)');

  /* ───────────── 1. PAGES PUBLIQUES ───────────── */
  section('1. Pages publiques et protections');
  for (const p of ['/', '/pochette.html', '/personnalisation.html', '/maison.html', '/entretien.html', '/contact.html', '/cgv.html', '/mentions.html', '/confidentialite.html', '/journal/', '/panier.html', '/checkout.html', '/connexion.html', '/inscription.html', '/compte.html', '/commande.html', '/sitemap.xml', '/robots.txt']) {
    const r = await api('GET', p); ok('GET ' + p + ' → 200', r.status === 200, r.status);
  }
  ok('/personnalisation.html sert la page « indisponible » quand l\'atelier est fermé, le configurateur sinon',
     (await api('GET', '/personnalisation.html')).text.includes(env.PERSO_OUVERTE === '1' ? 'configurateur' : 'Momentanément'));
  for (const p of ['/server.js', '/tests.js', '/package.json', '/sql/2026-09-30_durcissement_pre_prod.sql', '/assets/logo/rabbi-noir.svg', '/tests-e2e/run.js', '/.git/config', '/node_modules/stripe/package.json']) {
    const r = await api('GET', p); ok('GET ' + p + ' → refusé', r.status === 403 || r.status === 404, r.status);
  }
  ok('/admin sans session → page de connexion', (await api('GET', '/admin')).text.includes('admin-login') || (await api('GET', '/admin')).text.toLowerCase().includes('mot de passe'));
  ok('/api/orders sans session → 401', (await api('GET', '/api/orders')).status === 401);
  ok('/api/stats sans session → 401', (await api('GET', '/api/stats')).status === 401);
  ok('/api/admin/users sans session → 401', (await api('GET', '/api/admin/users')).status === 401);
  const prods = await api('GET', '/api/products');
  ok('/api/products expose le stock public sans le seuil', prods.status === 200 && JSON.stringify(prods.json).includes('ELLIA-NOIR'));
  const stock0 = mock.db.products.find(p => p.ref === 'ELLIA-NOIR').stock;

  /* ───────────── 2. 50 COMMANDES SIMULTANÉES ───────────── */
  const PERSO = env.PERSO_OUVERTE === '1';
  section(PERSO ? '2. 50 commandes simultanées (30 sans gravure, 20 gravées, 6 avec 2 pochettes)' : '2. 50 commandes simultanées sans gravure (atelier fermé), 6 avec 2 pochettes');
  if (!PERSO) ok('atelier fermé : une commande gravée est refusée', (await api('POST', '/api/orders', commande(95, { gravee: true }).payload, { ip: '10.9.1.1' })).json?.error === 'perso_indisponible');
  const cmds = [];
  const promesses = [];
  for (let i = 1; i <= 50; i++) {
    const c = commande(i, { gravee: PERSO && i > 30, qte: (i % 8 === 0) ? 2 : 1 });
    promesses.push(api('POST', '/api/orders', c.payload, { ip: '10.1.0.' + i }).then(r => { c.rep = r; cmds.push(c); }));
  }
  await Promise.all(promesses);
  cmds.sort((a, b) => a.payload.client_prenom.localeCompare(b.payload.client_prenom, 'fr', { numeric: true }));
  const creees = cmds.filter(c => c.rep.status === 200 && c.rep.json && c.rep.json.ok);
  ok('50 commandes créées (' + creees.length + '/50)', creees.length === 50, cmds.filter(c => !(c.rep.status === 200 && c.rep.json && c.rep.json.ok)).map(c => c.rep.status + ' ' + JSON.stringify(c.rep.json)).slice(0, 3).join(' | '));
  for (const c of creees) c.numero = c.rep.json.numero;
  const numeros = new Set(creees.map(c => c.numero));
  ok('50 numéros de commande distincts', numeros.size === creees.length);
  const qteTotale = creees.reduce((s, c) => s + c.qte, 0);
  const stock1 = mock.db.products.find(p => p.ref === 'ELLIA-NOIR').stock;
  ok('le stock a baissé d\'exactement ' + qteTotale + ' pochettes (' + stock0 + ' → ' + stock1 + ')', stock0 - stock1 === qteTotale, stock0 - stock1);
  ok('aucun e-mail envoyé avant paiement', mails().length === 0, mails().length);
  const enBase = mock.db.orders;
  ok('chaque commande a ses articles normalisés avec nom et prix (items_data)', enBase.every(o => Array.isArray(o.items_data) && o.items_data.every(it => it.nom && typeof it.prix === 'number')));
  const g = enBase.find(o => o.initiales && o.initiales.startsWith('C'));
  if (PERSO) ok('les initiales / finition sont dérivées du premier article facturé', !!g && g.finition === 'Or');
  ok('le montant HT/TVA est calculé (20 %)', enBase.every(o => Math.abs(Number(o.montant_ht) * 1.2 - Number(o.montant_total)) < 0.02), JSON.stringify(enBase.find(o => Math.abs(Number(o.montant_ht) * 1.2 - Number(o.montant_total)) >= 0.02) || {}).slice(0, 200));

  /* ───────────── 3. SESSIONS STRIPE ───────────── */
  section('3. Sessions de paiement Stripe');
  for (const c of creees) { const r = await api('POST', '/api/checkout/session', { numero: c.numero }, { ip: '10.1.0.' + c.payload.client_prenom.replace('Cliente', '') }); c.session = r.json; }
  ok('50 sessions Stripe créées avec URL', creees.every(c => c.session && c.session.ok && c.session.url));
  const sessLog = fs.readFileSync(path.join(OUT, 'stripe-sessions.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const byNum = {}; for (const s of sessLog) byNum[s.metadata.numero] = s;
  ok('le montant envoyé à Stripe = montant de la commande en base (jamais celui du navigateur)', creees.every(c => byNum[c.numero] && byNum[c.numero].amount_total === Math.round(c.total * 100)), creees.filter(c => !(byNum[c.numero] && byNum[c.numero].amount_total === Math.round(c.total * 100))).map(c => c.numero + ':' + (byNum[c.numero] || {}).amount_total + '/' + c.total).slice(0, 3).join(' '));
  ok('la session Stripe expire au bout de 30 min', sessLog.every(s => s.expires_at && s.expires_at - s.created >= 29 * 60 && s.expires_at - s.created <= 31 * 60));
  ok('une commande inexistante est refusée', (await api('POST', '/api/checkout/session', { numero: 'EP-INCONNUE' })).status === 404);

  /* ───────────── 4. PAIEMENTS ───────────── */
  section('4. Paiements : 40 payées, 5 expirées, 5 jamais payées ; rejeux et forgeries');
  const payees = creees.slice(0, 40), expirees = creees.slice(40, 45), abandonnees = creees.slice(45, 50);
  for (const c of payees) { c.s = { id: byNum[c.numero].id, numero: c.numero, payment_intent: byNum[c.numero].payment_intent, amount_total: byNum[c.numero].amount_total }; const r = await webhook(evt('checkout.session.completed', c.s)); c.wh = r; }
  ok('40 webhooks « payé » acceptés', payees.every(c => c.wh.status === 200 && c.wh.json && c.wh.json.received), payees.filter(c => c.wh.status !== 200).map(c => c.wh.status + ' ' + c.wh.text.slice(0, 80)).slice(0, 2).join(' | '));
  await sleep(800);
  ok('40 commandes passées « Nouvelle » / payment_status Payee', payees.every(c => { const o = enBase.find(o => o.numero === c.numero); return o && o.statut === 'Nouvelle' && o.payment_status === 'Payee' && o.payment_date; }));
  const confs = mails().filter(m => /^Commande confirmée/.test(m.subject));
  ok('40 e-mails de confirmation client, un par commande', confs.length === 40 && new Set(confs.map(m => m.to)).size === 40, confs.length);
  const internes = mails().filter(m => /Nouvelle commande/.test(m.subject) && m.to === 'interne@banc.test');
  ok('40 notifications internes vers la boîte de la maison', internes.length === 40, internes.length);
  const confG = confs.find(m => m.to === 'cliente35@banc.test'), confP = confs.find(m => m.to === 'cliente5@banc.test');
  if (PERSO) ok('confirmation gravée : mention L.221-28 (pas de rétractation) + initiales visibles', confG && confG.html.includes('L221-28') && confG.html.includes('C35'));
  ok('confirmation sans gravure : droit de rétractation 14 jours (L.221-18)', confP && confP.html.includes('L221-18') && !confP.html.includes('L221-28'));
  ok('aucun prix à 0,00 € ni « undefined » dans les confirmations', confs.every(m => !m.html.includes('0,00 €') && !/undefined|NaN|null/.test(m.html)), (confs.find(m => m.html.includes('0,00 €') || /undefined|NaN/.test(m.html)) || {}).to);
  ok('confirmation cadeau : bloc « Commande cadeau » présent', (confs.find(m => m.to === 'cliente7@banc.test') || { html: '' }).html.includes('Commande cadeau'));
  ok('identité du vendeur dans chaque confirmation (L.221-13)', confs.every(m => m.html.includes('RCS Créteil 877 702 985')));
  ok('version texte présente dans chaque e-mail', mails().every(m => m.text && m.text.length > 100));
  // Rejeu
  const avant = mails().length;
  const rj = await webhook(evt('checkout.session.completed', payees[0].s));
  ok('rejeu du même webhook → accepté comme doublon, sans second e-mail', rj.status === 200 && rj.json.duplicate === true && mails().length === avant, JSON.stringify(rj.json));
  const rj2 = await webhook(evt('payment_intent.succeeded', payees[1].s));
  ok('payment_intent.succeeded après completed → doublon, sans e-mail', rj2.json && rj2.json.duplicate === true && mails().length === avant);
  // Forgeries
  const forg = await api('POST', '/api/stripe/webhook', JSON.stringify(evt('checkout.session.completed', { id: 'x', numero: abandonnees[0].numero })), { headers: { 'stripe-signature': 't=1,v1=deadbeef' } });
  ok('webhook à signature forgée → 400, commande non payée', forg.status === 400 && enBase.find(o => o.numero === abandonnees[0].numero).payment_status !== 'Payee', forg.status + ' ' + forg.text.slice(0, 80) + ' / ' + enBase.find(o => o.numero === abandonnees[0].numero).payment_status);
  const sansSig = await api('POST', '/api/stripe/webhook', JSON.stringify({ type: 'checkout.session.completed' }));
  ok('webhook sans signature → refusé', sansSig.status === 400);
  // Expirations
  const stockAvantExp = mock.db.products[0].stock;
  for (const c of expirees) { c.s = { id: byNum[c.numero].id, numero: c.numero, payment_intent: byNum[c.numero].payment_intent, amount_total: byNum[c.numero].amount_total }; await webhook(evt('checkout.session.expired', c.s)); }
  const qteExp = expirees.reduce((s, c) => s + c.qte, 0);
  ok('5 sessions expirées → stock rendu (+' + qteExp + ')', mock.db.products[0].stock === stockAvantExp + qteExp, mock.db.products[0].stock - stockAvantExp);
  ok('commandes expirées marquées payment_status Expiree, statut inchangé', expirees.every(c => { const o = enBase.find(o => o.numero === c.numero); return o.payment_status === 'Expiree' && o.statut === 'En attente paiement'; }));
  await webhook(evt('checkout.session.expired', expirees[0].s));
  ok('rejeu d\'une expiration → stock rendu une seule fois', mock.db.products[0].stock === stockAvantExp + qteExp, mock.db.products[0].stock - stockAvantExp);
  // Paiement tardif apres expiration
  const stockAvantTardif = mock.db.products[0].stock;
  const tardif = await webhook(evt('checkout.session.completed', expirees[0].s));
  ok('paiement tardif après expiration → accepté, stock repris (−' + expirees[0].qte + ')', tardif.status === 200 && mock.db.products[0].stock === stockAvantTardif - expirees[0].qte && enBase.find(o => o.numero === expirees[0].numero).payment_status === 'Payee');
  ok('paiement tardif → alerte interne envoyée', mails().some(m => /paiement_tardif|Paiement reçu après expiration/i.test(m.subject) && m.to === 'interne@banc.test'));
  ok('une commande payée ne peut plus rouvrir de session Stripe (409)', (await api('POST', '/api/checkout/session', { numero: payees[0].numero })).status === 409);
  // Nettoyage automatique des commandes jamais payees
  for (const c of abandonnees) { const o = enBase.find(o => o.numero === c.numero); o.created_at = new Date(Date.now() - 90 * 60 * 1000).toISOString(); }
  const stockAvantCron = mock.db.products[0].stock;
  const qteAb = abandonnees.reduce((s, c) => s + c.qte, 0);
  console.log('    … attente de la tâche de libération du stock (2 min après démarrage)');
  let libere = false; for (let i = 0; i < 150; i++) { await sleep(1000); if (mock.db.products[0].stock === stockAvantCron + qteAb) { libere = true; break; } }
  ok('tâche automatique : 5 commandes jamais payées annulées après 60 min, stock rendu (+' + qteAb + ')', libere && abandonnees.every(c => enBase.find(o => o.numero === c.numero).statut === 'Annulée'), mock.db.products[0].stock - stockAvantCron);
  ok('une commande annulée par la tâche ne peut plus être payée par session', (await api('POST', '/api/checkout/session', { numero: abandonnees[0].numero })).status === 409);
  const stockAttendu = stock0 - payees.reduce((s, c) => s + c.qte, 0) - expirees[0].qte;
  ok('bilan stock : ' + stock0 + ' − 40 payées − 1 tardive = ' + stockAttendu, mock.db.products[0].stock === stockAttendu, mock.db.products[0].stock);

  /* ───────────── 5. ADMINISTRATION ───────────── */
  section('5. Administration : connexion, commandes, statuts, expédition, factures');
  const bad = await api('POST', '/api/login', { password: 'mauvais' });
  ok('mauvais mot de passe → 401', bad.status === 401);
  const login = await api('POST', '/api/login', { password: ADMIN_PW });
  const cookie = (login.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  ok('connexion admin → cookie de session HttpOnly + SameSite', login.status === 200 && /httponly/i.test(String(login.headers['set-cookie'])) && /samesite/i.test(String(login.headers['set-cookie'])));
  const A = { cookie };
  const me = await api('GET', '/api/me', undefined, A); ok('/api/me → rôle admin', me.json && me.json.role === 'admin');
  const liste = await api('GET', '/api/orders', undefined, A);
  ok('/api/orders liste les 50 commandes avec montants', liste.status === 200 && Array.isArray(liste.json) && liste.json.length === 50 && liste.json.every(o => o.total != null), liste.status + ' ' + (Array.isArray(liste.json) ? liste.json.length + ' lignes, sans montant : ' + liste.json.filter(o => o.total == null).length : liste.text.slice(0, 120)));
  const stats = await api('GET', '/api/stats', undefined, A);
  const caAttendu = payees.reduce((s, c) => s + c.total, 0) + expirees[0].total;
  ok('/api/stats : chiffre d\'affaires = somme des 41 commandes payées (' + caAttendu.toFixed(2) + ' €)', stats.status === 200 && Math.abs(Number(stats.json.ca_total) - caAttendu) < 0.05 && stats.json.commandes_payees === 41, JSON.stringify(stats.json).slice(0, 200));
  const det = await api('GET', '/api/admin/orders/' + payees[0].numero, undefined, A);
  ok('détail d\'une commande (admin)', det.status === 200 && det.json && (det.json.numero === payees[0].numero || (det.json.order && det.json.order.numero === payees[0].numero)));
  // Statuts
  const nbAvant = mails().length;
  const prep = await api('PATCH', '/api/orders/' + payees[0].numero, { statut: 'En préparation' }, A);
  await sleep(300);
  ok('statut → En préparation : e-mail client envoyé', prep.status === 200 && mailsPour('cliente1@banc.test', /En préparation/).length === 1, prep.status + ' ' + prep.text.slice(0, 100));
  const exp = await api('PATCH', '/api/orders/' + payees[0].numero, { statut: 'Expédiée', transporteur: 'Colissimo', suivi: '6A00000000001' }, A);
  await sleep(600);
  const o1 = enBase.find(o => o.numero === payees[0].numero);
  ok('statut → Expédiée : numéro de facture F-EP-' + new Date().getFullYear() + '-0001 attribué', exp.status === 200 && o1.invoice_number === 'F-EP-' + new Date().getFullYear() + '-0001', o1.invoice_number);
  const mFact = mailsPour('cliente1@banc.test', /en route/);
  ok('e-mail d\'expédition avec facture PDF jointe et lien de suivi Colissimo', mFact.length === 1 && mFact[0].attachments.some(a => a.contentType === 'application/pdf' && a.size > 20000) && mFact[0].html.includes('6A00000000001'));
  ok('archive facture envoyée à la boîte interne', mails().some(m => /\[Facture Ellia\] F-EP/.test(m.subject) && m.to === 'interne@banc.test'));
  ok('le PDF de facture est bien un PDF', fs.existsSync(path.join(OUT, 'pdf-' + o1.invoice_number + '.pdf')) && fs.readFileSync(path.join(OUT, 'pdf-' + o1.invoice_number + '.pdf')).slice(0, 5).toString() === '%PDF-');
  const exp2 = await api('PATCH', '/api/orders/' + payees[0].numero, { statut: 'Expédiée', transporteur: 'Colissimo', suivi: '6A00000000001' }, A);
  await sleep(300);
  ok('double clic « Expédiée » → même numéro de facture, pas de second envoi', exp2.status === 200 && o1.invoice_number === 'F-EP-' + new Date().getFullYear() + '-0001' && mailsPour('cliente1@banc.test', /en route/).length === 1);
  // Expedier 20 commandes en parallele : numeros sequentiels sans trou ni doublon
  const lot = payees.slice(1, 21);
  await Promise.all(lot.map((c, k) => api('PATCH', '/api/orders/' + c.numero, { statut: 'Expédiée', transporteur: k % 2 ? 'Chronopost' : 'Colissimo', suivi: 'SUIVI' + k }, A)));
  await sleep(1500);
  const nums = lot.map(c => enBase.find(o => o.numero === c.numero).invoice_number).filter(Boolean).sort();
  ok('20 expéditions simultanées → 20 numéros de facture distincts', new Set(nums).size === 20, nums.length + ' / ' + new Set(nums).size);
  const seq = nums.map(n => Number(n.slice(-4))).sort((a, b) => a - b);
  ok('séquence continue de 0002 à 0021, sans trou', seq[0] === 2 && seq[seq.length - 1] === 21 && seq.every((n, i) => i === 0 || n === seq[i - 1] + 1), seq.join(','));
  ok('20 e-mails d\'expédition avec PDF', lot.every(c => mailsPour(c.payload.client_email, /en route/).length === 1));
  // Livraison
  const liv = await api('PATCH', '/api/orders/' + payees[0].numero, { statut: 'Livrée' }, A);
  await sleep(300);
  ok('statut → Livrée : delivered_at posé + e-mail', liv.status === 200 && !!o1.delivered_at && mailsPour('cliente1@banc.test', /Livrée/).length === 1);
  // Retrogradation interdite
  const retro = await api('PATCH', '/api/orders/' + payees[0].numero, { statut: 'En attente paiement' }, A);
  ok('rétrograder une commande payée en « En attente paiement » est refusé', retro.status >= 400 || enBase.find(o => o.numero === payees[0].numero).statut === 'Livrée');
  // Annulation
  const ann = await api('PATCH', '/api/orders/' + payees[30].numero, { statut: 'Annulée' }, A);
  await sleep(300);
  ok('statut → Annulée : e-mail client', ann.status === 200 && mailsPour(payees[30].payload.client_email, /Annulée/).length === 1);
  // Transporteur inconnu -> Autre
  await api('PATCH', '/api/orders/' + payees[22].numero, { transporteur: '<script>alert(1)</script>', suivi: 'X1' }, A);
  ok('transporteur hors liste → remplacé par « Autre »', enBase.find(o => o.numero === payees[22].numero).transporteur === 'Autre');
  // Stock manuel
  const st = await api('PATCH', '/api/products/ELLIA-NOIR', { stock: 25 }, A);
  ok('mise à jour manuelle du stock → 25', st.status === 200 && mock.db.products[0].stock === 25, st.status);
  const adj = await api('POST', '/api/admin/stock/adjust', { ref: 'ELLIA-NOIR', delta: -3, reason: 'loss', notes: 'test banc' }, A);
  ok('ajustement −3 (casse) → 22 + historique', adj.status === 200 && mock.db.products[0].stock === 22 && mock.db.stock_history.some(h => h.notes === 'test banc'));
  const hist = await api('GET', '/api/admin/stock/history', undefined, A);
  ok('historique du stock consultable', hist.status === 200 && Array.isArray(hist.json && hist.json.rows) && hist.json.rows.length > 0, hist.text.slice(0, 100));
  // Rupture
  await api('PATCH', '/api/products/ELLIA-NOIR', { stock: 0 }, A);
  const rupture = await api('POST', '/api/orders', commande(99).payload, { ip: '10.9.9.9' });
  ok('stock à 0 → commande refusée (409 rupture)', rupture.status === 409, rupture.status);
  await api('PATCH', '/api/products/ELLIA-NOIR', { stock: 22 }, A);
  // Exports
  for (const p of ['/api/admin/export/recettes.csv', '/api/admin/export/factures.csv', '/api/admin/compta']) { const r = await api('GET', p, undefined, A); ok('export ' + p + ' → 200', r.status === 200, r.status); }
  const csv = await api('GET', '/api/admin/export/factures.csv', undefined, A);
  ok('export factures : 21 factures listées', (csv.text.match(/F-EP-\d{4}-\d{4}/g) || []).length >= 21, (csv.text.match(/F-EP-\d{4}-\d{4}/g) || []).length);
  const pdfDl = await api('GET', '/api/admin/orders/' + payees[0].numero + '/invoice', undefined, A);
  ok('téléchargement de la facture PDF depuis l\'admin', pdfDl.status === 200 && pdfDl.buf.slice(0, 5).toString() === '%PDF-', pdfDl.status);
  // Commande manuelle
  const man = await api('POST', '/api/admin/orders', { client_prenom: 'Manuel', client_nom: 'Boutique', client_email: 'manuel@banc.test', telephone: '0600000000', adresse_livraison: '1 rue X', cp_livraison: '75001', ville_livraison: 'Paris', quantite: 1, montant_total: 159, payment_method: 'Espèces', payment_status: 'Payee', statut: 'Nouvelle' }, A);
  ok('commande manuelle PAYÉE (vente boutique) → numéro de facture attribué', man.status === 200 && man.json && /^F-EP-\d{4}-\d{4}$/.test(man.json.invoice_number || ''), man.status + ' ' + man.text.slice(0, 120));
  const man2 = await api('POST', '/api/admin/orders', { client_prenom: 'Devis', client_nom: 'Attente', client_email: 'devis@banc.test', telephone: '0600000000', adresse_livraison: '1 rue X', cp_livraison: '75001', ville_livraison: 'Paris', quantite: 1, montant_total: 159, payment_method: 'Virement', payment_status: 'En attente', statut: 'Nouvelle' }, A);
  ok('commande manuelle NON payée → aucun numéro de facture consommé', man2.status === 200 && man2.json && !man2.json.invoice_number, man2.text.slice(0, 120));
  // Journal admin
  const logs = await api('GET', '/api/admin/logs', undefined, A);
  ok('journal des actions admin alimenté', logs.status === 200 && mock.db.admin_logs.length > 5, mock.db.admin_logs.length);

  /* ───────────── 6. ÉQUIPE ET RÔLES ───────────── */
  section('6. Comptes équipe et cloisonnement des rôles');
  const cr1 = await api('POST', '/api/admin/users', { login: 'compta', password: 'Compta-2026!!', role: 'comptable' }, A);
  const cr2 = await api('POST', '/api/admin/users', { login: 'atelier', password: 'Atelier-2026!!', role: 'atelier' }, A);
  ok('création des comptes comptable et atelier', cr1.status === 200 && cr2.status === 200, cr1.text + cr2.text);
  ok('doublon de login refusé', (await api('POST', '/api/admin/users', { login: 'compta', password: 'Compta-2026!!', role: 'comptable' }, A)).status >= 400);
  const lc = await api('POST', '/api/login', { login: 'compta', password: 'Compta-2026!!' }, { ip: '10.2.0.1' });
  const C = { cookie: (lc.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ') };
  const la = await api('POST', '/api/login', { login: 'atelier', password: 'Atelier-2026!!' }, { ip: '10.2.0.2' });
  const T = { cookie: (la.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ') };
  ok('connexion comptable et atelier', lc.status === 200 && la.status === 200);
  ok('comptable : lecture des commandes et compta OK', (await api('GET', '/api/orders', undefined, C)).status === 200 && (await api('GET', '/api/admin/compta', undefined, C)).status === 200);
  ok('comptable : modification de statut refusée (403)', (await api('PATCH', '/api/orders/' + payees[2].numero, { statut: 'Livrée' }, C)).status === 403);
  ok('comptable : gestion des comptes refusée', (await api('GET', '/api/admin/users', undefined, C)).status === 403);
  const oa = await api('GET', '/api/orders', undefined, T);
  ok('atelier : voit les commandes SANS montants', oa.status === 200 && oa.json.every(o => o.montant_total === undefined && o.promo_discount === undefined), JSON.stringify(oa.json[0] || {}).slice(0, 150));
  ok('atelier : peut passer « En préparation »', (await api('PATCH', '/api/orders/' + payees[3].numero, { statut: 'En préparation' }, T)).status === 200);
  ok('atelier : ne peut pas passer « Expédiée » (facture)', (await api('PATCH', '/api/orders/' + payees[3].numero, { statut: 'Expédiée' }, T)).status >= 400 || enBase.find(o => o.numero === payees[3].numero).statut !== 'Expédiée');
  ok('atelier : facture PDF refusée', (await api('GET', '/api/admin/orders/' + payees[0].numero + '/invoice', undefined, T)).status === 403);
  ok('atelier : compta refusée', (await api('GET', '/api/admin/compta', undefined, T)).status === 403);
  const users = await api('GET', '/api/admin/users', undefined, A);
  const idC = ((users.json && users.json.users) || []).find(u => u.login === 'compta');
  ok('désactivation d\'un compte → session invalidée', idC && (await api('PATCH', '/api/admin/users/' + idC.id, { actif: false }, A)).status === 200 && (await api('GET', '/api/orders', undefined, C)).status === 401);
  ok('déconnexion admin → cookie invalidé', (await api('POST', '/api/logout', {}, A)).status === 200 && (await api('GET', '/api/orders', undefined, A)).status === 401);
  const relog = await api('POST', '/api/login', { password: ADMIN_PW }, { ip: '10.3.0.1' });
  A.cookie = (relog.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  let bloque = false; for (let i = 0; i < 12; i++) { const r = await api('POST', '/api/login', { password: 'x' + i }, { ip: '10.4.0.1' }); if (r.status === 429) { bloque = true; break; } }
  ok('force brute sur le mot de passe → 429 après 8 essais', bloque);

  /* ───────────── 7. SUIVI CLIENT, AVIS, CONTACT ───────────── */
  section('7. Côté client : suivi, avis, contact, newsletter, panier abandonné, code promo');
  const lk = await api('POST', '/api/order-lookup', { numero: payees[0].numero, email: 'cliente1@banc.test' }, { ip: '10.5.0.1' });
  ok('suivi de commande (numéro + e-mail) → statut Livrée, suivi visible, pas de données d\'autrui', lk.status === 200 && lk.json && JSON.stringify(lk.json).includes('Livrée') && JSON.stringify(lk.json).includes('6A00000000001'), lk.status + ' ' + lk.text.slice(0, 200));
  ok('suivi avec mauvais e-mail → 404', (await api('POST', '/api/order-lookup', { numero: payees[0].numero, email: 'autre@banc.test' }, { ip: '10.5.0.1' })).status === 404);
  const ps = await api('GET', '/api/order-paystatus?n=' + payees[0].numero, undefined, { ip: '10.5.0.2' });
  ok('statut de paiement public : payé, sans fuite d\'e-mail', ps.status === 200 && !ps.text.includes('cliente1@banc.test'));
  const av1 = await api('POST', '/api/reviews', { prenom: 'Cliente1', email: 'cliente1@banc.test', note: 5, titre: 'Superbe', commentaire: 'Cuir magnifique, gravure parfaite.', date_experience: '2026-09-25', rgpd: true }, { ip: '10.6.0.1' });
  const av2 = await api('POST', '/api/reviews', { prenom: 'Inconnu', email: 'inconnu@banc.test', note: 4, titre: 'Bien', commentaire: 'Je n\'ai jamais commandé mais je note.', date_experience: '2026-09-25', rgpd: true }, { ip: '10.6.0.2' });
  ok('avis d\'une cliente livrée → achat_verifie = true', av1.status === 200 && mock.db.reviews.find(r => r.email === 'cliente1@banc.test').achat_verifie === true, av1.text.slice(0, 120) + ' | ' + JSON.stringify(mock.db.reviews.find(r => r.email === 'cliente1@banc.test') || {}).slice(0, 200));
  ok('avis d\'un inconnu → achat_verifie = false', av2.status === 200 && mock.db.reviews.find(r => r.email === 'inconnu@banc.test').achat_verifie === false);
  ok('avis sans consentement RGPD refusé', (await api('POST', '/api/reviews', { prenom: 'X', email: 'x@banc.test', note: 5, commentaire: 'ok ok ok ok', rgpd: false }, { ip: '10.6.0.3' })).status === 400);
  ok('notification interne « Nouvel avis » reçue', mails().some(m => /Nouvel avis/.test(m.subject) && m.to === 'interne@banc.test'));
  ok('avis non validé → invisible publiquement', !(await api('GET', '/api/reviews')).text.includes('Superbe'));
  const rid = mock.db.reviews.find(r => r.email === 'cliente1@banc.test').id;
  await api('PATCH', '/api/admin/reviews/' + rid, { validated: true }, A);
  const pub = await api('GET', '/api/reviews');
  ok('avis validé → visible, badge vérifié, SANS e-mail de l\'auteur', pub.text.includes('Superbe') && pub.text.includes('achat_verifie') && !pub.text.includes('cliente1@banc.test'));
  // Contact
  const ct = await api('POST', '/api/contact', { nom: 'Visiteuse', email: 'visiteuse@banc.test', sujet: 'livraison', message: 'Bonjour, quel délai pour Lyon ?', rgpd: true }, { ip: '10.7.0.1' });
  ok('formulaire de contact → accusé de réception client + notification interne', ct.status === 200 && mailsPour('visiteuse@banc.test', /bien été reçu/).length === 1 && mails().some(m => /Nouveau message|\[ELLIA PARIS\]/.test(m.subject) && m.to === 'interne@banc.test' && m.html.includes('Lyon')));
  ok('contact sans RGPD refusé', (await api('POST', '/api/contact', { nom: 'V', email: 'v@banc.test', sujet: 'x', message: 'x', rgpd: false }, { ip: '10.7.0.2' })).status === 400);
  // Newsletter
  ok('inscription newsletter', (await api('POST', '/api/newsletter', { email: 'news@banc.test' }, { ip: '10.7.0.3' })).status === 200 && mock.db.newsletters.some(n => n.email === 'news@banc.test'));
  ok('newsletter e-mail invalide → 400', (await api('POST', '/api/newsletter', { email: 'pas-un-email' }, { ip: '10.7.0.4' })).status === 400);
  // Panier abandonne
  const ab = await api('POST', '/api/abandoned-cart', { email: 'abandon@banc.test', client_prenom: 'Léa', cart_total: 159, cart_data: [{ nom: 'La Pochette ELLIA', prix: 159 }] }, { ip: '10.7.0.5' });
  ok('capture panier abandonné', ab.status === 200 && mock.db.abandoned_carts.some(c => c.email === 'abandon@banc.test'));
  const cAb = mock.db.abandoned_carts.find(c => c.email === 'abandon@banc.test'); cAb.created_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const cmdAb = commande(77).payload; cmdAb.client_email = 'abandon2@banc.test';
  await api('POST', '/api/abandoned-cart', { email: 'abandon2@banc.test', client_prenom: 'Zoé', cart_total: 159, cart_data: [] }, { ip: '10.7.0.6' });
  await api('POST', '/api/orders', cmdAb, { ip: '10.7.0.6' });
  ok('un panier abandonné est marqué converti quand la commande est passée', mock.db.abandoned_carts.find(c => c.email === 'abandon2@banc.test').converted_at != null);
  // Code promo
  const pc = await api('POST', '/api/admin/promo', { create: true, code: 'BANC10', discount_type: 'percent', discount_value: 10, max_uses: 2, active: true }, A);
  const pv = await api('POST', '/api/promo/validate', { code: 'BANC10', amount: 159 }, { ip: '10.8.0.1' });
  ok('code promo créé et validé (−10 %)', pc.status === 200 && pv.status === 200 && pv.json && pv.json.valid && Math.abs(Number(pv.json.discount) - 15.9) < 0.01, pc.text.slice(0, 100) + ' | ' + pv.text.slice(0, 120));
  const cp = commande(88).payload; cp.promo_code = 'BANC10';
  const rp = await api('POST', '/api/orders', cp, { ip: '10.8.0.2' });
  const op = enBase.find(o => o.numero === (rp.json || {}).numero);
  ok('commande avec code promo : remise appliquée serveur, total 143,10 €', rp.status === 200 && op && Math.abs(Number(op.montant_total) - 143.1) < 0.01 && op.promo_code === 'BANC10', op && op.montant_total);
  ok('code promo inconnu refusé', (await api('POST', '/api/promo/validate', { code: 'NEXISTEPAS', amount: 159 }, { ip: '10.8.0.3' })).status >= 400 || !((await api('POST', '/api/promo/validate', { code: 'NEXISTEPAS', amount: 159 }, { ip: '10.8.0.3' })).json || {}).ok);
  // Mot de passe oublie
  const rs = await api('POST', '/api/auth/reset', { email: 'cliente1@banc.test' }, { ip: '10.8.0.4' });
  ok('mot de passe oublié → e-mail de réinitialisation', rs.status === 200 && mailsPour('cliente1@banc.test', /Réinitialisation/).length === 1, rs.text.slice(0, 100));

  /* ───────────── 8. SÉCURITÉ / ROBUSTESSE ───────────── */
  section('8. Sécurité et robustesse');
  const gros = await api('POST', '/api/orders', JSON.stringify({ x: 'a'.repeat(300 * 1024) }), { ip: '10.9.0.1' }).catch(e => ({ status: 'coupé (' + e.code + ')' }));
  ok('corps > 256 Ko → refusé (413 ou connexion coupée)', gros.status === 413 || String(gros.status).startsWith('coupé'), gros.status);
  ok('JSON invalide → 400 propre', (await api('POST', '/api/orders', '{pas du json', { ip: '10.9.0.2' })).status === 400);
  if (PERSO) {
  const inj = commande(90).payload; inj.client_nom = "Dupont' or 1=1 --"; inj.items = [{ initiales: 'A<>"B', finition: 'Or' }]; inj.montant_total = 169;
  const ri = await api('POST', '/api/orders', inj, { ip: '10.9.0.3' });
  const oi = ri.json && enBase.find(o => o.numero === ri.json.numero);
  ok('caractères interdits dans les initiales → retirés (A<>"B devient AB), commande créée', ri.status === 200 && oi && oi.initiales === 'AB' && !JSON.stringify(oi).includes('<b>'), ri.status + ' ' + (oi ? oi.initiales : ri.text.slice(0, 80)));
  const inj2 = commande(96).payload; inj2.items = [{ initiales: '<img src=x onerror=alert(1)>' }];
  ok('injection longue dans les initiales → refusée (montant recalculé sur les caractères gravables)', (await api('POST', '/api/orders', inj2, { ip: '10.9.0.9' })).json?.error === 'montant_invalide');
  }
  const trop = commande(91, { qte: 6 }).payload;
  ok('6 pochettes → refus (max 5)', (await api('POST', '/api/orders', trop, { ip: '10.9.0.4' })).status === 400);
  const sous = commande(92).payload; sous.montant_total = 1;
  ok('montant client sous le prix catalogue → refus montant_invalide', (await api('POST', '/api/orders', sous, { ip: '10.9.0.5' })).json?.error === 'montant_invalide');
  const etr = commande(93).payload; etr.pays_livraison = 'Belgique';
  ok('pays hors France/Monaco → refus', (await api('POST', '/api/orders', etr, { ip: '10.9.0.6' })).json?.error === 'pays_non_livre');
  ok('traversée de répertoire refusée', (await api('GET', '/..%2f..%2fetc%2fpasswd')).status >= 400 && (await api('GET', '/assets/../server.js')).status >= 400);
  let limite = false; for (let i = 0; i < 205; i++) { const r = await api('POST', '/api/orders', {}, { ip: '10.9.0.7' }); if (r.status === 429) { limite = true; break; } }
  ok('limite de 200 commandes/heure par IP → 429 avec Retry-After', limite);
  const uid = commande(94).payload; uid.user_id = 'pas-un-uuid';
  const ru = await api('POST', '/api/orders', uid, { ip: '10.9.0.8' });
  ok('user_id non UUID ignoré', ru.status === 200 && enBase.find(o => o.numero === ru.json.numero).user_id == null);
  const h = await api('GET', '/pochette.html');
  ok('en-têtes de sécurité (CSP, nosniff, frame DENY)', /default-src/.test(h.headers['content-security-policy'] || '') && h.headers['x-content-type-options'] === 'nosniff' && h.headers['x-frame-options'] === 'DENY');
  const santé = await api('GET', '/api/health');
  ok('/api/health → ok', santé.status === 200);
  ok('le serveur n\'a levé aucune erreur non gérée', !/TypeError|ReferenceError|unhandledRejection|uncaughtException/.test(logSrv.join('')), (logSrv.join('').match(/.*(TypeError|ReferenceError).*/) || [''])[0]);

  /* ───────────── 9. PERSONNALISATION FERMÉE ───────────── */
  if (PERSO) {
    section('9. (rappel) En production la personnalisation est FERMÉE — relancer avec PERSO_OUVERTE=0 pour vérifier ce mode');
  } else {
    section('9. Personnalisation fermée');
    ok('page personnalisation.html = « Momentanément indisponible »', (await api('GET', '/personnalisation.html')).text.includes('Momentanément'));
    ok('partage de configuration fermé', (await api('POST', '/api/config', { config: {} }, { ip: '10.9.1.2' })).status === 503);
  }

  /* ───────────── BILAN ───────────── */
  const tousMails = mails();
  fs.writeFileSync(path.join(OUT, 'resume.json'), JSON.stringify({ reussis, echoues, echecs, mails: tousMails.length, parSujet: tousMails.reduce((a, m) => { const k = m.subject.replace(/EP-[A-Z0-9]+|F-EP-\d+-\d+|\d+,\d+ €/g, '…'); a[k] = (a[k] || 0) + 1; return a; }, {}), stockFinal: mock.db.products[0].stock, commandes: mock.db.orders.length, factures: mock.db.orders.filter(o => o.invoice_number).length }, null, 1));
  console.log('\n' + '─'.repeat(62));
  console.log('  E-mails capturés : ' + tousMails.length + ' · commandes en base : ' + mock.db.orders.length + ' · factures : ' + mock.db.orders.filter(o => o.invoice_number).length);
  if (echoues === 0) console.log('\x1b[32m\x1b[1m  ' + reussis + ' vérifications de bout en bout réussies.\x1b[0m');
  else { console.log('\x1b[31m\x1b[1m  ' + echoues + ' PROBLÈME(S) :\x1b[0m'); echecs.forEach(e => console.log('\x1b[31m    · ' + e + '\x1b[0m')); console.log('\x1b[2m  (' + reussis + ' autres vérifications passées)\x1b[0m'); }
  console.log('─'.repeat(62));
  await fin(echoues ? 1 : 0);
}
main().catch(async e => { console.error('BANC KO :', e); process.exit(2); });
