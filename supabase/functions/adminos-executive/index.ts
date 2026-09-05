import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-adminos-cron-token","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const getEnv=(n:string)=>Deno.env.get(n)||"";
const supabaseUrl=getEnv("SUPABASE_URL")||getEnv("EXTERNAL_SUPABASE_URL");
const serviceKey=getEnv("SUPABASE_SERVICE_ROLE_KEY")||getEnv("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey=getEnv("SUPABASE_ANON_KEY")||getEnv("EXTERNAL_SUPABASE_ANON_KEY");
const safeCompare=(a:string,b:string)=>{if(!a||!b||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
const countBy=(rows:any[],key:string)=>rows.reduce((out:any,row:any)=>{const k=String(row?.[key]??"unknown");out[k]=(out[k]||0)+1;return out;},{});

async function authorize(req:Request,service:any){
  const cron=req.headers.get("x-adminos-cron-token")||"";
  if(cron){const row=await service.from("adminos_scheduler_secrets").select("secret_value").eq("secret_key","executive_agent").maybeSingle();if(safeCompare(cron,row.data?.secret_value||""))return {ok:true,actor:"scheduler",userId:null,role:"scheduler"};}
  const authHeader=req.headers.get("Authorization")||"";if(!authHeader||!anonKey)return {ok:false,actor:null,userId:null,role:null};
  const auth=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}}});const {data}=await auth.auth.getUser();const user=data?.user;if(!user)return {ok:false,actor:null,userId:null,role:null};
  const role=await service.rpc("get_user_staff_role",{_user_id:user.id});return {ok:Boolean(role.data),actor:role.data?"staff":null,userId:role.data?user.id:null,role:role.data||null};
}

async function buildSnapshot(service:any){
  await service.rpc("adminos_refresh_executive_alerts");
  const now=new Date().toISOString();const dayAgo=new Date(Date.now()-86400000).toISOString();const weekAgo=new Date(Date.now()-7*86400000).toISOString();
  const [apps,prospects,approvals,wa,enquiries,email,followups,docs,calls,integrations,errors,alerts]=await Promise.all([
    service.from("applications").select("status,created_at,updated_at"),
    service.from("adminos_sales_pipeline_v").select("id,full_name,email,phone,campus,pipeline,stage,score,priority,temperature,response_state,automation_state,next_action,next_action_at,last_contacted_at,last_response_at,do_not_contact").order("score",{ascending:false}).limit(1000),
    service.from("adminos_approval_requests").select("id,title,risk_level,status,created_at").eq("status","pending").order("created_at",{ascending:true}).limit(100),
    service.from("adminos_whatsapp_threads").select("id,status,last_message_at").eq("status","escalated").limit(100),
    service.from("adminos_enquiry_threads").select("id,subject,status,priority,last_message_at").in("status",["open","escalated"]).limit(100),
    service.from("adminos_email_threads").select("id,subject,status,last_message_at").eq("status","escalated").limit(100),
    service.from("adminos_followup_enrollments").select("id,status,next_run_at,prospect_id,contact_id").eq("status","active").limit(500),
    service.from("adminos_company_documents").select("id,title,status,risk_level,updated_at").eq("status","awaiting_approval").limit(100),
    service.from("adminos_call_queue").select("id,status,priority,purpose,mode,scheduled_for,next_attempt_at,recommended_reason,contact_id,prospect_id").in("status",["queued","scheduled","calling"]).limit(200),
    service.from("adminos_integration_connections").select("provider,display_name,status,enabled,setup_step,last_success_at,last_error").order("provider"),
    service.from("adminos_agent_errors").select("id,error_code,error_message,retryable,created_at").eq("resolved",false).gte("created_at",dayAgo).limit(100),
    service.from("adminos_executive_alerts").select("id,alert_key,severity,title,description,status,current_count,updated_at").neq("status","resolved").limit(100)
  ]);
  const appRows=apps.data||[];const pRows=prospects.data||[];const followRows=followups.data||[];const callRows=calls.data||[];const iRows=integrations.data||[];
  const eligible=pRows.filter((p:any)=>!p.do_not_contact&&!['converted','onboarded','lost','not_interested','invalid','do_not_contact'].includes(p.stage));
  const top=eligible.slice(0,20);const hotOverdue=eligible.filter((p:any)=>Number(p.score)>=80&&p.next_action_at&&p.next_action_at<now);
  const stale=eligible.filter((p:any)=>p.last_contacted_at&&p.last_contacted_at<weekAgo&&(!p.last_response_at||p.last_response_at<weekAgo)).slice(0,50);
  const pretoria=eligible.filter((p:any)=>/pretoria\s*west|main campus/i.test(String(p.campus||''))).slice(0,30);
  return {
    generated_at:now,
    applications:{total:appRows.length,by_status:countBy(appRows,'status'),new_last_24h:appRows.filter((a:any)=>a.created_at>=dayAgo).length},
    sales:{total:pRows.length,by_stage:countBy(pRows,'stage'),hot:pRows.filter((p:any)=>Number(p.score)>=80).length,warm:pRows.filter((p:any)=>p.temperature==='warm').length,high_priority:pRows.filter((p:any)=>['high','urgent'].includes(p.priority)).length,overdue_hot:hotOverdue.length,top_prospects:top,stale_no_reply:stale,pretoria_west_top:pretoria},
    attention:{pending_approvals:(approvals.data||[]).length,whatsapp_escalated:(wa.data||[]).length,enquiries_open:(enquiries.data||[]).length,email_escalated:(email.data||[]).length,documents_awaiting_approval:(docs.data||[]).length,unresolved_agent_errors_24h:(errors.data||[]).length,open_executive_alerts:(alerts.data||[]).length},
    automation:{active_followups:followRows.length,due_followups:followRows.filter((x:any)=>x.next_run_at&&x.next_run_at<=now).length},
    calls:{active_queue:callRows.length,manual_queue:callRows.filter((x:any)=>x.mode==='manual').length,ai_voice_queue:callRows.filter((x:any)=>x.mode==='ai_voice').length,overdue:callRows.filter((x:any)=>(x.next_attempt_at||x.scheduled_for)<now).length},
    integrations:{total:iRows.length,needs_action:iRows.filter((x:any)=>['needs_action','error','disconnected','not_connected'].includes(x.status)).length,items:iRows},
    alerts:alerts.data||[],pending_approvals:approvals.data||[],call_queue:callRows.slice(0,30)
  };
}

