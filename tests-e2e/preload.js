/* ============================================================
   ELLIA PARIS — Banc d'essai : préchargement du serveur
   ------------------------------------------------------------
   Lancé avec `node -r ./tests-e2e/preload.js server.js`.
   · nodemailer : aucun e-mail ne part ; chaque envoi est écrit dans
     tests-e2e/out/mails.jsonl (de, à, objet, html, pièces jointes).
   · stripe : la création de session et la liste sont simulées ;
     la VÉRIFICATION DE SIGNATURE des webhooks reste celle de la vraie
     bibliothèque (le banc signe ses événements avec le même secret).
   ============================================================ */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const MAILS = path.join(OUT, 'mails.jsonl');
const SESSIONS = path.join(OUT, 'stripe-sessions.jsonl');

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'nodemailer') {
    const real = origLoad.apply(this, arguments);
    return Object.assign({}, real, {
      createTransport: () => ({
        sendMail: async (m) => {
          const rec = { at: new Date().toISOString(), from: m.from, to: m.to, replyTo: m.replyTo, subject: m.subject,
            list: !!m.list, html: m.html || '', text: m.text || '',
            attachments: (m.attachments || []).map(a => ({ filename: a.filename, contentType: a.contentType, size: a.content ? a.content.length : 0, cid: a.cid || null })) };
          // La facture PDF est conservee pour verification
          for (const a of (m.attachments || [])) if (a.contentType === 'application/pdf' && a.content) fs.writeFileSync(path.join(OUT, 'pdf-' + a.filename), a.content);
          fs.appendFileSync(MAILS, JSON.stringify(rec) + '\n');
          return { messageId: 'banc-' + Date.now() };
        },
        verify: async () => true
      })
    });
  }
  if (request === 'stripe') {
    const realFactory = origLoad.apply(this, arguments);
    return function (key, opts) {
      const real = realFactory(key, opts);
      let n = 0;
      const sessions = new Map();
      return {
        webhooks: real.webhooks,                 // signature verifiee pour de vrai
        checkout: {
          sessions: {
            create: async (params) => {
              n++;
              const id = 'cs_test_banc_' + String(n).padStart(4, '0');
              const total = (params.line_items || []).reduce((s, li) => s + (li.price_data.unit_amount * (li.quantity || 1)), 0);
              const s = { id, object: 'checkout.session', url: 'http://127.0.0.1:0/stripe-checkout/' + id, amount_total: total, currency: 'eur',
                customer_email: params.customer_email || null, metadata: params.metadata || {},
                payment_intent: 'pi_banc_' + String(n).padStart(4, '0'), payment_status: 'unpaid', status: 'open',
                expires_at: params.expires_at || null, created: Math.floor(Date.now() / 1000), livemode: false };
              sessions.set(id, s);
              fs.appendFileSync(SESSIONS, JSON.stringify(s) + '\n');
              return s;
            },
            list: async () => ({ data: [...sessions.values()].filter(s => s.payment_status === 'paid'), has_more: false }),
            retrieve: async (id) => sessions.get(id) || null,
            expire: async (id) => { const s = sessions.get(id); if (s) s.status = 'expired'; return s; }
          }
        },
        paymentIntents: { retrieve: async (id) => ({ id, status: 'succeeded' }) },
        refunds: { create: async (p) => { fs.appendFileSync(path.join(OUT, 'refunds.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...p }) + '\n'); return { id: 're_banc', status: 'succeeded' }; } },
        _banc: { sessions }
      };
    };
  }
  return origLoad.apply(this, arguments);
};
