// Pure verifier shared by Deno Edge and Node regression tests.
// Algorithm: Yoco Checkout API Standard Webhooks (official docs).
export async function verifyYocoWebhook({ headers, rawBody, secret, nowSeconds = Math.floor(Date.now()/1000) }) {
  if (!secret || !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)) return { ok:false, reason:"secret_unconfigured" };
  const id=headers.get("webhook-id")||"", stamp=headers.get("webhook-timestamp")||"";
  const signatures=headers.get("webhook-signature")||"";
  if (!/^[A-Za-z0-9_-]{4,180}$/.test(id) || !/^[0-9]{10}$/.test(stamp)
     || !signatures || typeof rawBody!=="string" || rawBody.length>1024*1024) return {ok:false,reason:"malformed_headers"};
  const timestamp=Number(stamp);
  if (!Number.isSafeInteger(timestamp) || Math.abs(timestamp-nowSeconds)>180) return {ok:false,reason:"stale_timestamp"};
  let decoded;
  try {decoded=Uint8Array.from(atob(secret.slice(6)),ch=>ch.charCodeAt(0));}
  catch {return {ok:false,reason:"secret_unconfigured"};}
  if(decoded.length<16)return {ok:false,reason:"secret_unconfigured"};
  const key=await crypto.subtle.importKey("raw",decoded,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const data=new TextEncoder().encode(id+"."+stamp+"."+rawBody);
  const expected=new Uint8Array(await crypto.subtle.sign("HMAC",key,data));
  const received=signatures.split(/\s+/).filter(v=>v.startsWith("v1,")&&v.length<100);
  let valid=0;
  for(const candidate of received){
    let bytes;
    try {bytes=Uint8Array.from(atob(candidate.slice(3)),c=>c.charCodeAt(0));}
    catch{continue;}
    if(bytes.length!==expected.length)continue;
    let difference=0;
    for(let i=0;i<expected.length;i++)difference|=expected[i]^bytes[i];
    valid|=Number(difference===0);
  }
  return valid?{ok:true,id}:{ok:false,reason:"bad_signature"};
}