function makeBrief(s:any){
  const a=s.attention;const total=a.pending_approvals+a.whatsapp_escalated+a.email_escalated+a.documents_awaiting_approval+a.unresolved_agent_errors_24h+s.sales.overdue_hot;
  const headline=total?`${total} executive exception${total===1?'':'s'} need attention`:'No critical executive exceptions detected';
  const summary=`${s.applications.total} applications, ${s.sales.total} prospects, ${s.sales.hot} hot prospects, ${s.automation.active_followups} active follow-ups, ${s.calls.active_queue} queued calls, and ${s.integrations.needs_action} integration setup/reconnection item(s).`;
  const recommendations:string[]=[];
  if(s.sales.overdue_hot)recommendations.push(`Review ${s.sales.overdue_hot} overdue hot prospect(s).`);
  if(a.pending_approvals)recommendations.push(`Decide ${a.pending_approvals} pending approval request(s).`);
  if(a.whatsapp_escalated+a.email_escalated)recommendations.push(`Take over ${a.whatsapp_escalated+a.email_escalated} escalated external conversation(s).`);
  if(a.documents_awaiting_approval)recommendations.push(`Review ${a.documents_awaiting_approval} company document(s) awaiting approval.`);
  if(s.integrations.needs_action)recommendations.push(`Finish or reconnect ${s.integrations.needs_action} integration(s) to unlock full-channel automation.`);
  if(!recommendations.length)recommendations.push('Continue exception-based management; current AdminOS data shows no urgent founder intervention.');
  return {headline,summary,recommendations};
}

