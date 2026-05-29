/* ============================================================
   ELLIA PARIS — Generateur de factures PDF (luxe minimal)
   Utilise pdfkit. Retourne un Buffer prêt à attacher en mail.
   ============================================================ */
const fs = require('fs');
const path = require('path');

let PDFDocument = null;
try { PDFDocument = require('pdfkit'); }
catch(e){ console.warn('pdfkit indisponible — installer via npm install pdfkit'); }

const NOIR  = '#0d0d0d';
const GRIS  = '#5c5852';
const GRIS2 = '#8a857d';
const LIGNE = '#e0ddd6';
const IVOIRE= '#f3f1ec';

function eur(n){
  return Number(n||0).toLocaleString('fr-FR',{ minimumFractionDigits:2, maximumFractionDigits:2 }) + ' €';
}
function dateFr(d){
  const x = d instanceof Date ? d : new Date(d || Date.now());
  return x.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
}
function s(x){ return (x==null?'':String(x)); }

/**
 * Genere la facture PDF.
 * @param {object} order  - donnees de la commande (cf. orders table + invoice_number)
 * @returns {Promise<Buffer>}
 */
function generateInvoicePDF(order){
  return new Promise((resolve, reject) => {
    if(!PDFDocument) return reject(new Error('pdfkit_missing'));

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top:55, bottom:55, left:55, right:55 },
      info: {
        Title:    'Facture ' + (order.invoice_number || ''),
        Author:   'ELLIA PARIS',
        Subject:  'Facture commande ' + (order.numero || ''),
        Creator:  'Ellia Paris'
      }
    });

    const bufs = [];
    doc.on('data', b => bufs.push(b));
    doc.on('end',  () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);

    /* ---------- HEADER ---------- */
    const logoPath = path.join(__dirname, 'assets', 'logo_black_trim.png');
    try {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 55, 50, { height: 58 });
      } else {
        doc.font('Helvetica-Bold').fontSize(28).fillColor(NOIR).text('ELLIA  PARIS', 55, 58);
      }
    } catch(_) {
      doc.font('Helvetica-Bold').fontSize(28).fillColor(NOIR).text('ELLIA  PARIS', 55, 58);
    }

    doc.font('Helvetica').fontSize(8).fillColor(GRIS2)
       .text('MAISON DE MAROQUINERIE  ·  PARIS', 55, 118, { characterSpacing: 1.6 });

    // FACTURE bloc droite
    doc.font('Helvetica').fontSize(9).fillColor(GRIS2)
       .text('FACTURE', 400, 60, { width:140, align:'right', characterSpacing:3 });
    doc.font('Helvetica-Bold').fontSize(20).fillColor(NOIR)
       .text(s(order.invoice_number) || '—', 400, 75, { width:140, align:'right' });
    doc.font('Helvetica').fontSize(9).fillColor(GRIS)
       .text('Date : ' + dateFr(order.invoice_date || new Date()), 400, 102, { width:140, align:'right' });
    if(order.numero){
      doc.text('Commande : ' + order.numero, 400, 116, { width:140, align:'right' });
    }

    // Ligne separation
    doc.moveTo(55, 148).lineTo(540, 148).strokeColor(LIGNE).lineWidth(0.8).stroke();

    /* ---------- VENDEUR / CLIENT ---------- */
    const yBlocks = 168;
    // VENDEUR
    doc.font('Helvetica').fontSize(8).fillColor(GRIS2)
       .text('VENDEUR', 55, yBlocks, { characterSpacing:1.8 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NOIR)
       .text('ELLIA PARIS', 55, yBlocks + 14);
    doc.font('Helvetica').fontSize(9).fillColor(GRIS)
       .text('Maison de maroquinerie', 55, yBlocks + 30)
       .text('Paris, France', 55, yBlocks + 43)
       .text('contact@ellia-paris.fr', 55, yBlocks + 56)
       .text('ellia-paris.fr', 55, yBlocks + 69);

    // CLIENT
    const clientX = 320;
    doc.font('Helvetica').fontSize(8).fillColor(GRIS2)
       .text('FACTURÉ À', clientX, yBlocks, { characterSpacing:1.8 });
    const clientLine1 = ((order.client_prenom||'') + ' ' + (order.client_nom||'')).trim() || '—';
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NOIR)
       .text(clientLine1, clientX, yBlocks + 14);
    doc.font('Helvetica').fontSize(9).fillColor(GRIS);
    const lines = [
      order.adresse_facturation || order.adresse_livraison,
      ((order.cp_facturation || order.cp_livraison || '') + ' ' + (order.ville_facturation || order.ville_livraison || '')).trim(),
      order.pays_facturation || order.pays_livraison || 'France',
      order.client_email,
      order.telephone
    ].filter(Boolean);
    lines.forEach((ln, i) => doc.text(ln, clientX, yBlocks + 30 + i*13));

    /* ---------- TABLEAU LIGNES ---------- */
    let tableY = 290;
    // En-tete
    doc.rect(55, tableY, 485, 22).fill(NOIR);
    doc.fillColor('#ffffff').font('Helvetica').fontSize(8).text('DÉSIGNATION', 65, tableY+7, { characterSpacing:1.4 });
    doc.text('QTÉ',  340, tableY+7, { width:40, align:'right', characterSpacing:1.4 });
    doc.text('PU HT', 390, tableY+7, { width:60, align:'right', characterSpacing:1.4 });
    doc.text('TOTAL HT', 470, tableY+7, { width:60, align:'right', characterSpacing:1.4 });

    tableY += 32;

    // Lignes
    const tva = Number(order.tva_rate != null ? order.tva_rate : 20);
    const tvaCoef = 1 + tva/100;
    const items = [];

    const qte = Number(order.quantite || 1);
    const pochettePrixHT = Number(order.prix_pochette || 159) / tvaCoef;
    items.push({
      label: 'La Pochette ELLIA — Cuir grainé',
      sub:   'Référence : ELLIA-NOIR',
      qte:   qte,
      pu:    pochettePrixHT
    });

    if (Number(order.prix_personnalisation || 0) > 0) {
      const persoPrixHT = Number(order.prix_personnalisation) / tvaCoef;
      const persoSub = [
        order.initiales ? ('Initiales : ' + order.initiales) : null,
        order.finition ? ('Finition : ' + order.finition) : null,
        order.emplacement ? ('Emplacement : ' + order.emplacement) : null
      ].filter(Boolean).join('  ·  ');
      items.push({
        label: 'Gravure personnalisée',
        sub:   persoSub || 'Initiales gravées sur plaque',
        qte:   qte,
        pu:    persoPrixHT
      });
    }

    if (Number(order.frais_port || 0) > 0) {
      const portHT = Number(order.frais_port) / tvaCoef;
      items.push({ label: 'Frais de livraison', sub: '', qte: 1, pu: portHT });
    }

    items.forEach(it => {
      const total = it.pu * it.qte;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(NOIR).text(it.label, 65, tableY);
      if (it.sub) doc.font('Helvetica').fontSize(8).fillColor(GRIS2).text(it.sub, 65, tableY+13);
      doc.font('Helvetica').fontSize(10).fillColor(NOIR);
      doc.text(String(it.qte),     340, tableY, { width:40, align:'right' });
      doc.text(eur(it.pu),         390, tableY, { width:60, align:'right' });
      doc.text(eur(total),         470, tableY, { width:60, align:'right' });
      const rowH = it.sub ? 32 : 22;
      doc.moveTo(55, tableY+rowH-2).lineTo(540, tableY+rowH-2).strokeColor(LIGNE).lineWidth(0.5).stroke();
      tableY += rowH;
    });

    /* ---------- TOTAUX ---------- */
    tableY += 14;
    const sumHT = items.reduce((s,it) => s + it.pu * it.qte, 0);
    const sumTVA = sumHT * tva / 100;
    const sumTTC = sumHT + sumTVA;

    const totX = 350;
    doc.font('Helvetica').fontSize(10).fillColor(GRIS);
    doc.text('Total HT',          totX, tableY,    { width:120, align:'right' });
    doc.text(eur(sumHT),           totX+125, tableY,{ width:60, align:'right' });
    doc.text('TVA ' + tva + ' %', totX, tableY+18,  { width:120, align:'right' });
    doc.text(eur(sumTVA),          totX+125, tableY+18, { width:60, align:'right' });

    doc.moveTo(totX, tableY+38).lineTo(540, tableY+38).strokeColor(NOIR).lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(13).fillColor(NOIR);
    doc.text('TOTAL TTC',          totX, tableY+46, { width:120, align:'right' });
    doc.text(eur(sumTTC),          totX+125, tableY+46, { width:60, align:'right' });

    /* ---------- PAIEMENT ---------- */
    const payY = tableY + 95;
    doc.font('Helvetica').fontSize(8).fillColor(GRIS2).text('PAIEMENT', 55, payY, { characterSpacing:1.8 });
    doc.font('Helvetica').fontSize(10).fillColor(NOIR);
    doc.text('Mode : ' + (order.payment_method || '—'), 55, payY+14);
    doc.text('Statut : ' + (order.payment_status || 'En attente'), 55, payY+28);
    if (order.payment_date) {
      doc.text('Réglé le : ' + dateFr(order.payment_date), 55, payY+42);
    }

    if (order.notes_admin) {
      doc.font('Helvetica').fontSize(8).fillColor(GRIS2).text('NOTES', 320, payY, { characterSpacing:1.8 });
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRIS).text(order.notes_admin, 320, payY+14, { width:220 });
    }

    /* ---------- FOOTER LEGAL ---------- */
    const footY = 760;
    doc.moveTo(55, footY).lineTo(540, footY).strokeColor(LIGNE).lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS2);
    const legal = 'ELLIA PARIS · Maison de maroquinerie · contact@ellia-paris.fr · ellia-paris.fr' +
      '\nTVA non applicable, art. 293 B du CGI · En cas de retard de paiement, indemnité forfaitaire pour frais de recouvrement de 40 € (art. L.441-10 du Code de commerce).';
    doc.text(legal, 55, footY+10, { width:485, align:'center', lineGap:2 });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(NOIR)
       .text('Merci de votre confiance', 55, footY+44, { width:485, align:'center', characterSpacing:1.4 });

    doc.end();
  });
}

module.exports = { generateInvoicePDF, eur, dateFr };
