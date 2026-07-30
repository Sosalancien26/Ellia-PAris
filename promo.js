/* ============================================================
   ELLIA PARIS — Codes promo (CRUD admin + validation checkout)
   ============================================================ */

async function listPromoCodes(sb){
  try { return await sb('promo_codes?select=*&order=created_at.desc'); }
  catch(_){ return []; }
}

async function createPromoCode(sb, d){
  const row = {
    code: String(d.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,40),
    discount_type: ['percent','fixed','shipping'].includes(d.discount_type) ? d.discount_type : 'percent',
    discount_value: (String(d.discount_type) === 'percent')
      ? Math.max(0, Math.min(100, Number(d.discount_value||0)))      // pourcentage : 0-100
      : Math.max(0, Math.min(100000, Number(d.discount_value||0))),  // montant fixe
    min_order: Math.max(0, Math.min(100000, Number(d.min_order||0))),
    max_uses: d.max_uses ? Math.max(1, Math.min(100000, Number(d.max_uses))) : null,
    expires_at: d.expires_at || null,
    description: String(d.description||'').slice(0,200) || null,
    active: d.active !== false
  };
  if(row.code.length < 2) throw new Error('code_invalid');
  return await sb('promo_codes', { method:'POST', body: row, prefer:'return=representation' });
}

async function deletePromoCode(sb, code){
  return await sb('promo_codes?code=eq.'+encodeURIComponent(code), { method:'DELETE' });
}

async function togglePromoCode(sb, code, active){
  return await sb('promo_codes?code=eq.'+encodeURIComponent(code), { method:'PATCH', body:{ active: !!active } });
}

/* Valide un code pour un montant donne. Retourne { valid, discount, ... } */
async function validatePromoCode(sb, code, orderTTC){
  const c = String(code||'').toUpperCase().trim();
  if(!c) return { valid:false, error:'empty' };
  const rows = await sb('promo_codes?code=eq.'+encodeURIComponent(c)+'&active=eq.true');
  const p = rows && rows[0];
  if(!p) return { valid:false, error:'not_found' };
  if(p.expires_at && new Date(p.expires_at) < new Date()) return { valid:false, error:'expired' };
  if(p.max_uses != null && p.used_count >= p.max_uses) return { valid:false, error:'used_up' };
  const amt = Number(orderTTC||0);
  if(amt < Number(p.min_order||0)) return { valid:false, error:'min_order', min_order:Number(p.min_order) };
  let discount = 0, free_shipping = false;
  if(p.discount_type === 'percent'){
    const pct = Math.max(0, Math.min(100, Number(p.discount_value) || 0));   // jamais plus de 100 %
    if (Number(p.discount_value) > 100) console.warn('[PROMO] '+p.code+' : pourcentage '+p.discount_value+' plafonne a 100');
    discount = Math.min(amt, Math.round(amt * pct) / 100);
  }
  else if(p.discount_type === 'fixed') discount = Math.min(amt, Number(p.discount_value));
  else if(p.discount_type === 'shipping') free_shipping = true;
  return { valid:true, code:p.code, discount, type:p.discount_type, description:p.description, free_shipping };
}

async function incrementPromoUsage(sb, code){
  try {
    const rows = await sb('promo_codes?code=eq.'+encodeURIComponent(code)+'&select=used_count');
    if(rows && rows[0]) {
      return await sb('promo_codes?code=eq.'+encodeURIComponent(code), {
        method:'PATCH', body:{ used_count: Number(rows[0].used_count||0) + 1 }
      });
    }
  } catch(_){}
}

module.exports = { listPromoCodes, createPromoCode, deletePromoCode, togglePromoCode, validatePromoCode, incrementPromoUsage };
