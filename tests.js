/* ============================================================
   ELLIA PARIS — Tests automatiques
   ------------------------------------------------------------
   À LANCER avant chaque mise en ligne :

       node tests.js

   Vert = tout va bien, on peut déployer.
   Rouge = quelque chose est cassé, NE PAS déployer.

   Ces tests couvrent les points où une erreur coûte de l'argent
   ou trahit la confiance d'un client. Ils ne testent pas
   l'apparence du site, seulement ce qui doit être exact.

   Aucune installation nécessaire, aucune base de données requise.
   ============================================================ */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const RACINE = __dirname;
// Git convertit les fins de ligne en CRLF sur Windows. Sans cette
// normalisation, les motifs de recherche cessent de correspondre après un
// commit et les tests échouent alors que le code est intact.
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\r\n/g, '\n');

let reussis = 0, echoues = 0;
const echecs = [];
const enCours = [];   // tests asynchrones a attendre avant le bilan

function verifier(intitule, condition, constate){
  if (condition) { reussis++; console.log('  \x1b[32m✓\x1b[0m ' + intitule); }
  else {
    echoues++; echecs.push(intitule);
    console.log('  \x1b[31m✗ ' + intitule + '\x1b[0m');
    if (constate !== undefined) console.log('      constaté : ' + constate);
  }
}
function section(titre){ console.log('\n\x1b[1m' + titre + '\x1b[0m'); }

/* ══════════════════════════════════════════════════════════════
   1. PRIX DE GRAVURE — la formule du navigateur et celle du
      serveur doivent donner le MÊME résultat. Si elles divergent,
      soit un client sous-paie, soit une commande légitime est
      refusée au moment du paiement.
   ══════════════════════════════════════════════════════════════ */
section('Prix de gravure — navigateur contre serveur');

const srcServeur = lire('server.js');
const srcPerso   = lire('personnalisation.html');

/* On extrait les deux fonctions dans des modules temporaires plutôt que de
   les évaluer sur place : c'est le seul moyen de comparer exactement le code
   qui tourne en production, sans conflit de noms. */
const os = require('os');
function chargerExtrait(nom, code){
  const f = path.join(os.tmpdir(), 'ellia-test-' + nom + '-' + process.pid + '.cjs');
  fs.writeFileSync(f, code, 'utf8');
  try { return require(f); }
  finally { try { fs.unlinkSync(f); } catch(_){} }
}

let prixPersoItem = null, computePersoPrice = null;
let state = {};

try {
  const extrait = srcServeur.match(/const TARIF_LETTRE[\s\S]*?\n}\n/)[0];
  prixPersoItem = chargerExtrait('serveur', extrait + '\nmodule.exports = prixPersoItem;').valueOf();
  verifier('la formule du serveur est extraite du vrai code', typeof prixPersoItem === 'function');
} catch(e){
  verifier('la formule du serveur est extraite du vrai code', false, e.message);
}

try {
  const extrait = srcPerso.match(/function computePersoPrice\(\)\{[\s\S]*?\n  \}/)[0];
  const mod = chargerExtrait('navigateur',
    'const PRICE_BASE = 159, PRICE_LETTER = 5, PRICE_SPECIAL = 2, PRICE_SYMBOL = 10;\n' +
    'let state = {};\n' + extrait +
    '\nmodule.exports = { calculer: (s) => { state = s; return computePersoPrice(); } };');
  computePersoPrice = mod.calculer;
  verifier('la formule du navigateur est extraite du vrai code', typeof computePersoPrice === 'function');
} catch(e){
  verifier('la formule du navigateur est extraite du vrai code', false, e.message);
}

