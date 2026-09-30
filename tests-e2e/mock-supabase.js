/* ============================================================
   ELLIA PARIS — Banc d'essai : base Supabase simulée
   ------------------------------------------------------------
   Reproduit en mémoire le sous-ensemble de PostgREST utilisé par
   server.js : filtres (eq, neq, is, lt, lte, gt, gte, like, in,
   not.is), or=(...), select, order, limit, Prefer:return=representation,
   les fonctions RPC (decrement_stock, adjust_stock, set_stock_absolute,
   next_invoice_number) et /auth/v1/admin/generate_link.
   Aucune donnée réelle n'est touchée : tout vit dans ce processus.
   ============================================================ */
const http = require('http');
const crypto = require('crypto');

const db = {
  products: [{ id: 1, ref: 'ELLIA-NOIR', nom: 'La Pochette ELLIA — Noir', prix: 159, stock: 60, seuil: 5, actif: true },
             { id: 2, ref: 'ELLIA-PERSO', nom: 'Gravure', prix: 59, stock: 999, seuil: 0, actif: true }],
  orders: [], reviews: [], abandoned_carts: [], admin_users: [], admin_settings: [],
  shared_configs: [], newsletters: [], admin_logs: [], promo_codes: [], stock_history: [], wishlists: [], profiles: []
};
let invoiceSeq = 0;
const journal = [];   // trace de chaque appel (pour le rapport)

function uuid(){ return crypto.randomUUID(); }
function now(){ return new Date().toISOString(); }
function cmp(a, b){ if (a == null && b == null) return 0; if (a == null) return -1; if (b == null) return 1;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) - Number(b); return String(a) < String(b) ? -1 : (String(a) > String(b) ? 1 : 0); }

