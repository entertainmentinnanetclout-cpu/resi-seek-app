import {createClient} from "npm:@supabase/supabase-js@2.86.2";

// Administrator-only portal account management. All identity and membership
// changes are scoped to a specific assignment ID, not a residence ID.
const VERSION="v3.0.0-verified-email-onboarding";
const headers={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"no-store"
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify({...data as Record<string,unknown>,version:VERSION}),{status,headers});
const uuid=(x:unknown):x is string=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const emailValid=(x:unknown):x is string=>typeof x==="string"&&x.length<=254&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(x);
const roles=["owner","manager","admin"] as const;
type PortalRole=(typeof roles)[number];
const isPortalRole=(x:unknown):x is PortalRole=>typeof x==="string"&&roles.includes(x as PortalRole);
const errorText=(err:any,backup:string)=>String(err?.message||backup).slice(0,250);

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const token=(req.headers.get("Authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return json({error:"Sign in as a ResKonnect administrator"},401);
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anon=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!service||!anon)return json({error:"Portal management service is not configured"},503);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const session=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:authErr}=await db.auth.getUser(token);
 if(authErr||!identity.user)return json({error:"Your login session expired; sign in again"},401);
 const actor=identity.user.id;
 const {data:role,error:roleErr}=await db.from("user_roles").select("role").eq("user_id",actor).eq("role","admin").limit(1);
 if(roleErr)return json({error:"Could not verify admin permissions"},503);
 if(!role?.length)return json({error:"Only ResKonnect administrators can manage portal accounts"},403);
 let body:any;
 try{body=await req.json();}catch{return json({error:"Invalid request data"},400);}
 const action=String(body?.action||"");
 const audit=async(actionName:string,account:any,target:string|null,changedEmail:boolean)=>{
  const {error}=await db.from("reskonnect_portal_account_audit").insert({
   admin_user_id:actor,portal_user_id:account?.user_id||null,
   action:actionName,original_residence_id:account?.residence_id||null,
   new_residence_id:target,email_changed:changedEmail
  });
  if(error)console.error("Portal management audit failed",error.code);
 };
 const residenceCount=async(residenceId:string)=>{
  const {count,error}=await db.from("residence_portal_accounts")
   .select("id",{head:true,count:"exact"}).eq("residence_id",residenceId);
  if(error)throw Error("Unable to check residence team capacity");
  return count??0;
 };
 // Email identity is resolved from auth.users, not from profiles alone:
 // imported CRM profiles can exist without any Supabase login.
 const resolveLogin=async(email:string,password:string="")=>{
  const {data:found,error:lookupError}=await db.rpc("portal_lookup_login_email",{p_email:email});
  if(lookupError)throw Error("Could not check Auth identities: "+errorText(lookupError,"Try again"));
  if(found?.auth_user_id){
   if(!found.is_verified&&!found.is_invited)
    throw Error("This account exists but its email is not verified. Ask the mailbox owner to verify their ResKonnect sign-in first.");
   return {userId:String(found.auth_user_id),created:false,invited:!found.is_verified,archivedLegacy:false};
  }
  let archivedId:string|null=null;
  if(found?.orphan_profile_id){
   // Preserve the historic CRM/contact record. No profile or other data is
   // deleted or transferred to a newly created login without verification.
   const {data:archived,error:archiveError}=await db.rpc("portal_prepare_orphan_profile_email",{
    p_email:email,p_admin_id:actor
   });
   if(archiveError)throw Error(errorText(archiveError,"Legacy profile needs manual review"));
   if(archived?.archived)archivedId=String(archived.legacy_profile_id);
  }
  const useInvitation=password.trim().length===0;
  let created;
  try{
    created=useInvitation
      ?await db.auth.admin.inviteUserByEmail(email,{redirectTo:"https://www.reskonnect.org/auth"})
      :await db.auth.admin.createUser({email,password,email_confirm:true});
  }catch(e){
    if(archivedId)await db.rpc("portal_restore_orphan_profile_email",{p_email:email,p_legacy_profile_id:archivedId});
    throw Error(errorText(e,"Unable to contact the authentication service for a new residence login"));
  }
  if(created.error||!created.data.user?.id){
   if(archivedId)await db.rpc("portal_restore_orphan_profile_email",{p_email:email,p_legacy_profile_id:archivedId});
   throw Error(errorText(created.error,"Could not create or invite the landlord login")+
      (useInvitation?" Check your Supabase email invitation configuration.":""));
  }
  return {userId:created.data.user.id,created:true,invited:useInvitation,archivedLegacy:!!archivedId};
 };
 try{
  if(action==="create"){
   const residenceId=body.residence_id;
   const email=String(body.email||"").trim().toLowerCase();
   const newRole=body.portal_role??"manager";
   const password=String(body.password||"");
   if(!uuid(residenceId)||!emailValid(email)||!isPortalRole(newRole))
    return json({error:"Select a residence, an email and an owner, manager or admin role"},400);
   const {data:residence,error:residenceErr}=await db.from("residences").select("id").eq("id",residenceId).maybeSingle();
   if(residenceErr||!residence)return json({error:"Residence not found"},404);
   if(await residenceCount(residenceId)>=3)return json({error:"This residence already has three portal accounts; remove one before adding another"},409);
   const {data:existingEmail,error:usedErr}=await db.from("residence_portal_accounts").select("id").ilike("email",email).limit(1);
   if(usedErr)return json({error:"Cannot verify this login email"},503);
   if(existingEmail?.length)return json({error:"This email is already assigned to a residence portal"},409);
   const {data:existingOwner}=await db.from("residence_portal_accounts").select("id").eq("residence_id",residenceId).eq("portal_role","owner").limit(1);
   if(newRole==="owner"&&existingOwner?.length)return json({error:"This residence already has an owner; select manager or admin"},409);

   if(password && password.length<12)return json({error:"Temporary passwords must contain at least 12 characters, or leave blank to send a secure invitation"},400);
   let identity:{userId:string;created:boolean;invited:boolean;archivedLegacy:boolean};
   try{identity=await resolveLogin(email,password);}
   catch(e){return json({error:errorText(e,"Could not prepare the residence login")},409);}
   const userId=identity.userId;
   const createdByRequest=identity.created;
   const {data:already}=await db.from("residence_portal_accounts").select("id").eq("user_id",userId).limit(1);
   if(already?.length){
    return json({error:"This user already manages another residence; assign a different email"},409);
   }
   let grantedRole=false;
   try{
    const {data:hadRole}=await db.from("user_roles").select("role").eq("user_id",userId).eq("role","residence_portal").limit(1);
    const {error:grantErr}=await db.from("user_roles").upsert({user_id:userId,role:"residence_portal"},
     {onConflict:"user_id,role",ignoreDuplicates:true});
    if(grantErr)throw grantErr;
    grantedRole=!hadRole?.length;
    const {data:assignment,error:insertErr}=await db.from("residence_portal_accounts")
     .insert({residence_id:residenceId,user_id:userId,email,is_active:true,portal_role:newRole})
     .select("id,residence_id,user_id,email,is_active,portal_role").single();
    if(insertErr)throw insertErr;
    await audit("created",{user_id:userId,residence_id:null},residenceId,false);
    return json({ok:true,account:assignment,created_user:createdByRequest,existing_login:!createdByRequest,invitation_sent:identity.invited&&createdByRequest,archived_legacy_contact:identity.archivedLegacy});
   }catch(e){
    // Do not delete an invited identity after an email link was dispatched;
    // retry can later connect it after the owner accepts the invitation.
    if(createdByRequest&&!identity.invited)await db.auth.admin.deleteUser(userId);
    else if(grantedRole)await db.from("user_roles").delete().eq("user_id",userId).eq("role","residence_portal");
    return json({error:errorText(e,"Could not assign portal access")},409);
   }
  }
  const id=body.account_id;
  if(!uuid(id))return json({error:"Select an individual portal account"},400);
  const {data:account,error:findErr}=await db.from("residence_portal_accounts")
   .select("id,residence_id,user_id,email,is_active,portal_role").eq("id",id).maybeSingle();
  if(findErr||!account)return json({error:"Portal account not found; refresh the list"},404);
  if(action==="delete"){
   if(body.confirmed!==true)return json({error:"Confirm removal of this specific portal account"},400);
   const {data,error}=await session.rpc("admin_delete_residence_portal_account",{_account_id:id});
   if(error||!data?.success)return json({error:errorText(error,"Unable to revoke portal access")},409);
   // No surviving portal assignment or AdminOS role: remove the user's OAuth
   // credential from Vault, preserving unrelated student profiles and logins.
   if(account.user_id){
    const {data:remaining}=await db.from("user_roles").select("role")
     .eq("user_id",account.user_id).in("role",["admin","residence_portal"]);
    if(!remaining?.length){
     const {data:oldToken}=await db.rpc("gmail_get_connection_secret",{p_user_id:account.user_id});
     if(typeof oldToken==="string"&&oldToken){
      try{await fetch("https://oauth2.googleapis.com/revoke",{
       method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
       body:new URLSearchParams({token:oldToken}),signal:AbortSignal.timeout(2500)
      });}catch{/* Google's availability cannot block local access revocation. */}
     }
     const {error:cleanupErr}=await db.rpc("gmail_delete_connection",{p_user_id:account.user_id});
     if(cleanupErr)console.error("OAuth credential cleanup failed after portal revoke",cleanupErr.code);
    }
   }
   return json({ok:true,deleted:true,auth_user_preserved:true,account_id:id});
  }
  if(action!=="update")return json({error:"Invalid portal management action"},400);
  const newResidenceId=body.new_residence_id??account.residence_id;
  const newRole=body.portal_role??account.portal_role;
  if(!uuid(newResidenceId)||!isPortalRole(newRole)||typeof body.is_active!=="boolean")
   return json({error:"Provide a residence, role and active state"},400);
  const newEmail=String(body.email??account.email).trim().toLowerCase();
  if(!emailValid(newEmail))return json({error:"Enter a valid login email"},400);
  if(newResidenceId!==account.residence_id){
   const {data:place,error:placeErr}=await db.from("residences").select("id").eq("id",newResidenceId).maybeSingle();
   if(placeErr||!place)return json({error:"Target residence does not exist"},404);
   if(await residenceCount(newResidenceId)>=3)return json({error:"Target residence already has three portal accounts"},409);
  }
  if(newRole==="owner"){
   const {data:owners,error:ownerErr}=await db.from("residence_portal_accounts").select("id")
    .eq("residence_id",newResidenceId).eq("portal_role","owner").neq("id",id).limit(1);
   if(ownerErr)return json({error:"Could not verify residence owner"},503);
   if(owners?.length)return json({error:"This residence already has a portal owner"},409);
  }
  const changedEmail=newEmail!==account.email.toLowerCase();
  if(changedEmail){
   if(newResidenceId!==account.residence_id||newRole!==account.portal_role||body.is_active!==account.is_active)
    return json({error:"Save residence, role or status changes first. Then replace this login email separately."},400);
   const {data:already}=await db.from("residence_portal_accounts")
     .select("id").ilike("email",newEmail).neq("id",id).limit(1);
   if(already?.length)return json({error:"This email already manages another residence. Choose another email."},409);
   let identity:{userId:string;created:boolean;invited:boolean;archivedLegacy:boolean};
   try{identity=await resolveLogin(newEmail);}
   catch(e){return json({error:errorText(e,"Could not prepare the replacement login")},409);}
   const {data:swap,error:swapError}=await db.rpc("portal_replace_residence_login",{
     p_account_id:id,p_new_user_id:identity.userId,p_email:newEmail,p_admin_id:actor
   });
   if(swapError||!swap?.ok)return json({error:errorText(swapError,"Could not replace the login; the previous account is unchanged")},409);
   // The previous account retains its own Auth identity, student roles and
   // original email. Revoke Gmail send only if no independent staff role remains.
   if(account.user_id&&swap.previous_user_id){
    const {data:remaining}=await db.from("user_roles").select("role")
      .eq("user_id",account.user_id).in("role",["admin","residence_portal"]);
    if(!remaining?.length){
      await db.from("landlord_gmail_connections").update({enabled:false}).eq("user_id",account.user_id);
      const {error:cleanupError}=await db.rpc("gmail_delete_connection",{p_user_id:account.user_id});
      if(cleanupError)console.error("Previous portal sender cleanup failed",cleanupError.code);
    }
   }
   return json({ok:true,replaced:true,account_id:id,invitation_sent:identity.created&&identity.invited,
     existing_login:!identity.created,archived_legacy_contact:identity.archivedLegacy});
  }
  const {data:updated,error:updateErr}=await db.from("residence_portal_accounts")
   .update({residence_id:newResidenceId,is_active:body.is_active,portal_role:newRole})
   .eq("id",id).eq("email",account.email)
   .select("id,residence_id,user_id,email,is_active,portal_role").maybeSingle();
  if(updateErr||!updated){
   return json({error:errorText(updateErr,"Could not update the portal account")},409);
  }
  if(account.is_active&&!updated.is_active&&account.user_id){
   // A suspended landlord must not retain an enabled server-side Gmail sender.
   // Do not interrupt a distinct, still-authorized global AdminOS account.
   const {data:globalAdmin}=await db.from("user_roles").select("role")
    .eq("user_id",account.user_id).eq("role","admin").limit(1);
   if(!globalAdmin?.length){
    const {error:suspendErr}=await db.from("landlord_gmail_connections")
     .update({enabled:false}).eq("user_id",account.user_id);
    if(suspendErr)console.error("Gmail sender suspension failed",suspendErr.code);
   }
  }
  const operation=account.is_active&&!updated.is_active?"deactivated":
   !account.is_active&&updated.is_active?"reactivated":
   account.portal_role!==updated.portal_role?"role_changed":"updated";
  await audit(operation,account,newResidenceId,changedEmail);
  return json({ok:true,account:updated,login_email_changed:false});
 }catch(e){
  console.error("Portal management error",e instanceof Error?e.message:"unknown");
  return json({error:errorText(e,"Portal action failed")},503);
 }
});