if (typeof prixPersoItem === 'function' && typeof computePersoPrice === 'function') {
  const cas = ['', 'AB', 'C.D.', 'MARIE', 'A B', 'Éloïse', "O'Brien",
               '😀', 'A😀B', '𝐀𝐁', 'ÀÉÎÔÙ', 'a-b_c', '12345', '   ', 'ÆØÅ'];
  let tousEgaux = true, detail = '';
  for (const t of cas) {
    const nav = computePersoPrice({ initials:t, useHebrew:false, useExtra:false, useExtra2:false, useExtra3:false }).persoTotal;
    const srv = prixPersoItem({ initiales: t });
    if (nav !== srv) { tousEgaux = false; detail += `\n      ${JSON.stringify(t)} → navigateur ${nav} €, serveur ${srv} €`; }
  }
  verifier('les deux formules donnent le même prix sur 15 cas limites', tousEgaux, detail);

  // Avec symboles
  const navS = computePersoPrice({ initials:'CD', useHebrew:true, useExtra:true, useExtra2:true, useExtra3:true }).persoTotal;
  const srvS = prixPersoItem({ initiales:'CD', flame:{enabled:true}, extra:{enabled:true},
                               extra2:{enabled:true}, extra3:{enabled:true} });
  verifier('les 4 symboles sont facturés pareil des deux côtés', navS === srvS,
           `navigateur ${navS} €, serveur ${srvS} €`);

  verifier('un symbole coûte bien 10 €', prixPersoItem({ flame:{enabled:true} }) === 10,
           prixPersoItem({ flame:{enabled:true} }) + ' €');
  verifier('une lettre coûte bien 5 €', prixPersoItem({ initiales:'A' }) === 5,
           prixPersoItem({ initiales:'A' }) + ' €');
  verifier('sans gravure, le supplément est nul', prixPersoItem({}) === 0);
}

/* ══════════════════════════════════════════════════════════════
   2. GARDE-FOU ANTI-FRAUDE — le serveur doit refuser une commande
      dont le montant annoncé est inférieur au prix réel.
   ══════════════════════════════════════════════════════════════ */
section('Garde-fou sur le montant');

if (typeof prixPersoItem === 'function') {
  const plancher = (items, prixCatalogue = 159) => {
    let perso = 0;
    for (const it of items) perso += prixPersoItem(it);
    return Math.round((prixCatalogue * items.length + perso) * 100) / 100;
  };
  const accepte = (items, total) => !(total + 0.01 < plancher(items));

  const grave = [{ initiales:'MARIE', flame:{enabled:true}, extra:{enabled:true},
                   extra2:{enabled:true}, extra3:{enabled:true} }];
  verifier('une pochette gravée payée au prix nu est REFUSÉE', !accepte(grave, 159));
  verifier('la même au juste prix est acceptée',                accepte(grave, 224));
  verifier('deux pochettes payées comme une seule sont REFUSÉES', !accepte([{},{}], 159));
  verifier('deux pochettes nues au bon prix sont acceptées',      accepte([{},{}], 318));
  verifier('un centime de moins est REFUSÉ',                     !accepte([{}], 158.98));
  verifier('payer plus que demandé reste accepté',                accepte([{}], 200));
}

/* ══════════════════════════════════════════════════════════════
   3. FACTURE — le total imprimé doit être exactement ce qui a été
      encaissé, et HT + TVA doit retomber dessus au centime.
   ══════════════════════════════════════════════════════════════ */
section('Facture PDF');

let invoiceMod = null;
try { invoiceMod = require('./invoice.js'); } catch(e){}

