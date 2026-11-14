import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store"};
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function handleYocoCheckout(req) {
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return respond({error:"Method not allowed"},405);
 if(Number(req.headers.get("content-length")||0)>8192)return respond({error:"Request too large"},413);
 try{
  const url=Deno.env.get("SUPABASE_URL")||Deno.env.get("EXTERNAL_SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY");
  const serverKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const yocoKey=Deno.env.get("YOCO_SECRET_KEY");
  if(!url||!anon||!serverKey||!yocoKey)return respond({error:"Payment checkout is temporarily unavailable"},503);
  const bearer=req.headers.get("authorization")||"";
  if(!bearer.startsWith("Bearer "))return respond({error:"Authentication required"},401);
  const raw=await req.text();
  if(raw.length>8192)return respond({error:"Request too large"},413);
  let body;
  try{body=JSON.parse(raw);}catch{return respond({error:"Invalid JSON"},400);}
  const orderId=typeof body?.order_id==="string"?body.order_id:"";
  if(!uuid.test(orderId))return respond({error:"Invalid order reference"},400);
  if(body.amount!==undefined||body.amountInCents!==undefined||body.currency!==undefined)
   return respond({error:"Payment amounts are server-controlled"},400);
  // Never read amount, checkout URL or order ownership from the caller.
  const userClient=createClient(url,anon,{global:{headers:{Authorization:bearer}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:authError}=await userClient.auth.getUser();
  const user=userData?.user;
  if(authError||!user)return respond({error:"Authentication required"},401);
  const {data:quote,error:quoteError}=await userClient.rpc("rk_yoco_checkout_quote",{p_order_id:orderId});
  if(quoteError||!quote||quote.user_id!==user.id)return respond({error:"Order is not eligible for checkout; review your cart or contact support"},422);
  const amountCents=Number(quote.amount_cents);
  if(!Number.isSafeInteger(amountCents)||amountCents<200||quote.currency!=="ZAR")
    return respond({error:"Order price verification failed"},422);
  const qs=new URLSearchParams({payment:"success",order_id:orderId});
  const successUrl="https://www.reskonnect.org/orders?"+qs.toString();
  const cancelUrl="https://www.reskonnect.org/orders?payment=cancelled";
  const payment=await fetch("https://payments.yoco.com/api/checkouts",{
   method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+yocoKey,
    "Idempotency-Key":"reskonnect-"+orderId},
   body:JSON.stringify({amount:amountCents,currency:"ZAR",successUrl,cancelUrl,
    metadata:{order_id:orderId,order_number:quote.order_number,user_id:user.id}})
  });
  if(!payment.ok)return respond({error:"Payment provider could not create a checkout"},502);
  const checkout=await payment.json().catch(()=>null);
  const id=checkout?.id,redirect=checkout?.redirectUrl;
  if(typeof id!=="string"||id.length<5||id.length>160||typeof redirect!=="string")
   return respond({error:"Invalid payment provider checkout"},502);
  let target;
  try{target=new URL(redirect);}catch{return respond({error:"Invalid payment provider redirect"},502);}
  if(target.protocol!=="https:"||!(target.hostname==="yoco.com"||target.hostname.endsWith(".yoco.com")))
   return respond({error:"Payment provider redirect not trusted"},502);
  const service=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error:registerError}=await service.rpc("rk_yoco_register_checkout",{
   p_order_id:orderId,p_user_id:user.id,p_checkout_id:id,p_amount_cents:amountCents
  });
  if(registerError){
   // Never hand out a payable URL unless local settlement intent is durably stored.
   console.error("yoco checkout registration failed",{reason:registerError.code||"unknown"});
   return respond({error:"Checkout could not be safely linked; no payment link issued"},409);
  }
  return respond({redirectUrl:redirect,checkoutId:id,amount_cents:amountCents,currency:"ZAR"});
 }catch(e){
  console.error("secure Yoco checkout failed",{reason:e instanceof Error?e.name:"unknown"});
  return respond({error:"Payment checkout temporarily unavailable"},503);
 }
}
