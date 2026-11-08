
import { createClient } from "npm:@supabase/supabase-js@2.86.2";
const BASE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};
const respond = (data: unknown, status=200) => new Response(JSON.stringify(data), {status, headers: BASE_HEADERS});
const base64url = (bytes: Uint8Array): string => {
  let s = ""; for(const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
};
const sha = async (value:string) => new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));

Deno.serve(async (req: Request) => {
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers: BASE_HEADERS});
  if(req.method!=="POST") return respond({error:"Method not allowed"},405);
  const token = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token) return respond({error:"Sign in to ResKonnect first"},401);
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url || !service) return respond({error:"Service not configured"},503);
  const admin = createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const auth = await admin.auth.getUser(token);
  const user = auth.data?.user;
  if(auth.error || !user) return respond({error:"Session expired"},401);
  const [roles,access] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id",user.id).in("role",["admin","residence_portal"]),
    admin.from("residence_portal_accounts").select("residence_id").eq("user_id",user.id).eq("is_active",true).limit(1)
  ]);
  if(roles.error || access.error) return respond({error:"Unable to verify email account permissions"},503);
  const isAdmin = !!roles.data?.some(row=>row.role==="admin");
  const isLandlord = !!roles.data?.some(row=>row.role==="residence_portal") && !!access.data?.length;
  if(!isAdmin && !isLandlord) return respond({error:"Only approved ResKonnect staff or residence-portal landlords can connect Gmail"},403);
  let body: {action?:string} = {};
  try {body = await req.json();} catch {return respond({error:"Invalid request"},400);}
  const action = body.action || "status";
  if(action==="status"){
    const {data,error}=await admin.from("landlord_gmail_connections")
      .select("gmail_address,connected_at,last_used_at,enabled")
      .eq("user_id",user.id).maybeSingle();
    if(error) return respond({error:"Unable to retrieve connection status"},503);
    return respond({connected:!!data?.enabled,email:data?.enabled?data.gmail_address:null,connected_at:data?.connected_at || null,last_used_at:data?.last_used_at||null});
  }
  if(action==="connect"){
    const clientId=Deno.env.get("GOOGLE_GMAIL_CLIENT_ID");
    const redirect=Deno.env.get("GOOGLE_GMAIL_REDIRECT_URI");
    if(!clientId || !redirect) return respond({error:"Google OAuth configuration missing"},503);
    const rawState=base64url(crypto.getRandomValues(new Uint8Array(32)));
    const verifier=base64url(crypto.getRandomValues(new Uint8Array(64)));
    const digest=base64url(await sha(rawState));
    const challenge=base64url(await sha(verifier));
    const {error}=await admin.from("landlord_gmail_oauth_states").insert({
      user_id:user.id,state_hash:digest,code_verifier:verifier,
      expires_at:new Date(Date.now()+10*60*1000).toISOString()
    });
    if(error) return respond({error:"Unable to begin Gmail authorization"},503);
    const u=new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id",clientId);
    u.searchParams.set("redirect_uri",redirect);
    u.searchParams.set("response_type","code");
    u.searchParams.set("scope","openid email https://www.googleapis.com/auth/gmail.send");
    u.searchParams.set("access_type","offline");
    u.searchParams.set("prompt","consent");
    u.searchParams.set("include_granted_scopes","true");
    u.searchParams.set("code_challenge",challenge);
    u.searchParams.set("code_challenge_method","S256");
    u.searchParams.set("state",rawState);
    return respond({authorization_url:u.toString()});
  }
  if(action==="disconnect"){
    const {data}=await admin.rpc("gmail_get_connection_secret",{p_user_id:user.id});
    if(typeof data==="string" && data){
      try {await fetch("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token:data})});} catch {}
    }
    const {error}=await admin.rpc("gmail_delete_connection",{p_user_id:user.id});
    if(error) return respond({error:"Unable to disconnect Gmail"},503);
    return respond({connected:false});
  }
  return respond({error:"Unknown action"},400);
});