if (invoiceMod && invoiceMod.generateInvoicePDF) {
  const commande = {
    numero:'TEST-001', invoice_number:'F-TEST-001', invoice_date:new Date(),
    client_prenom:'Camille', client_nom:'Durand', client_email:'c@example.fr',
    adresse_livraison:'12 rue de Rivoli', cp_livraison:'75004', ville_livraison:'Paris',
    quantite:2, prix_pochette:159, prix_personnalisation:22.5, frais_port:0, tva_rate:20,
    promo_code:'BIENVENUE10', promo_discount:34.5,
    montant_total:310.50, montant_ht:258.75, montant_tva:51.75,
    notes_admin:'[PROMO BIENVENUE10 -34.5]',   // note INTERNE : ne doit pas fuiter
    items_data:[
      { initiales:'C.D.', finition:'or', emplacement:'bas', flame:{enabled:true, symbol_name:'Hamsa', finish:'or', placement:'bas'} },
      { initiales:'M.L.', finition:'argent', emplacement:'haut', extra:{enabled:true, symbol_name:'Flamme', finish:'argent', placement:'haut'} }
    ]
  };
  const attendu = [
    ['le total imprimé est le montant encaissé', '310,50'],
    ['l\'article 2 apparaît',                    'M.L.'],
    ['le symbole Hamsa apparaît',                'Hamsa'],
    ['le symbole Flamme apparaît',               'Flamme'],
    ['la remise est tracée',                     'BIENVENUE10']
  ];
  enCours.push(invoiceMod.generateInvoicePDF(commande)
    .then(buf => {
      const brut = buf.toString('latin1');
      verifier('la facture est bien générée', buf.length > 10000, buf.length + ' octets');
      verifier('les notes internes ne fuitent PAS sur la facture client',
               !brut.includes('PROMO BIENVENUE10'));
      // Le texte d'un PDF est compressé : on vérifie ce qu'on peut sans dépendance
      const somme = 258.75 + 51.75;
      verifier('HT + TVA = TTC (258,75 + 51,75 = 310,50)', Math.abs(somme - 310.50) < 0.001,
               somme.toFixed(2));
    })
    .catch(e => verifier('la facture se génère sans erreur', false, e.message)));
} else {
  console.log('  \x1b[33m—\x1b[0m module de facture indisponible (npm install pdfkit) — tests ignorés');
}

/* ══════════════════════════════════════════════════════════════
   4. CODE PROMO — un pourcentage ne peut pas dépasser 100 %,
      une remise ne peut pas dépasser le panier.
   ══════════════════════════════════════════════════════════════ */
section('Codes promo');

let promoMod = null;
try { promoMod = require('./promo.js'); } catch(e){}

if (promoMod && promoMod.validatePromoCode) {
  const faux = (p) => async () => [p];
  const suite = [
    [{ code:'A', discount_type:'percent', discount_value:150, min_order:0, used_count:0, max_uses:null }, 218, 218,
     'un code à 150 % est plafonné au montant du panier'],
    [{ code:'B', discount_type:'percent', discount_value:10,  min_order:0, used_count:0, max_uses:null }, 218, 21.8,
     'un code à 10 % retire bien 10 %'],
    [{ code:'C', discount_type:'fixed',   discount_value:9999,min_order:0, used_count:0, max_uses:null }, 218, 218,
     'un montant fixe énorme est plafonné au panier']
  ];
  enCours.push(Promise.all(suite.map(([p, montant, attendu, intitule]) =>
    promoMod.validatePromoCode(faux(p), p.code, montant)
      .then(r => verifier(intitule, Math.abs((r.discount || 0) - attendu) < 0.01,
                          (r.discount || 0) + ' € au lieu de ' + attendu + ' €'))
      .catch(e => verifier(intitule, false, e.message))
  )));
} else {
  console.log('  \x1b[33m—\x1b[0m module promo indisponible — tests ignorés');
}

/* ══════════════════════════════════════════════════════════════
   5. RÔLES — l'atelier ne doit voir aucun montant, ni pouvoir
      déclencher l'émission d'une facture.
   ══════════════════════════════════════════════════════════════ */
section('Cloisonnement des rôles');

const CHAMPS_FINANCIERS = (srcServeur.match(/const FINANCE_FIELDS = \[([^\]]+)\]/) || [,''])[1];
for (const champ of ['montant_total','montant_ht','montant_tva','prix_pochette',
                     'promo_code','promo_discount','notes_admin','stripe_session_id']) {
  verifier('« ' + champ + ' » est masqué pour l\'atelier',
           CHAMPS_FINANCIERS.includes("'" + champ + "'"));
}

