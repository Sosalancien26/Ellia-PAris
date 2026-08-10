/* ELLIA PARIS — Bandeau cookies CNIL-compatible
   Stocke le choix dans localStorage. Aucun tracking actif tant qu'aucun consentement.
   API publique : window.elliaCookies.consent('essentiels'|'tous'|null) */
(function(){
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const KEY = 'ellia_cookies_consent_v1';
  function get(){ try{ return JSON.parse(localStorage.getItem(KEY)); }catch(_){ return null; } }
  function set(v){ try{ localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), choice: v })); }catch(_){} }

  window.elliaCookies = {
    consent: function(c){ set(c); hide(); apply(c); },
    has: function(){ return !!this.choice(); },
    // Six mois : duree recommandee par la CNIL avant de redemander.
    choice: function(){
      const g = get();
      if (!g || !g.ts) return null;
      if (Date.now() - g.ts > 15552000000) { try{ localStorage.removeItem(KEY); }catch(_){} return null; }
      return g.choice;
    },
    show: show
  };

  function apply(choice){
    if (choice === 'tous') {
      // Active GA4 / Meta Pixel ici si tu configures GA_ID / META_PIXEL_ID
      const ga = document.querySelector('meta[name="ga-id"]');
      if (ga && ga.content && !window.gtag) {
        const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ga.content;
        document.head.appendChild(s);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function(){ dataLayer.push(arguments); };
        gtag('js', new Date()); gtag('config', ga.content);
      }
    }
  }

  function hide(){ const b = document.getElementById('elliaCookieBanner'); if (b) b.style.display = 'none'; }
  function show(){
    if (document.getElementById('elliaCookieBanner')) { document.getElementById('elliaCookieBanner').style.display = 'flex'; return; }
    const css = '#elliaCookieBanner{position:fixed;inset:auto 14px 14px 14px;z-index:9999;background:#fff;color:#0d0d0d;box-shadow:0 30px 60px -20px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.08);padding:22px 26px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;max-width:980px;margin:0 auto;animation:elliaCkIn .4s cubic-bezier(.22,.61,.36,1)}#elliaCookieBanner .ek-txt{flex:1;min-width:240px;color:#3a3833}#elliaCookieBanner .ek-txt b{font-family:Georgia,"Times New Roman",serif;font-weight:600;letter-spacing:.02em;color:#0d0d0d;display:block;margin-bottom:4px;font-size:14px}#elliaCookieBanner .ek-txt a{color:#0d0d0d;text-decoration:underline}#elliaCookieBanner .ek-btns{display:flex;gap:8px;flex-wrap:wrap}#elliaCookieBanner button{font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:11px 18px;border:1px solid transparent;cursor:pointer;transition:.2s}#elliaCookieBanner .ek-deny{background:#fff;color:#0d0d0d;border-color:rgba(0,0,0,.18)}#elliaCookieBanner .ek-deny:hover{border-color:#0d0d0d}#elliaCookieBanner .ek-accept{background:#0d0d0d;color:#fff}#elliaCookieBanner .ek-accept:hover{background:#2a2a2a}@keyframes elliaCkIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@media(max-width:560px){#elliaCookieBanner{padding:18px 18px;flex-direction:column;align-items:stretch}#elliaCookieBanner .ek-btns{justify-content:flex-end}}';
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    const b = document.createElement('div');
    b.id = 'elliaCookieBanner';
    b.innerHTML =
      '<div class="ek-txt"><b>Confidentialité &amp; cookies</b>Nous utilisons des cookies essentiels au bon fonctionnement du site, et — avec votre accord — des cookies de mesure d\'audience pour améliorer votre expérience. Vous pouvez modifier ce choix à tout moment depuis notre <a href="/confidentialite.html">page Confidentialité</a>.</div>'+
      '<div class="ek-btns"><button class="ek-deny" type="button">Refuser</button><button class="ek-accept" type="button">Tout accepter</button></div>';
    document.body.appendChild(b);
    b.querySelector('.ek-deny').onclick = function(){ window.elliaCookies.consent('essentiels'); };
    b.querySelector('.ek-accept').onclick = function(){ window.elliaCookies.consent('tous'); };
  }

  function init(){
    const choice = window.elliaCookies.choice();
    if (!choice) show(); else apply(choice);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
