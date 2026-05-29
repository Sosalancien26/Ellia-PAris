/* ============================================================
   ELLIA PARIS — TOTP RFC 6238 (Google Authenticator) — pure JS
   Pas de dependance externe.
   ============================================================ */
const crypto = require('crypto');
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf){
  let bits=0, value=0, out='';
  for(let i=0;i<buf.length;i++){
    value = (value<<8) | buf[i]; bits += 8;
    while(bits>=5){ out += ALPHA[(value >>> (bits-5)) & 0x1f]; bits -= 5; }
  }
  if(bits>0) out += ALPHA[(value << (5-bits)) & 0x1f];
  return out;
}
function base32Decode(str){
  str = String(str||'').toUpperCase().replace(/[^A-Z2-7]/g,'');
  let bits=0, value=0, out=[];
  for(let i=0;i<str.length;i++){
    const idx = ALPHA.indexOf(str[i]); if(idx<0) continue;
    value = (value<<5) | idx; bits += 5;
    if(bits>=8){ out.push((value >>> (bits-8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

function generateSecret(){ return base32Encode(crypto.randomBytes(20)); }

function totpCode(secret, time, digits=6, period=30){
  const counter = Math.floor((time||Date.now())/1000/period);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter/0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length-1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset+1] & 0xff) << 16) |
               ((hmac[offset+2] & 0xff) << 8) |
                (hmac[offset+3] & 0xff);
  return String(code % Math.pow(10, digits)).padStart(digits, '0');
}

function verify(secret, token, windowSize){
  if(!secret || !token) return false;
  const t = String(token).replace(/\D/g,'');
  if(t.length !== 6) return false;
  const w = windowSize == null ? 1 : windowSize;
  const now = Date.now();
  for(let i=-w; i<=w; i++){
    if(totpCode(secret, now + i*30000) === t) return true;
  }
  return false;
}

function otpauthUri(secret, accountName, issuer){
  const i = encodeURIComponent(issuer||'ELLIA PARIS');
  const a = encodeURIComponent(accountName||'admin');
  return 'otpauth://totp/' + i + ':' + a + '?secret=' + secret + '&issuer=' + i + '&algorithm=SHA1&digits=6&period=30';
}

module.exports = { generateSecret, totpCode, verify, otpauthUri };