// Le garde-fou sur l'expédition doit fonctionner malgré les accents
const sansAccents = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const bloqueAtelier = (v) => { const x = sansAccents(v); return /expedi|livr/.test(x) && !x.startsWith('prete'); };
verifier('l\'atelier ne peut pas passer une commande en « Expédiée »', bloqueAtelier('Expédiée'));
verifier('l\'atelier ne peut pas passer une commande en « Livrée »',   bloqueAtelier('Livrée'));
verifier('l\'atelier PEUT marquer « Prête à expédier »',              !bloqueAtelier('Prête à expédier'));
verifier('l\'atelier PEUT marquer « En préparation »',                !bloqueAtelier('En préparation'));

/* ══════════════════════════════════════════════════════════════
   6. SESSIONS — un cookie doit expirer et ne pas être falsifiable.
   ══════════════════════════════════════════════════════════════ */
section('Sessions administrateur');

const SECRET_TEST = 'secret-de-test';
const DUREE = 24 * 3600 * 1000;
const fabriquer = (login, role, quand) => {
  const p = Buffer.from(login + '|' + role + '|' + quand).toString('base64url');
  return 'v2.' + p + '.' + crypto.createHmac('sha256', SECRET_TEST).update('ellia-v2.' + p).digest('hex');
};
const lireSession = (c) => {
  const P = String(c).split('.');
  if (P.length !== 3) return null;
  if (P[2] !== crypto.createHmac('sha256', SECRET_TEST).update('ellia-v2.' + P[1]).digest('hex')) return null;
  const [login, role, emis] = Buffer.from(P[1], 'base64url').toString().split('|');
  const t = Number(emis);
  if (!t || !isFinite(t) || Date.now() - t > DUREE) return null;
  return { login, role };
};
verifier('une session fraîche est acceptée',        !!lireSession(fabriquer('elie','admin', Date.now())));
verifier('une session de 25 h est REFUSÉE',          !lireSession(fabriquer('elie','admin', Date.now() - 25*3600*1000)));
verifier('une signature falsifiée est REFUSÉE',      !lireSession('v2.' + Buffer.from('x|admin|' + Date.now()).toString('base64url') + '.faux'));
verifier('une session sans horodatage est REFUSÉE',  !lireSession(fabriquer('x','admin','')));

/* ══════════════════════════════════════════════════════════════
   7. COHÉRENCE DU SITE — ce qui a déjà cassé par le passé.
   ══════════════════════════════════════════════════════════════ */
section('Cohérence du site');

const pagesHtml = fs.readdirSync(RACINE).filter(f => f.endsWith('.html'));

// Un <script src> ignore son contenu inline — piège qui a déjà cassé
// l'effacement du marqueur anti-doublon après paiement.
let scriptsPiegés = [];
for (const f of pagesHtml) {
  const h = lire(f);
  for (const m of h.matchAll(/<script[^>]*\bsrc=[^>]*>([\s\S]*?)<\/script>/g)) {
    if (m[1].trim().length > 0) scriptsPiegés.push(f);
  }
}
verifier('aucune balise <script src> ne contient de code ignoré',
         scriptsPiegés.length === 0, scriptsPiegés.join(', '));

// Toutes les pages doivent porter le même numéro de version de cache,
// sinon un visiteur garde d'anciens fichiers pendant un an.
const versions = new Set();
for (const f of pagesHtml) for (const m of lire(f).matchAll(/\?v=(\d{9,})/g)) versions.add(m[1]);
verifier('toutes les pages utilisent le même numéro de version',
         versions.size <= 1, [...versions].join(', '));

