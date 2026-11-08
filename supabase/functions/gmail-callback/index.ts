
import { createClient } from "npm:@supabase/supabase-js@2.86.2";
const html=(title:string,msg:string,status=200)=>new Response(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head><body style="font:16px system-ui,sans-serif;max-width:550px;margin:10vh auto;padding:24px"><h1>${title}</h1><p>${msg}</p><p><a href="https://www.reskonnect.org/residence/communications">Return to ResKonnect</a></p></body></html>`,{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"}});
const b64=(bytes:Uint8Array)=>{let s="";for(const x of bytes)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")};
Deno.serve(async (req:Request)=>{
  if(req.method!=="GET") return html("Invalid request","Google authorization must use a browser redirect.",405);
  const origin=new URL(req.url);
  const error=origin.searchParams.get("error");
  if(error) return html("Gmail connection cancelled","Google did not grant Gmail sending permission.",400);
  const state=origin.searchParams.get("state"), code=origin.searchParams.get("code");
  if(!state || !code || state.length>512 || code.length>4096) return html("Invalid authorization","Missing or invalid Google authorization details.",400);
  const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId=Deno.env.get("GOOGLE_GMAIL_CLIENT_ID"), clientSecret=Deno.env.get("GOOGLE_GMAIL_CLIENT_SECRET"), redirect=Deno.env.get("GOOGLE_GMAIL_REDIRECT_URI");
  if(!url||!key||!clientId||!clientSecret||!redirect) return html("Configuration incomplete","Gmail integration is not configured.",503);
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const digest=b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(state))));
  const {data:rows,error:consumeErr}=await admin.rpc("gmail_consume_oauth_state",{p_state_hash:digest});
  if(consumeErr || !rows?.length) return html("Authorization expired","Please return to ResKonnect and choose Connect Gmail again.",400);
  const {user_id,code_verifier}=rows[0];
  const [permission,roles]=await Promise.all([
    admin.from("residence_portal_accounts").select("residence_id").eq("user_id",user_id).eq("is_active",true).limit(1),
    admin.from("user_roles").select("role").eq("user_id",user_id).in("role",["admin","residence_portal"])
  ]);
  if(permission.error||roles.error) return html("Permission unavailable","Could not validate your ResKonnect role.",503);
  const isAdmin=!!roles.data?.some(row=>row.role==="admin");
  const isLandlord=!!roles.data?.some(row=>row.role==="residence_portal") && !!permission.data?.length;
  if(!isAdmin&&!isLandlord) return html("Permission denied","This ResKonnect account is not authorized to connect Gmail.",403);
  const response=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,code_verifier,grant_type:"authorization_code",redirect_uri:redirect})
  });
  if(!response.ok) return html("Google authorization failed","Please reconnect Gmail from the landlord dashboard.",400);
  const tokens=await response.json();
  if(!tokens.access_token || typeof tokens.refresh_token!=="string") return html("Additional permission required","Google did not return offline access. Disconnect the app in Google Account permissions and try connecting again.",400);
  const granted=new Set(String(tokens.scope||"").split(/\s+/));
  if(!granted.has("https://www.googleapis.com/auth/gmail.send"))return html("Gmail permission missing","Please grant permission to send Gmail messages.",400);
  const userInfo=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${tokens.access_token}`}});
  if(!userInfo.ok) return html("Account verification failed","Could not verify the connected Google account.",400);
  const google=await userInfo.json();
  if(!google.sub || !google.email || google.email_verified!==true) return html("Unverified Google account","Please use a verified Google email address.",400);
  const {error:saveError}=await admin.rpc("gmail_store_connection",{p_user_id:user_id,p_google_subject:google.sub,p_gmail_address:google.email,p_refresh_token:tokens.refresh_token});
  if(saveError){console.error("gmail vault save failed",saveError.message);return html("Unable to save connection","Please try connecting Gmail again.",503);}
  const destination=isAdmin
    ? "https://www.reskonnect.org/admin/communications?tab=email&gmail=connected"
    : "https://www.reskonnect.org/residence/communications?gmail=connected";
  return new Response(null,{status:303,headers:{
    "Location":destination,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"
  }});
});
