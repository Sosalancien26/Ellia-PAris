/* ============================================================
   ELLIA PARIS — Generateur de factures PDF (luxe minimal)
   Utilise pdfkit. Retourne un Buffer prêt à attacher en mail.
   FORCE 1 page : doc.addPage est verrouille.
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

function eur(n){
  return Number(n||0).toLocaleString('fr-FR',{ minimumFractionDigits:2, maximumFractionDigits:2 }) + ' €';
}
function dateFr(d){
  const x = d instanceof Date ? d : new Date(d || Date.now());
  return x.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
}
function s(x){ return (x==null?'':String(x)); }

function generateInvoicePDF(order){
  return new Promise((resolve, reject) => {
    if(!PDFDocument) return reject(new Error('pdfkit_missing'));

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top:30, bottom:20, left:55, right:55 },
      info: {
        Title:    'Facture ' + (order.invoice_number || ''),
        Author:   'ELLIA PARIS',
        Subject:  'Facture commande ' + (order.numero || ''),
        Creator:  'Ellia Paris'
      }
    });

    // FORCE 1 SEULE PAGE — bloque addPage
    const _origAddPage = doc.addPage.bind(doc);
    let _pagesCreated = 0;
    doc.addPage = function(opts){
      if (_pagesCreated >= 1) return doc;
      _pagesCreated++;
      return _origAddPage(opts);
    };

    const bufs = [];
    doc.on('data', b => bufs.push(b));
    doc.on('end',  () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);

    /* ---------- HEADER : LOGO GROS + FACTURE ---------- */
    const logoPath = path.join(__dirname, 'assets', 'logo_black_trim.png');
    try {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 55, 40, { height: 90 });
      } else {
        doc.font('Helvetica-Bold').fontSize(36).fillColor(NOIR).text('ELLIA  PARIS', 55, 55);
      }
    } catch(_) {
      doc.font('Helvetica-Bold').fontSize(36).fillColor(NOIR).text('ELLIA  PARIS', 55, 55);
    }

    doc.font('Helvetica').fontSize(8).fillColor(GRIS2)
       .text('MAISON DE MAROQUINERIE  ·  PARIS', 55, 138, { characterSpacing: 1.6 });

    // Bloc FACTURE droite — colonne large pour pas wrap
    const rcolX = 340, rcolW = 200;
    doc.font('Helvetica').fontSize(9).fillColor(GRIS2)
       .text('FACTURE', rcolX, 70, { width:rcolW, align:'right', characterSpacing:3 });
    doc.font('Helvetica-Bold').fontSize(17).fillColor(NOIR)
       .text(s(order.invoice_number) || '—', rcolX, 86, { width:rcolW, align:'right', lineBreak:false });
    doc.font('Helvetica').fontSize(9).fillColor(GRIS)
       .text('Date : ' + dateFr(order.invoice_date || new Date()), rcolX, 112, { width:rcolW, align:'right' });
    if(order.numero){
      doc.text('Commande : ' + order.numero, rcolX, 126, { width:rcolW, align:'right' });
    }

    // Ligne separation
    doc.moveTo(55, 158).lineTo(540, 158).strokeColor(LIGNE).lineWidth(0.8).stroke();

    /* ---------- VENDEUR / CLIENT ---------- */
    const yBlocks = 175;
    doc.font('Helvetica').fontSize(8).fillColor(GRIS2)
       .text('VENDEUR', 55, yBlocks, { characterSpacing:1.8 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NOIR)
       .text('ELLIA PARIS', 55, yBlocks + 14);
    doc.font('Helvetica').fontSize(9).fillColor(GRIS)
       .text('Maison de maroquinerie', 55, yBlocks + 30, { lineBreak:false })
       .text('Paris, France',          55, yBlocks + 43, { lineBreak:false })
       .text('contact@ellia-paris.fr', 55, yBlocks + 56, { lineBreak:false })
       .text('ellia-paris.fr',         55, yBlocks + 69, { lineBreak:false });

    const clientX = 320;
    doc.font('Helvetica').fontSize(8).fillColor(GRIS2)
       .text('FACTURÉ À', clientX, yBlocks, { characterSpacing:1.8 });
    const clientLine1 = ((order.client_prenom||'') + ' ' + (order.client_nom||'')).trim() || '—';
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NOIR)
       .text(clientLine1, clientX, yBlocks + 14, { lineBreak:false });
    doc.font('Helvetica').fontSize(9).fillColor(GRIS);
    const lines = [
      order.adresse_facturation || order.adresse_livraison,
      ((order.cp_facturation || order.cp_livraison || '') + ' ' + (order.ville_facturation || order.ville_livraison || '')).trim(),
      order.pays_facturation || order.pays_livraison || 'France',
      order.client_email,
      order.telephone
    ].filter(Boolean);
    lines.forEach((ln, i) => doc.text(ln, clientX, yBlocks + 30 + i*13, { lineBreak:false }));

    /* ---------- TABLEAU LIGNES ---------- */
    let tableY = 305;
    doc.rect(55, tableY, 485, 22).fill(NOIR);
    doc.fillColor('#ffffff').font('Helvetica').fontSize(8).text('DÉSIGNATION', 65, tableY+7, { characterSpacing:1.4, lineBreak:false });
    doc.text('QTÉ',     340, tableY+7, { width:40, align:'right', characterSpacing:1.4, lineBreak:false });
    doc.text('PU HT',   390, tableY+7, { width:60, align:'right', characterSpacing:1.4, lineBreak:false });
    doc.text('TOTAL HT',470, tableY+7, { width:60, align:'right', characterSpacing:1.4, lineBreak:false });
    tableY += 32;

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
      doc.font('Helvetica-Bold').fontSize(10).fillColor(NOIR).text(it.label, 65, tableY, { lineBreak:false });
      if (it.sub) doc.font('Helvetica').fontSize(8).fillColor(GRIS2).text(it.sub, 65, tableY+13, { lineBreak:false });
      doc.font('Helvetica').fontSize(10).fillColor(NOIR);
      doc.text(String(it.qte), 340, tableY, { width:40, align:'right', lineBreak:false });
      doc.text(eur(it.pu),     390, tableY, { width:60, align:'right', lineBreak:false });
      doc.text(eur(total),     470, tableY, { width:60, align:'right', lineBreak:false });
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
    doc.text('Total HT',          totX,     tableY,    { width:120, align:'right', lineBreak:false });
    doc.text(eur(sumHT),          totX+125, tableY,    { width:60,  align:'right', lineBreak:false });
    doc.text('TVA ' + tva + ' %', totX,     tableY+18, { width:120, align:'right', lineBreak:false });
    doc.text(eur(sumTVA),         totX+125, tableY+18, { width:60,  align:'right', lineBreak:false });
    doc.moveTo(totX, tableY+38).lineTo(540, tableY+38).strokeColor(NOIR).lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(13).fillColor(NOIR);
    doc.text('TOTAL TTC', totX,     tableY+46, { width:120, align:'right', lineBreak:false });
    doc.text(eur(sumTTC), totX+125, tableY+46, { width:60,  align:'right', lineBreak:false });

    /* ---------- PAIEMENT + NOTES ---------- */
    const payY = tableY + 95;
    doc.font('Helvetica').fontSize(8).fillColor(GRIS2).text('PAIEMENT', 55, payY, { characterSpacing:1.8, lineBreak:false });
    doc.font('Helvetica').fontSize(10).fillColor(NOIR);
    doc.text('Mode : '   + (order.payment_method || '—'),     55, payY+14, { lineBreak:false });
    doc.text('Statut : ' + (order.payment_status || 'En attente'), 55, payY+28, { lineBreak:false });
    if (order.payment_date) {
      doc.text('Réglé le : ' + dateFr(order.payment_date), 55, payY+42, { lineBreak:false });
    }
    if (order.notes_admin) {
      doc.font('Helvetica').fontSize(8).fillColor(GRIS2).text('NOTES', 320, payY, { characterSpacing:1.8, lineBreak:false });
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRIS).text(order.notes_admin, 320, payY+14, { width:220, height:60, ellipsis:true });
    }

    /* ---------- FOOTER LEGAL ---------- */
    const footY = 745;
    doc.moveTo(55, footY).lineTo(540, footY).strokeColor(LIGNE).lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS2);
    const legal = 'ELLIA PARIS · Maison de maroquinerie · contact@ellia-paris.fr · ellia-paris.fr' +
      '\nTVA non applicable, art. 293 B du CGI · En cas de retard de paiement, indemnité forfaitaire pour frais de recouvrement de 40 € (art. L.441-10 du Code de commerce).';
    doc.text(legal, 55, footY+10, { width:485, align:'center', lineGap:2, height:40 });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(NOIR)
       .text('Merci de votre confiance', 55, footY+50, { width:485, align:'center', characterSpacing:1.4, lineBreak:false });

    doc.end();
  });
}

module.exports = { generateInvoicePDF, eur, dateFr };