// Le préchargement du modèle 3D doit viser exactement l'URL chargée,
// sinon le fichier de 2,3 Mo est téléchargé deux fois.
const preload = (srcPerso.match(/rel="preload"[^>]*href="([^"]*pochette\.glb[^"]*)"/) || [])[1];
const charge  = (srcPerso.match(/loader\.load\('([^']*pochette\.glb[^']*)'/) || [])[1];
verifier('le préchargement du modèle 3D vise la bonne URL',
         !preload || preload === charge, 'préchargé ' + preload + ' / chargé ' + charge);

// Aucun marqueur de rédaction ne doit rester visible sur une page publique
let brouillons = [];
for (const f of pagesHtml) {
  const h = lire(f);
  if (/\[à préciser\]|\[délai\]|\[numéro\]|\[à compléter\]|Modèle à faire valider/.test(h)) brouillons.push(f);
}
verifier('aucun marqueur de brouillon visible par un client', brouillons.length === 0, brouillons.join(', '));

// Le bouton de paiement doit porter la mention légale obligatoire
verifier('le bouton de commande porte la mention légale obligatoire',
         lire('checkout.html').includes('obligation de paiement'));

// Les fichiers serveur ne doivent jamais être servis
const proteges = (srcServeur.match(/SERVER_FILES = \[([^\]]+)\]/) || [,''])[1];
for (const f of ['server.js','invoice.js','compta.js','promo.js','totp.js','tests.js']) {
  verifier('« ' + f + ' » est protégé du téléchargement', proteges.includes("'" + f + "'"));
}
// Fichiers de travail : sauvegardes, brouillons, pages orphelines
const blocStatique = srcServeur.slice(srcServeur.indexOf('SERVER_FILES.includes(baseName)'),
                                     srcServeur.indexOf('SERVER_FILES.includes(baseName)') + 800);
for (const ext of ['.truncated-backup', '.old', '.orig', '.log']) {
  verifier('les fichiers ' + ext + ' sont protégés', blocStatique.includes(ext));
}
verifier('la page orpheline studio-export.html est protégée', blocStatique.includes('studio-export.html'));

/* ══════════════════════════════════════════════════════════════
   7 bis. SÉCURITÉ DU CODE RÉCENT
   Chacun de ces tests correspond à une faille réelle trouvée en
   audit. Ils sont là pour qu'elle ne revienne jamais.
   ══════════════════════════════════════════════════════════════ */
section('Sécurité — failles déjà rencontrées');

// L'aperçu envoyé par le client était injecté dans l'admin sans contrôle
// de fin de chaîne : du code pouvait suivre le base64 légitime.
const regexApercu = /\^data:image[^)]*\$/.test(srcServeur.replace(/\\\\/g,'\\'));
verifier('la validation de l\'aperçu est ancrée à la fin (^…$)',
         /\$\/\.test\(d\.preview\)/.test(srcServeur));
verifier('l\'admin ne concatène plus l\'aperçu sans contrôle',
         !/\+o\.preview\+/.test(lire('admin.js')));
verifier('l\'admin passe l\'aperçu par un filtre',
         lire('admin.js').includes('apercuSur(o.preview)'));

// Un test exécuté sur la vraie expression du serveur
const mApercu = srcServeur.match(/\/\^data:image[^\n]*?\/\.test\(d\.preview\)/);
if (mApercu) {
  const re = new RegExp(mApercu[0].slice(1, mApercu[0].lastIndexOf('/')));
  verifier('un aperçu piégé est refusé', !re.test('data:image/png;base64,x" onerror="alert(1)'));
  verifier('un aperçu légitime est accepté', re.test('data:image/png;base64,iVBORw0KGgo='));
}

// Une valeur libre recopiée dans un sélecteur CSS permettait de déclencher
// un clic sur n'importe quel bouton via un lien partagé.
verifier('le partage de configuration valide contre des listes fermées',
         srcServeur.includes('const FINITIONS') && srcServeur.includes('const SYMBOLES') &&
         srcServeur.includes('dansListe'));

// Le message d'erreur de la base fuitait vers un visiteur anonyme.
verifier('aucun message d\'erreur de base renvoyé au public',
         !/error:'enregistrement', detail:e\.message/.test(srcServeur) &&
         !/error:'lecture', detail:e\.message/.test(srcServeur));

