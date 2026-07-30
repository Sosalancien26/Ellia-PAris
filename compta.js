/* ============================================================
   ELLIA PARIS — Module Comptabilite
   Calcul CA, seuils micro-entreprise, exports CSV legaux.
   ============================================================ */

// Seuils 2026 (mettez a jour chaque annee si changement BOFIP)
const SEUIL_MICRO_BIENS  = 188700; // EUR — vente de biens (maroquinerie)
const SEUIL_FRANCHISE_TVA= 91900;  // EUR — franchise TVA biens

function csvEscape(s){ return '"' + String(s==null?'':s).replace(/"/g,'""') + '"'; }
function eur2(n){ return Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function dateFR(d){ if(!d) return ''; try{ return new Date(d).toLocaleDateString('fr-FR'); }catch(_){ return ''; } }
function num2(n){ return Number(n||0).toFixed(2).replace('.', ','); }

/* Calcul des stats comptables pour une annee donnee */
async function getCompta(sb, year){
  const now = new Date();
  const y = Number(year) || now.getFullYear();
  const startISO = new Date(Date.UTC(y, 0, 1)).toISOString();
  const endISO   = new Date(Date.UTC(y, 11, 31, 23, 59, 59)).toISOString();

  // On ne compte QUE les commandes non-annulees (toutes les recettes encaissees ou en cours)
  const select = 'numero,invoice_number,client_prenom,client_nom,client_email,montant_total,montant_ht,montant_tva,tva_rate,payment_method,payment_status,payment_date,statut,manual_order,created_at,invoice_sent_at';
  const url = 'orders?select=' + select +
              '&created_at=gte.' + encodeURIComponent(startISO) +
              '&created_at=lte.' + encodeURIComponent(endISO) +
              '&statut=not.in.(Annulee,Annulée,Annulé,Remboursee,Remboursée)' +
              '&order=created_at.asc';
  let orders = [];
  try { orders = await sb(url); } catch(_) { orders = []; }

  // Une recette n'est comptable QUE lorsqu'elle est encaissee (regle de la
  // comptabilite de tresorerie). Les commandes creees mais non payees
  // (checkout Stripe abandonne) ne doivent pas gonfler le CA.
  const estPaye = (o) => {
    const ps = String(o.payment_status || '').toLowerCase();
    return ps.indexOf('pay') === 0 || ps === 'paid' || ps === 'succeeded' || !!o.payment_date;
  };
  const payes   = orders.filter(estPaye);
  const attente = orders.filter(o => !estPaye(o));

  const caTTC = payes.reduce((s,o) => s + Number(o.montant_total||0), 0);
  const caHT  = payes.reduce((s,o) => s + Number(o.montant_ht||o.montant_total||0), 0);
  const tva   = payes.reduce((s,o) => s + Number(o.montant_tva||0), 0);
  const n     = payes.length;
  const caAttente = attente.reduce((s,o) => s + Number(o.montant_total||0), 0);

  // CA mensuel
  const byMonth = new Array(12).fill(0);
  const nbByMonth = new Array(12).fill(0);
  payes.forEach(o => {
    const d = new Date(o.payment_date || o.created_at);
    if(!isNaN(d)) {
      const m = d.getUTCMonth();
      byMonth[m] += Number(o.montant_total||0);
      nbByMonth[m] += 1;
    }
  });
  // CA trimestriel
  const byQuarter = [0,0,0,0];
  byMonth.forEach((v,i) => byQuarter[Math.floor(i/3)] += v);

  return {
    year: y,
    ca_ttc: caTTC,
    ca_ht: caHT,
    tva_collectee: tva,
    nb_commandes: n,
    panier_moyen: n ? caTTC/n : 0,
    by_month: byMonth,
    nb_by_month: nbByMonth,
    by_quarter: byQuarter,
    seuil_micro: SEUIL_MICRO_BIENS,
    seuil_franchise_tva: SEUIL_FRANCHISE_TVA,
    pct_micro: SEUIL_MICRO_BIENS ? (caTTC/SEUIL_MICRO_BIENS)*100 : 0,
    pct_franchise_tva: SEUIL_FRANCHISE_TVA ? (caTTC/SEUIL_FRANCHISE_TVA)*100 : 0,
    ca_en_attente: caAttente,
    nb_en_attente: attente.length,
    nb_factures: orders.filter(o => o.invoice_number).length,
    orders_payes: payes,
    orders: orders
  };
}

/* CSV — Livre des recettes (format URSSAF micro-entreprise)
   Colonnes obligatoires : date, n° facture, client, mode encaissement, montant TTC */
async function exportRecettesCSV(sb, year){
  const c = await getCompta(sb, year);
  const head = ['Date encaissement', 'N° facture', 'N° commande', 'Client', 'Email', 'Mode d\'encaissement', 'Total HT (€)', 'TVA (€)', 'Total TTC (€)'];
  const rows = (c.orders_payes || c.orders).map(o => [
    dateFR(o.payment_date || o.created_at),
    o.invoice_number || '',
    o.numero || '',
    ((o.client_prenom||'') + ' ' + (o.client_nom||'')).trim(),
    o.client_email || '',
    o.payment_method || (o.payment_status === 'Payé' ? 'CB en ligne' : 'À encaisser'),
    num2(o.montant_ht || o.montant_total),
    num2(o.montant_tva),
    num2(o.montant_total)
  ]);
  // Ajout ligne TOTAL
  rows.push(['', '', '', '', '', 'TOTAL ' + c.year,
    num2(c.ca_ht), num2(c.tva_collectee), num2(c.ca_ttc)]);
  return '﻿' + head.map(csvEscape).join(';') + '\n' +
         rows.map(r => r.map(csvEscape).join(';')).join('\n');
}

/* CSV — Liste des factures emises (pour archive comptable) */
async function exportFacturesCSV(sb, year){
  const c = await getCompta(sb, year);
  const head = ['N° facture', 'Date', 'N° commande', 'Client', 'Email', 'Montant HT', 'TVA', 'Montant TTC', 'Mode paiement', 'Statut paiement', 'Date envoi'];
  const facts = c.orders.filter(o => o.invoice_number);
  const rows = facts.map(o => [
    o.invoice_number,
    dateFR(o.created_at),
    o.numero,
    ((o.client_prenom||'') + ' ' + (o.client_nom||'')).trim(),
    o.client_email || '',
    num2(o.montant_ht || o.montant_total),
    num2(o.montant_tva),
    num2(o.montant_total),
    o.payment_method || '',
    o.payment_status || '',
    dateFR(o.invoice_sent_at)
  ]);
  return '﻿' + head.map(csvEscape).join(';') + '\n' +
         rows.map(r => r.map(csvEscape).join(';')).join('\n');
}

module.exports = {
  getCompta,
  exportRecettesCSV,
  exportFacturesCSV,
  SEUIL_MICRO_BIENS,
  SEUIL_FRANCHISE_TVA
};
