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
  const rows = await sb('orders?select=numero,client_nom,initiales,finition,montant_total,statut,created_at&order=created_at.desc');
  return rows.map(r=>({ id:r.numero, date:(r.created_at||'').slice(0,10), client:r.client_nom||'—',
    initiales:r.initiales||'—', finition:r.finition||'—', total:Number(r.montant_total), statut:r.statut }));
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
        if(!USE_DB) return sendJSON(res,{ ok:true, numero, demo:true });
        const row = { numero, client_nom:d.client_nom, client_email:d.client_email,
          initiales:d.initiales, finition:d.finition, emplacement:d.emplacement,
          montant_total:d.montant_total||0, statut:'Nouvelle' };
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
        await sb('orders?numero=eq.'+encodeURIComponent(numero),{ method:'PATCH', body:{ statut:d.statut } });
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
    res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log('ELLIA PARIS — http://localhost:' + PORT + (USE_DB ? '  [Supabase: ACTIF]' : '  [donnees DEMO]'));
  console.log('Admin : http://localhost:' + PORT + '/admin   (mot de passe : ' + (process.env.ADMIN_PASSWORD ? '****' : 'ellia2026 — a changer') + ')');
});
