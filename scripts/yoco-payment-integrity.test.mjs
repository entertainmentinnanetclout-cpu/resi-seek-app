import { strict as assert } from "node:assert";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyYocoWebhook } from "../supabase/functions/_shared/yoco-webhook-security.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const check=(condition,reason)=>{assert.ok(condition,reason);console.log("PASS",reason);};
const sec=Buffer.from(randomBytes(32));
const secret="whsec_"+sec.toString("base64");
const now=Math.floor(Date.now()/1000),id="evt_test_001";
const raw=JSON.stringify({id,type:"payment.succeeded",payload:{id:"pay_test_001",amount:4999,currency:"ZAR",metadata:{order_id:"00000000-0000-4000-8000-000000000001"}}});
function sign(body=raw,stamp=String(now)){
 const digest=createHmac("sha256",sec).update(id+"."+stamp+"."+body).digest("base64");
 return new Headers({"webhook-id":id,"webhook-timestamp":stamp,"webhook-signature":"v1,"+digest});
}
check((await verifyYocoWebhook({headers:sign(),rawBody:raw,secret,nowSeconds:now})).ok,
 "Valid signed Standard Webhooks message accepted");
check((await verifyYocoWebhook({headers:sign(),rawBody:raw+" ",secret,nowSeconds:now})).ok===false,
 "Modified body rejected (raw-byte binding)");
check((await verifyYocoWebhook({headers:sign(raw,String(now-181)),rawBody:raw,secret,nowSeconds:now})).ok===false,
 "Old but otherwise valid event rejected (180-second window)");
check((await verifyYocoWebhook({headers:sign(raw,String(now+181)),rawBody:raw,secret,nowSeconds:now})).ok===false,
 "Future replay window rejected");
check((await verifyYocoWebhook({headers:sign(),rawBody:raw,secret:"",nowSeconds:now})).ok===false,
 "Missing Yoco webhook secret fails closed");
check((await verifyYocoWebhook({headers:new Headers(),rawBody:raw,secret,nowSeconds:now})).ok===false,
 "Unsigned events cannot enter settlement");
const multi=sign();multi.set("webhook-signature","v1,"+Buffer.from(randomBytes(32)).toString("base64")+" "+sign().get("webhook-signature"));
check((await verifyYocoWebhook({headers:multi,rawBody:raw,secret,nowSeconds:now})).ok,
 "Multiple rotating signatures handled without trusting an invalid first candidate");

const sql=read("supabase/migrations/20261114212000_sec01_sec02_yoco_payment_guards.sql");
const quote=read("supabase/functions/_shared/yoco-checkout-secure.mjs");
const gateway=read("supabase/functions/yoco-webhook/index.ts");
const verify=read("supabase/functions/yoco-verify-payment/index.ts");
const cfg=read("supabase/config.toml");
for(const label of ["rk_yoco_checkout_quote","rk_yoco_register_checkout","rk_yoco_apply_verified_event",
 "rk_shop_order_guard_money","rk_yoco_verified_events","rk_yoco_payment_intents"])check(sql.includes(label),"Verified SQL includes "+label);
check(sql.includes('drop policy if exists "users_manage_own_shop_orders"')
 &&sql.includes("Order financial and fulfillment fields are server controlled"),
 "Old ALL permission removed and customer status tampering rejected");
check(sql.includes("round(coalesce(v_order.total_amount,0)*100)::bigint<>v_total_cents")
 &&sql.includes("unit_price")&&sql.includes("public.delivery_zones"),
 "Server quote checks catalog line items, actual delivery zone and order total");
check(sql.includes("on conflict (event_id) do nothing")
 &&sql.includes("for update")&&sql.includes("rk_yoco_paid_payment_reference_unique"),
 "Payment event dedupe and order row locking are durable and transaction scoped");
check(sql.includes("auth.role()<>'service_role'")
 &&sql.includes("grant execute on function public.rk_yoco_apply_verified_event")
 &&sql.includes("to service_role;"),"Financial settle and intent registration require service JWT");
check(!quote.includes("body.amount")||quote.includes("body.amount!==undefined"),
 "Customer amount is always rejected rather than trusted");
check(quote.includes('userClient.rpc("rk_yoco_checkout_quote"')
 &&quote.includes('service.rpc("rk_yoco_register_checkout"')
 &&quote.includes("Idempotency-Key")
 &&quote.includes('target.hostname.endsWith(".yoco.com")'),
 "Checkout uses server quote, user auth, durable intent and trusted provider redirect");
check(gateway.includes("verifyYocoWebhook")&&gateway.indexOf("verifyYocoWebhook")<gateway.indexOf('service.rpc("rk_yoco_apply_verified_event"'),
 "Authenticity is checked before the privileged payment write");
check(gateway.includes("webhookSecret")&&gateway.includes("YOCO_WEBHOOK_SECRET")
 &&gateway.includes('event.id!==verified.id'),
 "No settlement without provider secret and event ID match");
check(!verify.includes('update({')&&!verify.includes(".rpc("),
 "Browser payment return can never mark its own order paid");
check(cfg.includes("[functions.yoco-webhook]\n# Yoco sends signed Standard Webhooks") &&
 cfg.includes("verify_jwt = false"),
 "Provider webhook transport does not require a Supabase user token; HMAC is mandatory");
for(const path of ["supabase/functions/create-payment/index.ts","supabase/functions/yoco-checkout/index.ts"])
 check(read(path).includes("handleYocoCheckout"),"Both checkout function aliases share one pricing gate: "+path);
console.log("SEC-01/SEC-02 payment hardening regressions passed.");