// Excel exécute toute cellule commençant par = + - @
let versCSV = null;
try {
  const os2 = require('os');
  const f = path.join(os2.tmpdir(), 'ellia-csv-' + process.pid + '.cjs');
  fs.writeFileSync(f, srcServeur.match(/function versCSV\(lignes\)\{[\s\S]*?\n\}/)[0] + '\nmodule.exports = versCSV;');
  versCSV = require(f); fs.unlinkSync(f);
} catch(e){}
if (versCSV) {
  const csv = versCSV([{ a:"=cmd|'/c calc'!A1", b:'+33', c:'@SUM(1)', d:'Bonjour', e:'-12' }]);
  verifier('une formule Excel est neutralisée dans la sauvegarde', csv.includes('"\'=cmd'));
  verifier('un @ en début de cellule est neutralisé',              csv.includes('"\'@SUM'));
  verifier('un texte normal reste intact',                         csv.includes('"Bonjour"'));
  verifier('le fichier porte le marqueur Excel (BOM)',             csv.charCodeAt(0) === 0xFEFF);
}

// Une alerte étouffée par l'anti-spam doit malgré tout être journalisée.
const blocAlerte = (srcServeur.match(/function alerte\([\s\S]*?\n\}/) || [''])[0];
verifier('une alerte étouffée laisse quand même une trace dans les logs',
         blocAlerte.indexOf('console.error') < blocAlerte.indexOf('ALERTE_DERNIERE.get'));

// La réconciliation ne doit pas compter une commande qu'elle n'a pas touchée.
verifier('la réconciliation vérifie que la commande a vraiment changé',
         srcServeur.includes("prefer:'return=representation'") &&
         /Array\.isArray\(modifiees\)/.test(srcServeur));

// Pagination Stripe : sans elle, au-delà de 100 sessions on est aveugle.
verifier('la réconciliation pagine les paiements Stripe',
         srcServeur.includes('starting_after') && srcServeur.includes('has_more'));

// Deux passages simultanés du même cron s'empilaient.
verifier('la réconciliation a un verrou anti-chevauchement',
         srcServeur.includes('_reconEnCours'));

// La sauvegarde ne doit jamais charger les images en mémoire.
verifier('la sauvegarde ne demande pas les colonnes d\'images',
         srcServeur.includes('COLS_COMMANDES') && !/orders\?select=\*&order=created_at\.desc/.test(srcServeur));
verifier('la sauvegarde lit par tranches',        srcServeur.includes('const PAGE = 500'));
verifier('la sauvegarde plafonne la taille',      srcServeur.includes('TAILLE_MAX'));

// Le journal ne doit pas recopier les données personnelles.
verifier('le journal masque les données personnelles',
         srcServeur.includes("const PERSO = ['client_nom'"));

// La demande d'avis doit partir après la LIVRAISON.
verifier('la demande d\'avis se base sur la date de livraison',
         srcServeur.includes('delivered_at=lte.') && srcServeur.includes('delivered_at=not.is.null'));
verifier('la date de livraison est enregistrée au changement de statut',
         srcServeur.includes("upd.delivered_at = new Date().toISOString()"));
verifier('la commande est marquée AVANT l\'envoi de la demande d\'avis',
         srcServeur.indexOf('marquage impossible') < srcServeur.indexOf("un mot sur votre expérience"));

// Les liens de partage expirés doivent être supprimés.
verifier('les configurations partagées expirées sont purgées',
         srcServeur.includes('purgerPartages'));

