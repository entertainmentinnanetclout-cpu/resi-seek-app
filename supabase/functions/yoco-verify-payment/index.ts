import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 if(Number(req.headers.get("content-length")||0)>4096)return json({error:"Request too large"},413);
 try{
  const url=Deno.env.get("SUPABASE_URL")||Deno.env.get("EXTERNAL_SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY");
  if(!url||!anon)return json({error:"Payment verification unavailable"},503);
  const authorization=req.headers.get("Authorization")||"";
  if(!authorization.startsWith("Bearer "))return json({error:"Authentication required"},401);
  const {data:identity,error:identityError}=await createClient(url,anon,{
    global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}
  }).auth.getUser();
  if(identityError||!identity?.user)return json({error:"Authentication required"},401);
  const raw=await req.text();
  if(raw.length>4096)return json({error:"Request too large"},413);
  let body:any;try{body=JSON.parse(raw);}catch{return json({error:"Invalid JSON"},400);}
  if(typeof body?.order_id!=="string"||!uuid.test(body.order_id))return json({error:"Invalid order"},400);
  const userClient=createClient(url,anon,{
   global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:order,error}=await userClient.from("shop_orders")
    .select("id,user_id,payment_method,payment_status,status,yoco_checkout_id")
    .eq("id",body.order_id).eq("user_id",identity.user.id).maybeSingle();
  if(error||!order)return json({error:"Order not found or access denied"},404);
  if(order.payment_method!=="yoco")return json({error:"Not a Yoco checkout"},400);
  // Browser redirects and direct Yoco checkout status lookups are never payment proof.
  // Only a signed, replay-protected webhook invoking the settlement RPC may mark paid.
  const paid=order.payment_status==="paid"&&order.status==="confirmed"&&!!order.yoco_checkout_id;
  return json({verified:paid,status:paid?"confirmed":"pending_webhook"});
 }catch(e){
  console.error("Yoco order status read unavailable",{reason:e instanceof Error?e.name:"unknown"});
  return json({error:"Payment status temporarily unavailable"},503);
 }
});