function answerCommand(command:string,s:any){
  const q=command.toLowerCase();
  if(/what.*needs me|attention|urgent|today/.test(q))return {intent:'attention',answer:s.alerts.length?`${s.alerts.length} executive alert(s) are open: ${s.alerts.slice(0,5).map((x:any)=>`${x.title} (${x.current_count})`).join('; ')}.`:'No open executive alerts currently require intervention.',data:s.alerts};
  if(/strongest|top|best.*prospect|hot prospect/.test(q))return {intent:'top_prospects',answer:`Top eligible prospects are ranked by deterministic AdminOS score. ${s.sales.top_prospects.slice(0,5).map((p:any)=>`${p.full_name||p.email||p.phone||'Contact'}: ${p.score}`).join('; ')||'No eligible prospects found.'}`,data:s.sales.top_prospects};
  if(/pretoria.*west/.test(q))return {intent:'pretoria_west_prospects',answer:`${s.sales.pretoria_west_top.length} eligible Pretoria West prospect(s) are in the current executive result set.`,data:s.sales.pretoria_west_top};
  if(/hasn.?t replied|no reply|not replied|stale/.test(q))return {intent:'stale_no_reply',answer:`${s.sales.stale_no_reply.length} eligible prospect(s) in the current reviewed set have stale response activity.`,data:s.sales.stale_no_reply};
  if(/incomplete.*application|application.*incomplete|missing document/.test(q)){const x=s.applications.by_status||{};const n=(x.documents_required||0)+(x.submitted||0)+(x.under_review||0);return {intent:'incomplete_applications',answer:`${n} application(s) are submitted, under review, or documents-required.`,data:{total:n,by_status:x}};}
  if(/integration|provider|connect/.test(q))return {intent:'integrations',answer:`${s.integrations.needs_action} integration(s) need setup or reconnection.`,data:s.integrations.items};
  if(/call|phone/.test(q))return {intent:'calls',answer:`${s.calls.active_queue} call(s) are active in the queue: ${s.calls.manual_queue} manual and ${s.calls.ai_voice_queue} AI-voice-mode.`,data:s.call_queue};
  if(/application/.test(q))return {intent:'applications',answer:`There are ${s.applications.total} applications. Status breakdown: ${Object.entries(s.applications.by_status).map(([k,v])=>`${k}: ${v}`).join(', ')}.`,data:s.applications};
  const b=makeBrief(s);return {intent:'executive_summary',answer:`${b.headline}. ${b.summary} ${b.recommendations.join(' ')}`,data:{recommendations:b.recommendations}};
}

serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(!supabaseUrl||!serviceKey)return json({error:'Supabase runtime is not configured'},500);
  const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});const authz=await authorize(req,service);if(!authz.ok)return json({error:'Unauthorized'},401);
  const body=await req.json().catch(()=>({}));const action=String(body.action||'health');
  if(action==='health'){const s=await buildSnapshot(service);return json({ok:true,release:4,phase:11,read_only:true,actor:authz.actor,open_alerts:s.alerts.length});}
  if(action==='snapshot'){if(!authz.userId)return json({error:'Staff authentication required'},403);return json({ok:true,snapshot:await buildSnapshot(service),release:4,phase:11});}
  if(action==='brief'){
    const s=await buildSnapshot(service);const b=makeBrief(s);const start=new Date(Date.now()-86400000).toISOString();const end=new Date().toISOString();
    const result=await service.from('adminos_executive_briefs').insert({brief_date:end.slice(0,10),period_start:start,period_end:end,headline:b.headline,summary:b.summary,metrics:s,attention:s.alerts,recommendations:b.recommendations,generated_by_type:authz.actor==='scheduler'?'scheduler':'staff',generated_by_id:authz.userId,provider:'deterministic',model:'adminos-release4-rules',metadata:{release:4,phase:11,data_grounded:true,read_only:true}}).select('*').single();
    if(result.error)return json({error:result.error.message},400);await service.from('adminos_audit_events').insert({actor_type:authz.actor||'system',actor_id:authz.userId,action:'executive.brief_generated',entity_type:'adminos_executive_brief',entity_id:result.data.id,after_state:{headline:b.headline},metadata:{release:4,phase:11}});return json({ok:true,brief:result.data,release:4,phase:11});
  }
  if(action==='ask'){
    if(!authz.userId)return json({error:'Staff authentication required'},403);const command=String(body.command||'').trim().slice(0,4000);if(!command)return json({error:'command is required'},400);const started=Date.now();const s=await buildSnapshot(service);const answer=answerCommand(command,s);
    const stored=await service.from('adminos_executive_commands').insert({user_id:authz.userId,command,normalized_intent:answer.intent,status:'completed',result:{answer:answer.answer,data:answer.data},provider:'deterministic',model:'adminos-release4-rules',latency_ms:Date.now()-started}).select('id').single();
    return json({ok:true,command_id:stored.data?.id||null,intent:answer.intent,answer:answer.answer,data:answer.data,read_only:true,release:4,phase:11});
  }
  if(action==='ack_alert'){
    if(!authz.userId)return json({error:'Staff authentication required'},403);const id=String(body.alert_id||'');if(!id)return json({error:'alert_id is required'},400);const result=await service.from('adminos_executive_alerts').update({status:'acknowledged',acknowledged_by:authz.userId,acknowledged_at:new Date().toISOString()}).eq('id',id).select('*').single();if(result.error)return json({error:result.error.message},400);return json({ok:true,alert:result.data});
  }
  return json({error:'Unsupported action'},400);
});