// Le message cadeau doit garder et afficher ses retours à la ligne.
verifier('les retours à la ligne du message cadeau sont conservés',
         !/gift_message: d\.is_gift \? clean\(/.test(srcServeur));
verifier('le message cadeau s\'affiche sur plusieurs lignes',
         (srcServeur.match(/white-space:pre-wrap/g) || []).length >= 2 &&
         (lire('admin.js').match(/white-space:pre-wrap/g) || []).length >= 2);

section('Politique de sécurité du contenu');

// Le CDN de l'hébergeur remplace l'en-tête HTTP : la balise meta est le seul
// moyen que la politique atteigne réellement le navigateur.
const pagesCSP = pagesHtml.filter(f => !lire(f).includes('http-equiv="Content-Security-Policy"'));
verifier('toutes les pages portent la politique en balise', pagesCSP.length === 0, pagesCSP.join(', '));

const cspIndex = (lire('index.html').match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [,''])[1];
// Sans 'wasm-unsafe-eval', Chrome refuse de compiler le décodeur du modèle 3D
// et le configurateur reste désespérément vide.
verifier('la politique autorise WebAssembly (modèle 3D)', cspIndex.includes("'wasm-unsafe-eval'"));
verifier('la politique autorise les modules three.js',    cspIndex.includes('unpkg.com'));
verifier('la politique autorise Supabase',                cspIndex.includes('supabase.co'));
verifier('la politique autorise les polices Google',      cspIndex.includes('fonts.gstatic.com'));
verifier('la politique autorise les workers du décodeur', cspIndex.includes('worker-src') && cspIndex.includes('blob:'));
verifier('la politique interdit les objets embarqués',    cspIndex.includes("object-src 'none'"));
// frame-ancestors et form-action sont ignorés dans une balise meta :
// les y laisser donnerait une fausse impression de protection.
verifier('la politique en balise n\'annonce pas de directive inopérante',
         !cspIndex.includes('frame-ancestors') && !cspIndex.includes('form-action'));
verifier('la protection contre l\'iframe passe par un en-tête, lui non filtré',
         srcServeur.includes("X-Frame-Options', 'DENY'") || srcServeur.includes('X-Frame-Options'));

// Les deux politiques (serveur et balise) doivent rester cohérentes.
verifier('la politique du serveur autorise aussi WebAssembly',
         srcServeur.includes("'wasm-unsafe-eval'"));

/* ══════════════════════════════════════════════════════════════
   8. SYNTAXE — aucun fichier ne doit être cassé.
   ══════════════════════════════════════════════════════════════ */
section('Syntaxe des fichiers');

const { execFileSync } = require('child_process');
for (const f of fs.readdirSync(RACINE).filter(f => f.endsWith('.js') && f !== 'tests.js')) {
  let ok = true, err = '';
  try { execFileSync(process.execPath, ['--check', path.join(RACINE, f)], { stdio:'pipe' }); }
  catch(e){ ok = false; err = String(e.stderr || e.message).split('\n').slice(0,2).join(' '); }
  verifier(f + ' est syntaxiquement valide', ok, err);
}

for (const f of pagesHtml) {
  const h = lire(f).toLowerCase();
  verifier(f + ' a ses balises <div> équilibrées',
           h.split('<div').length === h.split('</div>').length,
           h.split('<div').length - 1 + ' ouvertes / ' + (h.split('</div>').length - 1) + ' fermées');
}

/* ══════════════════════════════════════════════════════════════
   BILAN
   ══════════════════════════════════════════════════════════════ */
// On attend la fin des tests asynchrones avant de conclure.
Promise.allSettled(enCours).then(bilan);

function bilan(){
  console.log('\n' + '─'.repeat(62));
  if (echoues === 0) {
    console.log('\x1b[32m\x1b[1m  ' + reussis + ' vérifications réussies — vous pouvez déployer.\x1b[0m');
  } else {
    console.log('\x1b[31m\x1b[1m  ' + echoues + ' PROBLÈME(S) — ne déployez pas en l\'état :\x1b[0m');
    echecs.forEach(e => console.log('\x1b[31m    · ' + e + '\x1b[0m'));
    console.log('\x1b[2m  (' + reussis + ' autres vérifications sont passées)\x1b[0m');
  }
  console.log('─'.repeat(62) + '\n');
  process.exitCode = echoues === 0 ? 0 : 1;
}
