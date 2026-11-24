import {createClient} from "https://esm.sh/@supabase/supabase-js@2.79.0";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || "";
const cors = {
 "Access-Control-Allow-Origin": "*",
 "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods": "GET, OPTIONS",
 "Cache-Control": "no-store",
 "X-Content-Type-Options": "nosniff",
};
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{...cors,"Content-Type":"application/json"},
});
const validKey=(value:unknown)=>typeof value==="string"&&/^B[A-Za-z0-9_-]{86}$/.test(value);
// Return only the PUBLIC key from encrypted Vault; never expose private material.
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="GET")return json({error:"Method not allowed"},405);
 if(!supabaseUrl||!anonKey)return json({configured:false,error:"Push key service configuration unavailable"},503);
 try{
   const client=createClient(supabaseUrl,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await client.rpc("rk_web_push_public_key");
   if(error||!validKey(data)){
     console.warn("[vapid-public-key] Vault public key missing or invalid",error?.code||"not_configured");
     return json({configured:false,error:"Web push signing key has not been configured correctly"},503);
   }
   return json({configured:true,publicKey:data});
 }catch(error){
   console.error("[vapid-public-key] public key lookup failed",error instanceof Error?error.message:"unknown");
   return json({configured:false,error:"Web push key lookup temporarily unavailable"},503);
 }
});
