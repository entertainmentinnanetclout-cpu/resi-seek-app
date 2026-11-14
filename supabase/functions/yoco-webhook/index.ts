import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
import { verifyYocoWebhook } from "../_shared/yoco-webhook-security.mjs";

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async (req:Request)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 if(Number(req.headers.get("content-length")||0)>1024*1024)return json({error:"Payload too large"},413);
 const webhookSecret=Deno.env.get("YOCO_WEBHOOK_SECRET")||"";
 if(!webhookSecret)return json({error:"Webhook verifier unavailable"},503);
 const raw=await req.text();
 if(raw.length>1024*1024)return json({error:"Payload too large"},413);
 const verified=await verifyYocoWebhook({headers:req.headers,rawBody:raw,secret:webhookSecret});
 if(!verified.ok){
  console.warn("Yoco signature denied",{reason:verified.reason});
  return json({error:"Invalid webhook authentication"},401);
 }
 let event:any;
 try{event=JSON.parse(raw);}catch{return json({error:"Invalid event JSON"},400);}
 if(typeof event!=="object"||!event||Array.isArray(event))return json({error:"Invalid event"},400);
 if(event.id!==verified.id)return json({error:"Webhook event ID mismatch"},400);
 if(!["payment.succeeded","payment.failed"].includes(event.type)){
  // Signed but unsupported events do not change financial state.
  return json({received:true,ignored:true});
 }
 const payment=event.payload;
 const orderId=payment?.metadata?.order_id;
 const paymentId=payment?.id;
 const amount=payment?.amount;
 const currency=payment?.currency;
 if(typeof orderId!=="string"||!uuid.test(orderId)
  ||typeof paymentId!=="string"||paymentId.length<4||paymentId.length>180
  ||!Number.isSafeInteger(amount)||amount<200||currency!=="ZAR")
  return json({error:"Payment event missing immutable order, amount or currency"},400);
 if(payment.status&&payment.status!==(event.type==="payment.succeeded"?"succeeded":"failed"))
  return json({error:"Payment event status does not match event type"},400);
 const supabaseUrl=Deno.env.get("SUPABASE_URL")||Deno.env.get("EXTERNAL_SUPABASE_URL");
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
 if(!supabaseUrl||!serviceKey)return json({error:"Payment processing unavailable"},503);
 try {
  // This is an atomic DB transaction: intent lookup, amount and order lock,
  // durable event dedupe, order paid state, payment ledger and status history.
  // A valid Yoco signature alone NEVER approves an unrelated order.
  const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await service.rpc("rk_yoco_apply_verified_event",{
   p_event_id:verified.id,p_order_id:orderId,p_payment_id:paymentId,
   p_event_type:event.type,p_amount_cents:amount,p_currency:currency
  });
  if(error){
   console.error("Verified Yoco event rejected by settlement guard",{code:error.code||"db",eventType:event.type});
   return json({error:"Payment event cannot be reconciled"},409);
  }
  return json({received:true,duplicate:Boolean(data?.duplicate),paid:Boolean(data?.paid)});
 }catch(e){
  console.error("Yoco settlement unavailable",{reason:e instanceof Error?e.name:"unknown"});
  return json({error:"Payment processing temporarily unavailable"},503);
 }
});
