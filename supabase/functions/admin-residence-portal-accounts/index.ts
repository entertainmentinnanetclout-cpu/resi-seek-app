import {createClient} from "npm:@supabase/supabase-js@2.86.2";

// Administrator-only portal account management. All identity and membership
// changes are scoped to a specific assignment ID, not a residence ID.
const VERSION="v2.0.0-three-member-teams";
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

   let userId:string|null=null,createdByRequest=false;
   // Reuse a verified existing student login without changing its password.
   const {data:profiles,error:profileErr}=await db.from("profiles").select("id,email").ilike("email",email).limit(1);
   if(profileErr)return json({error:"Cannot check for an existing ResKonnect login"},503);
   if(profiles?.length){
    const {data:existingIdentity,error:identityErr}=await db.auth.admin.getUserById(profiles[0].id);
    if(identityErr||!existingIdentity.user||!existingIdentity.user.email_confirmed_at||existingIdentity.user.email?.toLowerCase()!==email)
     return json({error:"This email is already registered but its login identity could not be confirmed. Contact support."},409);
    userId=existingIdentity.user.id;
   }else{
    if(password.length<12)return json({error:"A new portal login requires a password of at least 12 characters"},400);
    const {data:created,error:createErr}=await db.auth.admin.createUser({
     email,password,email_confirm:true
    });
    if(createErr)return json({error:/already registered|already been registered|already exists/i.test(createErr.message)
      ?"This email already has a login. Ask support to link the existing verified account."
      :errorText(createErr,"Could not create the login")},409);
    userId=created.user?.id||null;
    createdByRequest=!!userId;
    if(!userId)return json({error:"Portal login could not be created"},503);
   }
   const {data:already}=await db.from("residence_portal_accounts").select("id").eq("user_id",userId).limit(1);
   if(already?.length){
    if(createdByRequest)await db.auth.admin.deleteUser(userId);
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
    return json({ok:true,account:assignment,created_user:createdByRequest,existing_login:!createdByRequest});
   }catch(e){
    if(createdByRequest)await db.auth.admin.deleteUser(userId);
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
  let originalAuthEmail:string|null=null;
  if(changedEmail){
   const {data:already}=await db.from("residence_portal_accounts").select("id").ilike("email",newEmail).neq("id",id).limit(1);
   if(already?.length)return json({error:"This email is already used by another residence account"},409);
   if(!account.user_id)return json({error:"This legacy assignment needs to be claimed before its login email can change"},409);
   const {data:otherRoles,error:rolesErr}=await db.from("user_roles").select("role")
    .eq("user_id",account.user_id).neq("role","residence_portal");
   if(rolesErr||otherRoles?.length)return json({error:"This login also has another ResKonnect role. Do not change a shared email through the residence editor."},409);
   const {data:userIdentity,error:identityErr}=await db.auth.admin.getUserById(account.user_id);
   if(identityErr||!userIdentity.user)return json({error:"Portal login identity was not found"},409);
   originalAuthEmail=userIdentity.user.email||null;
   const {error:identityChangeErr}=await db.auth.admin.updateUserById(account.user_id,{email:newEmail,email_confirm:true});
   if(identityChangeErr)return json({error:errorText(identityChangeErr,"Could not change the login email")},409);
  }
  const {data:updated,error:updateErr}=await db.from("residence_portal_accounts")
   .update({residence_id:newResidenceId,email:newEmail,is_active:body.is_active,portal_role:newRole})
   .eq("id",id).eq("email",account.email)
   .select("id,residence_id,user_id,email,is_active,portal_role").maybeSingle();
  if(updateErr||!updated){
   if(changedEmail&&account.user_id&&originalAuthEmail)await db.auth.admin.updateUserById(account.user_id,{email:originalAuthEmail,email_confirm:true});
   return json({error:errorText(updateErr,"Could not update this assignment; check role and team limit")},409);
  }
  if(changedEmail&&account.user_id){
   const {error:profileErr}=await db.from("profiles").update({email:newEmail}).eq("id",account.user_id);
   if(profileErr){
    const {error:revertErr}=await db.from("residence_portal_accounts").update({
     residence_id:account.residence_id,email:account.email,is_active:account.is_active,portal_role:account.portal_role
    }).eq("id",id);
    if(!revertErr&&originalAuthEmail)await db.auth.admin.updateUserById(account.user_id,{email:originalAuthEmail,email_confirm:true});
    return json({error:"Profile email sync failed; verify account details before retrying"},503);
   }
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
  return json({ok:true,account:updated,login_email_changed:changedEmail});
 }catch(e){
  console.error("Portal management error",e instanceof Error?e.message:"unknown");
  return json({error:errorText(e,"Portal action failed")},503);
 }
});
