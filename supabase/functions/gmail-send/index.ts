
import {createClient} from "npm:@supabase/supabase-js@2.86.2";
const HEAD={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const res=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:HEAD});
const b64=(value:string)=>{const data=new TextEncoder().encode(value);let str="";for(const byte of data)str+=String.fromCharCode(byte);return btoa(str).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")};
const safe=(s:unknown)=>String(s??"").replace(/[<>\r\n]/g," ").trim().slice(0,200);
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
 if(req.method!=="POST")return res({error:"Method not allowed"},405);
 const token=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return res({error:"Not authenticated"},401);
 const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const clientId=Deno.env.get("GOOGLE_GMAIL_CLIENT_ID"),clientSecret=Deno.env.get("GOOGLE_GMAIL_CLIENT_SECRET");
 if(!url||!key||!clientId||!clientSecret)return res({error:"Gmail integration is unavailable"},503);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await admin.auth.getUser(token);
 if(authError||!auth.user)return res({error:"Session expired"},401);
 const user=auth.user;
 let request:{reservation_id?:string};try{request=await req.json()}catch{return res({error:"Invalid JSON"},400)}
 if(!request.reservation_id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.reservation_id))return res({error:"Invalid reservation ID"},400);
 const {data:role}=await admin.from("user_roles").select("role").eq("user_id",user.id).eq("role","residence_portal").limit(1);
 if(!role?.length)return res({error:"Not a landlord"},403);
 const {data:booking,error:bookingError}=await admin.from("accommodation_reservations").select("id,user_id,residence_id,status,academic_year,room_preference").eq("id",request.reservation_id).maybeSingle();
 if(bookingError||!booking)return res({error:"Reservation not found"},404);
 const {data:access}=await admin.from("residence_portal_accounts").select("residence_id").eq("user_id",user.id).eq("residence_id",booking.residence_id).eq("is_active",true).limit(1);
 if(!access?.length)return res({error:"You do not manage this residence"},403);
 const {data:connection}=await admin.from("landlord_gmail_connections").select("gmail_address,enabled").eq("user_id",user.id).maybeSingle();
 if(!connection?.enabled)return res({error:"Connect Gmail before sending"},409);
 const {data:residence}=await admin.from("residences").select("name").eq("id",booking.residence_id).maybeSingle();
 const {data:student}=await admin.from("profiles").select("email,full_name").eq("id",booking.user_id).maybeSingle();
 const address=student?.email?.trim();
 if(!address||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address))return res({error:"Student email is missing or invalid"},422);
 const {error:claimError}=await admin.from("landlord_gmail_email_logs").insert({
   user_id:user.id,reservation_id:booking.id,recipient_address:address,status:"sending"
 });
 if(claimError) {
   if(claimError.code==="23505")return res({error:"This landlord has already initiated a confirmation for this reservation. Check email history to prevent duplicate sends."},409);
   return res({error:"Could not prepare email log"},503);
 }
 const failure=async(code:string,indeterminate=false)=>{
   await admin.from("landlord_gmail_email_logs").update({status:indeterminate?"unknown":"failed",failure_code:code}).eq("user_id",user.id).eq("reservation_id",booking.id);
 };
 const {data:refresh,error:refreshError}=await admin.rpc("gmail_get_connection_secret",{p_user_id:user.id});
 if(refreshError||typeof refresh!=="string"||!refresh){await failure("token_unavailable");return res({error:"Reconnect Gmail to continue"},409)}
 const tokenReply=await fetch("https://oauth2.googleapis.com/token",{
   method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refresh,grant_type:"refresh_token"})
 }).catch(()=>null);
 if(!tokenReply){await failure("google_token_network");return res({error:"Google authentication service could not be reached"},502)}
 if(!tokenReply.ok){await failure("google_token_rejected");return res({error:"Gmail authorization expired or was revoked. Reconnect Gmail."},409)}
 const accessToken=(await tokenReply.json()).access_token;
 if(!accessToken){await failure("google_token_missing");return res({error:"Google token response invalid"},502)}
 const studentName=safe(student?.full_name)||"Student",propertyName=safe(residence?.name)||"your accommodation";
 const subject=`ResKonnect reservation update - ${propertyName}`;
 const body=`Hello ${studentName},\n\nYour accommodation reservation request for ${propertyName} has been reviewed.\n\nCurrent reservation status: ${safe(booking.status)}\nAcademic year: ${booking.academic_year??"Not specified"}\n\nPlease sign in to ResKonnect to view the latest reservation information and any required next steps.\n\nRegards,\n${propertyName}\nSent using ResKonnect`;
 const encodedSubject="=?UTF-8?B?"+btoa(String.fromCharCode(...new TextEncoder().encode(subject)))+"?=";
 const mime=`To: ${address}\r\nSubject: ${encodedSubject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n`+btoa(String.fromCharCode(...new TextEncoder().encode(body)))+"\r\n";
 let reply:Response;
 try{reply=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{
   method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},
   body:JSON.stringify({raw:b64(mime)})
 })}catch{await failure("gmail_send_network_unknown",true);return res({error:"Delivery outcome unknown. Check the Gmail Sent folder before retrying."},502)}
 if(!reply.ok){const status=reply.status;await failure("gmail_http_"+status);return res({error:status===401||status===403?"Gmail denied sending. Check permissions or reconnect Gmail.":"Gmail could not send the email.",gmail_status:status},502)}
 const result=await reply.json();
 await admin.from("landlord_gmail_email_logs").update({status:"sent",gmail_message_id:result.id||null,sent_at:new Date().toISOString(),failure_code:null})
 .eq("user_id",user.id).eq("reservation_id",booking.id);
 await admin.from("landlord_gmail_connections").update({last_used_at:new Date().toISOString()}).eq("user_id",user.id);
 return res({sent:true,reservation_id:booking.id,message_id:result.id||null});
});