function parseCond(key, expr){
  // expr : "eq.Payee" | "is.null" | "not.is.null" | "in.(a,b)" | "like.*x*"
  const m = /^(not\.)?([a-z]+)\.(.*)$/s.exec(expr);
  if (!m) return () => true;
  const neg = !!m[1], op = m[2]; let val = m[3];
  let fn;
  switch (op) {
    case 'eq':  fn = r => String(r[key]) === val && r[key] != null; break;
    case 'neq': fn = r => r[key] == null ? true : String(r[key]) !== val; break;   // PostgREST : NULL <> x est "null" => exclu ; on tolère
    case 'is':  fn = r => val === 'null' ? r[key] == null : (val === 'true' ? r[key] === true : r[key] === false); break;
    case 'lt':  fn = r => r[key] != null && cmp(r[key], val) < 0; break;
    case 'lte': fn = r => r[key] != null && cmp(r[key], val) <= 0; break;
    case 'gt':  fn = r => r[key] != null && cmp(r[key], val) > 0; break;
    case 'gte': fn = r => r[key] != null && cmp(r[key], val) >= 0; break;
    case 'in':  { const list = val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')); fn = r => list.includes(String(r[key])); break; }
    case 'like': case 'ilike': { const re = new RegExp('^' + val.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', op === 'ilike' ? 'i' : ''); fn = r => re.test(String(r[key] ?? '')); break; }
    default: fn = () => true;
  }
  if (op === 'neq') fn = r => String(r[key]) !== val;   // comportement effectif attendu par server.js (neq sur valeur non nulle)
  return neg ? (r => !fn(r)) : fn;
}
// or=(a.eq.1,and(b.neq.2,c.is.null))
function splitTop(s){ const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; }
function parseLogic(expr, mode){
  const parts = splitTop(expr).map(p => {
    let m = /^(and|or)\((.*)\)$/s.exec(p); if (m) return parseLogic(m[2], m[1]);
    m = /^([a-z_]+)\.(.*)$/s.exec(p); return m ? parseCond(m[1], m[2]) : (() => true);
  });
  return mode === 'and' ? (r => parts.every(f => f(r))) : (r => parts.some(f => f(r)));
}
function applyQuery(rows, sp){
  let out = rows;
  const filters = [];
  for (const [k, v] of sp.entries()) {
    if (k === 'select' || k === 'order' || k === 'limit' || k === 'offset') continue;
    if (k === 'or') { const m = /^\((.*)\)$/s.exec(v); filters.push(parseLogic(m ? m[1] : v, 'or')); continue; }
    if (k === 'and') { const m = /^\((.*)\)$/s.exec(v); filters.push(parseLogic(m ? m[1] : v, 'and')); continue; }
    filters.push(parseCond(k, v));
  }
  out = out.filter(r => filters.every(f => f(r)));
  const order = sp.get('order');
  if (order) { const [col, dir] = order.split('.'); out = [...out].sort((a, b) => cmp(a[col], b[col]) * (dir === 'desc' ? -1 : 1)); }
  const offset = sp.get('offset'); if (offset) out = out.slice(Number(offset));
  const limit = sp.get('limit'); if (limit) out = out.slice(0, Number(limit));
  return out;
}
function project(rows, select){
  if (!select || select === '*') return rows;
  const cols = select.split(',').map(s => s.trim());
  return rows.map(r => { const o = {}; for (const c of cols) o[c] = r[c] === undefined ? null : r[c]; return o; });
}
function defaults(table, row){
  const r = { ...row };
  if (r.id === undefined) r.id = (table === 'shared_configs') ? r.id : (['products','newsletters','abandoned_carts','promo_codes'].includes(table) ? (db[table].length + 1) : uuid());
  if (r.created_at === undefined) r.created_at = now();
  if (table === 'orders') { if (r.statut === undefined) r.statut = 'Nouvelle'; if (r.invoice_number === undefined) r.invoice_number = null; if (r.payment_status === undefined) r.payment_status = null; if (r.email_sent_at === undefined) r.email_sent_at = null; if (r.delivered_at === undefined) r.delivered_at = null; if (r.review_asked_at === undefined) r.review_asked_at = null; if (r.invoice_sent_at === undefined) r.invoice_sent_at = null; if (r.quantite === undefined) r.quantite = 1; }
  if (table === 'reviews') { if (r.validated === undefined) r.validated = false; }
  if (table === 'admin_users') { if (r.actif === undefined) r.actif = true; }
  if (table === 'abandoned_carts') { if (r.reminder_sent_at === undefined) r.reminder_sent_at = null; if (r.converted_at === undefined) r.converted_at = null; }
  if (table === 'shared_configs') { if (r.views === undefined) r.views = 0; if (r.expires_at === undefined) r.expires_at = new Date(Date.now() + 30 * 86400000).toISOString(); }
  if (table === 'promo_codes') { if (r.used_count === undefined) r.used_count = 0; if (r.active === undefined) r.active = true; }
  return r;
}
function rpc(name, body){
  const p = db.products.find(x => x.ref === body.p_ref);
  switch (name) {
    case 'decrement_stock': {
      if (!p) return { status: 400, json: { message: 'ref inconnue' } };
      const q = Number(body.p_qte) || 1;
      if (p.stock < q) return { status: 400, json: { message: 'stock insuffisant' } };
      p.stock -= q; db.stock_history.push({ id: uuid(), product_ref: p.ref, delta: -q, reason: 'sale', order_numero: body.p_order || null, created_at: now() });
      return { status: 200, json: true };
    }
    case 'adjust_stock': {
      if (!p) return { status: 400, json: { message: 'ref inconnue' } };
      p.stock += Number(body.p_delta) || 0;
      db.stock_history.push({ id: uuid(), product_ref: p.ref, delta: Number(body.p_delta) || 0, reason: body.p_reason, notes: body.p_notes, admin: body.p_admin, order_numero: body.p_order || null, source: body.p_source, created_at: now() });
      return { status: 200, json: p.stock };
    }
    case 'set_stock_absolute': {
      if (!p) return { status: 400, json: { message: 'ref inconnue' } };
      const delta = Number(body.p_new_stock) - p.stock; p.stock = Number(body.p_new_stock);
      db.stock_history.push({ id: uuid(), product_ref: p.ref, delta, reason: 'manual', notes: body.p_notes, admin: body.p_admin, created_at: now() });
      return { status: 200, json: p.stock };
    }
    case 'next_invoice_number': { invoiceSeq++; return { status: 200, json: 'F-EP-' + new Date().getFullYear() + '-' + String(invoiceSeq).padStart(4, '0') }; }
    case 'increment_promo_usage': { const c = db.promo_codes.find(x => x.code === body.p_code); if (c) c.used_count = (c.used_count || 0) + 1; return { status: 200, json: true }; }
    default: return { status: 404, json: { message: 'rpc inconnue ' + name } };
  }
}

function start(port){
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
      const u = new URL(req.url, 'http://x');
      const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
      journal.push({ m: req.method, p: u.pathname + u.search });
      // Pas de cle service_role -> refus (comme Supabase)
      if (req.headers.apikey !== 'service-test' && req.headers.authorization !== 'Bearer service-test') return send(401, { message: 'clé absente' });
      // Auth admin (lien de reinitialisation)
      if (u.pathname === '/auth/v1/admin/generate_link') return send(200, { action_link: 'http://127.0.0.1:0/reset?token=test', properties: { action_link: 'http://127.0.0.1:0/reset?token=test' } });
      // Auth user check (JWT) : pas simule
      if (!u.pathname.startsWith('/rest/v1/')) return send(404, { message: 'not found' });
      const rest = u.pathname.slice('/rest/v1/'.length);
      let data = {}; try { data = body ? JSON.parse(body) : {}; } catch (_) { return send(400, { message: 'json' }); }
      if (rest.startsWith('rpc/')) { const r = rpc(rest.slice(4), data); return send(r.status, r.json); }
      const table = rest;
      if (!db[table]) return send(404, { message: 'table inconnue ' + table });
      const prefer = String(req.headers.prefer || '');
      const wantRep = /return=representation/.test(prefer);
      if (req.method === 'GET') return send(200, project(applyQuery(db[table], u.searchParams), u.searchParams.get('select')));
      if (req.method === 'POST') {
        const rows = (Array.isArray(data) ? data : [data]).map(r => defaults(table, r));
        // contraintes uniques : orders.numero, orders.invoice_number, admin_users.login, promo_codes.code, shared_configs.id
        for (const r of rows) {
          if (table === 'orders' && db.orders.some(o => o.numero === r.numero)) return send(409, { message: 'duplicate key value violates unique constraint "orders_numero_key"' });
          if (table === 'admin_users' && db.admin_users.some(o => o.login === r.login)) return send(409, { message: 'duplicate key admin_users_login_key' });
          if (table === 'shared_configs' && db.shared_configs.some(o => o.id === r.id)) return send(409, { message: 'duplicate key' });
        }
        db[table].push(...rows);
        return send(201, wantRep ? rows : undefined);
      }
      if (req.method === 'PATCH') {
        const target = applyQuery(db[table], u.searchParams);
        if (table === 'orders' && data.invoice_number) {
          const dup = db.orders.find(o => o.invoice_number === data.invoice_number && !target.includes(o));
          if (dup) return send(409, { message: 'duplicate key value violates unique constraint "uq_orders_invoice_number"' });
        }
        for (const r of target) Object.assign(r, data);
        return send(wantRep ? 200 : 204, wantRep ? project(target, u.searchParams.get('select')) : undefined);
      }
      if (req.method === 'DELETE') {
        const target = applyQuery(db[table], u.searchParams);
        db[table] = db[table].filter(r => !target.includes(r));
        return send(204);
      }
      send(405, { message: 'méthode' });
    });
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}

module.exports = { db, start, journal, get invoiceSeq(){ return invoiceSeq; } };
if (require.main === module) start(Number(process.env.MOCK_PORT) || 54329).then(() => console.log('mock supabase pret'));
