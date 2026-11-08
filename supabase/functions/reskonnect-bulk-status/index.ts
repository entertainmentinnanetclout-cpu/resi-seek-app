import { createClient } from "npm:@supabase/supabase-js@2.86.2";

type Kind="application"|"reservation";
type StatusRow={id:string;residence_id:string;user_id:string;status:string;room_id?:string|null};
const HEAD={
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store",
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:HEAD});
const uuid=(x:unknown):x is string=>typeof x==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const statusOptions:Record<Kind,string[]>={
  application:["under_review","documents_required","conditionally_approved","approved","rejected"],
  reservation:["contacted","provisional_hold","confirmed","cancelled"]
};
const fromTable:Record<Kind,string>={
  application:"applications", reservation:"accommodation_reservations"
};
const terminal:Record<Kind,Set<string>>={
  application:new Set(["approved","rejected","withdrawn"]),
  reservation:new Set(["confirmed","cancelled"])
};
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const token=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return json({error:"Sign in to ResKonnect"},401);
  const apiUrl=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!apiUrl||!key)return json({error:"Service not configured"},503);
  const db=createClient(apiUrl,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authErr}=await db.auth.getUser(token);
  if(authErr||!auth.user)return json({error:"Session expired"},401);
  const actor=auth.user.id;
  const [roles,portals]=await Promise.all([
    db.from("user_roles").select("role").eq("user_id",actor).in("role",["admin","residence_portal"]),
    db.from("residence_portal_accounts").select("residence_id").eq("user_id",actor).eq("is_active",true)
  ]);
  if(roles.error||portals.error)return json({error:"Could not verify your permissions"},503);
  const isAdmin=!!roles.data?.some(r=>r.role==="admin");
  const isLandlord=!!roles.data?.some(r=>r.role==="residence_portal") && !!portals.data?.length;
  if(!isAdmin&&!isLandlord)return json({error:"Bulk status tools are restricted to authorized staff and landlords"},403);
  const allowedResidences=new Set((portals.data||[]).map(r=>r.residence_id));
  let input:{
    action?:string;kind?:string;target_ids?:string[];new_status?:string;
    expected_statuses?:Record<string,string>;batch_id?:string;reason?:string;
    confirmed?:boolean;confirm_phrase?:string
  };
  try{input=await req.json();}catch{return json({error:"Invalid request"},400)}
  if(input.action==="history"){
    const {data,error}=await db.from("reskonnect_bulk_status_events")
      .select("batch_id,target_kind,target_id,old_status,new_status,result,failure_code,created_at")
      .eq("actor_user_id",actor).order("created_at",{ascending:false}).limit(75);
    if(error)return json({error:"Could not load change history"},503);
    return json({items:data||[]});
  }
  if(input.action!=="preview"&&input.action!=="apply")return json({error:"Unsupported operation"},400);
  const kind=input.kind as Kind;
  if(kind!=="application"&&kind!=="reservation")return json({error:"Choose applications or reservations"},400);
  const ids=input.target_ids;
  if(!Array.isArray(ids)||ids.length<1||ids.length>25||ids.some(x=>!uuid(x))||new Set(ids).size!==ids.length)
    return json({error:"Select between 1 and 25 unique records"},400);
  const next=input.new_status;
  if(typeof next!=="string"||!statusOptions[kind].includes(next))return json({error:"Unsupported destination status"},400);
  if(!isAdmin && (next==="approved"||next==="confirmed"||next==="rejected"||next==="cancelled"))
    return json({error:"Only authorized ResKonnect administrators may bulk finalize or reject records"},403);
  const table=fromTable[kind];
  const {data:records,error:loadErr}=await db.from(table)
    .select(kind==="reservation"?"id,residence_id,user_id,status,room_id":"id,residence_id,user_id,status")
    .in("id",ids);
  if(loadErr)return json({error:"Could not review records"},503);
  const map=new Map((records||[]).map((row:any)=>[row.id,row as StatusRow]));
  const evaluated=ids.map(id=>{
    const row=map.get(id);
    if(!row)return {id,eligible:false,reason:"Record not found or unavailable",current_status:null};
    if(!isAdmin && (!row.residence_id||!allowedResidences.has(row.residence_id)))
      return {id,eligible:false,reason:"Record outside assigned residence",current_status:null};
    if(row.status===next)return {id,eligible:false,reason:"Already at selected status",current_status:row.status};
    if(terminal[kind].has(row.status))return {id,eligible:false,reason:"Finalized or withdrawn records require individual review",current_status:row.status};
    if(kind==="reservation"&&next==="confirmed"&&!row.room_id)
      return {id,eligible:false,reason:"Cannot bulk confirm without assigned room",current_status:row.status};
    return {id,eligible:true,reason:null,current_status:row.status};
  });
  if(input.action==="preview"){
    return json({
      kind,new_status:next,requested:ids.length,eligible:evaluated.filter(x=>x.eligible).length,
      blocked:evaluated.filter(x=>!x.eligible).length,records:evaluated,
      high_impact:["approved","confirmed","rejected","cancelled"].includes(next),
      warnings:kind==="application"?
        ["Application approval triggers readiness checks and existing notifications. Status changes are not emailed automatically."]:
        ["Reservation changes will trigger existing booking notifications and may affect allocation workflows. They do not send Gmail automatically."]
    });
  }
  const reason=String(input.reason||"").trim().replace(/[\r\n]+/g," ").slice(0,500);
  if(reason.length<8)return json({error:"Provide a reason of at least 8 characters"},400);
  if(!uuid(input.batch_id)||input.confirmed!==true||input.confirm_phrase!=="APPLY "+ids.length)
    return json({error:"Reconfirm the exact batch size before applying updates"},400);
  if(!input.expected_statuses||typeof input.expected_statuses!=="object")
    return json({error:"Preview the latest statuses before applying"},400);
  const audit=async(row:StatusRow|null,id:string,result:"processing"|"success"|"skipped"|"failed",failure:string|null)=>{
    const oldStatus=row?.status||null;
    return db.from("reskonnect_bulk_status_events").insert({
      actor_user_id:actor,batch_id:input.batch_id,target_kind:kind,target_id:id,
      residence_id:row?.residence_id||null,old_status:oldStatus,new_status:next,
      reason,result,failure_code:failure
    });
  };
  const results=[];
  for(const check of evaluated){
    const row=map.get(check.id)||null;
    const expected=input.expected_statuses[check.id];
    if(!check.eligible||!row){
      results.push({id:check.id,updated:false,reason:check.reason});
      continue;
    }
    if(expected!==row.status){
      results.push({id:check.id,updated:false,reason:"Status changed since preview"});
      continue;
    }
    const claim=await audit(row,check.id,"processing",null);
    if(claim.error){
      results.push({id:check.id,updated:false,reason:claim.error.code==="23505"?"Batch already processed for this record":"Unable to reserve audit entry"});
      continue;
    }
    try {
      const {data:updated,error:updateErr}=await db.from(table)
        .update({status:next})
        .eq("id",check.id).eq("status",expected)
        .eq("residence_id",row.residence_id)
        .select("id,status").maybeSingle();
      if(updateErr) {
        console.error("Bulk status rule blocked",kind,check.id,updateErr.message);
        await db.from("reskonnect_bulk_status_events").update({result:"failed",failure_code:"database_business_rule",updated_at:new Date().toISOString()})
          .eq("actor_user_id",actor).eq("batch_id",input.batch_id).eq("target_id",check.id);
        results.push({id:check.id,updated:false,reason:"Existing approval or reservation rule blocked this change"});
        continue;
      }
      if(!updated) {
        await db.from("reskonnect_bulk_status_events").update({result:"skipped",failure_code:"changed_since_review",updated_at:new Date().toISOString()})
          .eq("actor_user_id",actor).eq("batch_id",input.batch_id).eq("target_id",check.id);
        results.push({id:check.id,updated:false,reason:"Status changed since preview"});
        continue;
      }
      if(kind==="application") {
        const logResult=await db.from("application_activity_log").insert({
          application_id:check.id,residence_id:row.residence_id,actor_user_id:actor,
          actor_type:isAdmin?"admin":"residence",action_type:"bulk_status_updated",
          metadata:{previous_status:expected,new_status:next,batch_id:input.batch_id,reason}
        });
        if(logResult.error) console.warn("Bulk application activity note unavailable",check.id,logResult.error.message);
      }
      await db.from("reskonnect_bulk_status_events").update({result:"success",updated_at:new Date().toISOString()})
        .eq("actor_user_id",actor).eq("batch_id",input.batch_id).eq("target_id",check.id);
      results.push({id:check.id,updated:true,status:next});
    } catch(error) {
      console.error("Bulk status unexpected error",check.id,error);
      await db.from("reskonnect_bulk_status_events").update({result:"failed",failure_code:"unexpected_error",updated_at:new Date().toISOString()})
        .eq("actor_user_id",actor).eq("batch_id",input.batch_id).eq("target_id",check.id);
      results.push({id:check.id,updated:false,reason:"Unable to complete this status update"});
    }
  }
  return json({batch_id:input.batch_id,kind,new_status:next,total:ids.length,
    updated:results.filter(r=>r.updated).length,skipped:results.filter(r=>!r.updated).length,results,
    note:"Existing database notifications and business-rule triggers execute on successful status changes; Gmail messages are never auto-sent."});
});
