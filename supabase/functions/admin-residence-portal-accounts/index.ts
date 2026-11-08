import {createClient} from "npm:@supabase/supabase-js@2.86.2";

const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const uuid=(x:unknown):x is string=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const emailValid=(x:unknown):x is string=>typeof x==="string"&&x.length<=254&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(x);
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const token=req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return json({error:"Sign in as a ResKonnect administrator"},401);
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anon=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!service||!anon)return json({error:"Portal account service is not configured"},503);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const session=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authErr}=await db.auth.getUser(token);
 if(authErr||!auth.user)return json({error:"Login session expired"},401);
 const actor=auth.user.id;
 const {data:role,error:roleErr}=await db.from("user_roles").select("role").eq("user_id",actor).eq("role","admin").maybeSingle();
 if(roleErr||!role)return json({error:"Only administrators can change residence portal accounts"},403);
 let body:any;try{body=await req.json();}catch{return json({error:"Invalid request body"},400);}
 const oldId=body.residence_id;
 if(!uuid(oldId))return json({error:"A valid residence must be selected"},400);
 const {data:account,error:lookupErr}=await db.from("residence_portal_accounts")
  .select("residence_id,user_id,email,is_active").eq("residence_id",oldId).maybeSingle();
 if(lookupErr||!account)return json({error:"Residence portal account not found"},404);
 const audit=async(action:string,newResidenceId:string|null,changedEmail:boolean)=>{
  const {error}=await db.from("reskonnect_portal_account_audit").insert({
   admin_user_id:actor,portal_user_id:account.user_id||null,action,
   original_residence_id:oldId,new_residence_id:newResidenceId,email_changed:changedEmail
  });
  if(error)console.error("Portal audit write failed",error.code);
 };
 if(body.action==="delete"){
  if(body.confirmed!==true)return json({error:"Confirm removal of portal access"},400);
  const {error}=await session.rpc("admin_delete_residence_portal",{_residence_id:oldId});
  if(error)return json({error:"Unable to remove portal permissions: "+error.message},409);
  await audit("removed",null,false);
  return json({ok:true,deleted:true,auth_user_preserved:true,description:"Residence access revoked; this does not delete the person's other ResKonnect roles or student data"});
 }
 if(body.action!=="update")return json({error:"Invalid portal account action"},400);
 const newResidenceId=body.new_residence_id||oldId;
 if(!uuid(newResidenceId)||typeof body.is_active!=="boolean")return json({error:"Select a valid residence and active/inactive state"},400);
 const newEmail=String(body.email||account.email).toLowerCase().trim();
 if(!emailValid(newEmail))return json({error:"Enter a valid email address"},400);
 if(newResidenceId!==oldId){
  const {data:other,error:otherErr}=await db.from("residence_portal_accounts").select("residence_id").eq("residence_id",newResidenceId).maybeSingle();
  const {data:place,error:placeErr}=await db.from("residences").select("id").eq("id",newResidenceId).maybeSingle();
  if(otherErr||placeErr)return json({error:"Could not check new residence assignment"},503);
  if(other)return json({error:"The selected residence already has another portal login"},409);
  if(!place)return json({error:"Target residence does not exist"},404);
 }
 const changedEmail=newEmail!==String(account.email||"").toLowerCase();
 let originalAuthEmail:string|null=null;
 if(changedEmail&&account.user_id){
  const {data:otherRoles,error:rolesErr}=await db.from("user_roles").select("role")
   .eq("user_id",account.user_id).neq("role","residence_portal");
  if(rolesErr||otherRoles?.length)return json({error:"This login has another account role. Do not change a shared student/admin email through the residence portal editor."},409);
  const {data:identity,error:idErr}=await db.auth.admin.getUserById(account.user_id);
  if(idErr||!identity?.user)return json({error:"Linked login identity was not found"},409);
  originalAuthEmail=identity.user.email||null;
  const {error:updateAuthErr}=await db.auth.admin.updateUserById(account.user_id,{email:newEmail,email_confirm:true});
  if(updateAuthErr)return json({error:"Could not change login email: "+updateAuthErr.message},409);
 }
 const patch={residence_id:newResidenceId,email:newEmail,is_active:body.is_active,updated_at:new Date().toISOString()};
 const {data:updated,error:updateErr}=await db.from("residence_portal_accounts")
  .update(patch).eq("residence_id",oldId).eq("email",account.email).select("residence_id,user_id,email,is_active").maybeSingle();
 if(updateErr||!updated){
  if(changedEmail&&account.user_id&&originalAuthEmail)
   await db.auth.admin.updateUserById(account.user_id,{email:originalAuthEmail,email_confirm:true});
  return json({error:"Could not update this portal assignment. Changes to the login email were rolled back."},409);
 }
 if(changedEmail&&account.user_id){
  const {error:profileErr}=await db.from("profiles").update({email:newEmail}).eq("id",account.user_id);
  if(profileErr){
   console.error("Portal login profile email sync error",profileErr.code);
   const reverse=await db.from("residence_portal_accounts").update({
    residence_id:oldId,email:account.email,is_active:account.is_active,updated_at:new Date().toISOString()
   }).eq("residence_id",newResidenceId);
   if(!reverse.error&&originalAuthEmail)await db.auth.admin.updateUserById(account.user_id,{email:originalAuthEmail,email_confirm:true});
   return json({error:"Profile email synchronization failed; the portal edit was rolled back when possible. Verify login details before retrying."},503);
  }
 }
 const operation=!body.is_active&&account.is_active?"deactivated":body.is_active&&!account.is_active?"reactivated":"updated";
 await audit(operation,newResidenceId,changedEmail);
 return json({ok:true,account:updated,login_email_changed:changedEmail});
});
