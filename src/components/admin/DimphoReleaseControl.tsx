import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BrainCircuit, CheckCircle2, Database, FlaskConical, GitBranch, Loader2, RefreshCw, Rocket, ShieldCheck, Wrench, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const fmtScore=(value:any)=>value===null||value===undefined?"—":`${Math.round(Number(value)*100)}%`;
const fmtDate=(value:any)=>value?new Date(value).toLocaleString():"—";

export default function DimphoReleaseControl(){
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [tools,setTools]=useState<any[]>([]);
  const [invocations,setInvocations]=useState<any[]>([]);
  const [memoryCount,setMemoryCount]=useState(0);
  const [workflowRuns,setWorkflowRuns]=useState<any[]>([]);
  const [evalRuns,setEvalRuns]=useState<any[]>([]);
  const [models,setModels]=useState<any[]>([]);
  const [routes,setRoutes]=useState<any[]>([]);
  const [fineTunes,setFineTunes]=useState<any[]>([]);
  const [releases,setReleases]=useState<any[]>([]);
  const [datasets,setDatasets]=useState<any[]>([]);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [toolsR,invR,memoryR,workflowR,evalR,modelsR,routesR,ftR,releasesR,datasetsR]=await Promise.all([
        (supabase as any).from("dimpho_tools").select("tool_key,name,category,risk_level,requires_auth,requires_confirmation,enabled,updated_at").order("tool_key"),
        (supabase as any).from("dimpho_tool_invocations").select("id,tool_key,status,risk_level,duration_ms,created_at,error_message").order("created_at",{ascending:false}).limit(30),
        (supabase as any).from("dimpho_customer_memory").select("id",{count:"exact",head:true}).eq("status","active"),
        (supabase as any).from("dimpho_workflow_runs").select("id,workflow_key,status,current_step_key,last_progress_at").in("status",["active","paused","escalated"]).order("last_progress_at",{ascending:false}).limit(20),
        (supabase as any).from("dimpho_eval_runs").select("id,status,score,gate_passed,passed_cases,failed_cases,total_cases,model_key,completed_at,started_at").order("started_at",{ascending:false}).limit(12),
        (supabase as any).from("dimpho_models").select("id,model_key,provider,model_name,display_name,purpose,status,fine_tunable,updated_at").order("purpose"),
        (supabase as any).from("dimpho_model_routes").select("id,route_key,enabled,config,updated_at,dimpho_models!dimpho_model_routes_model_id_fkey(id,model_key,provider,model_name,display_name)").order("route_key"),
        (supabase as any).from("dimpho_fine_tune_jobs").select("id,base_model,status,fine_tuned_model,error_message,submitted_at,completed_at,dataset_release_id,updated_at").order("created_at",{ascending:false}).limit(12),
        (supabase as any).from("dimpho_model_releases").select("id,release_key,route_key,status,traffic_percent,promoted_at,rolled_back_at,model_id,previous_release_id,dimpho_models!dimpho_model_releases_model_id_fkey(display_name,model_name)").order("created_at",{ascending:false}).limit(20),
        (supabase as any).from("dimpho_dataset_releases").select("id,version,name,status,example_count,checksum,metadata,frozen_at,created_at").order("version",{ascending:false}).limit(12),
      ]);
      const errors=[toolsR,invR,memoryR,workflowR,evalR,modelsR,routesR,ftR,releasesR,datasetsR].map((x:any)=>x.error).filter(Boolean);
      if(errors.length)throw errors[0];
      setTools(toolsR.data||[]);setInvocations(invR.data||[]);setMemoryCount(memoryR.count||0);setWorkflowRuns(workflowR.data||[]);setEvalRuns(evalR.data||[]);setModels(modelsR.data||[]);setRoutes(routesR.data||[]);setFineTunes(ftR.data||[]);setReleases(releasesR.data||[]);setDatasets(datasetsR.data||[]);
    }catch(error:any){console.error("[DimphoReleaseControl] load failed",error);toast.error(error?.message||"Could not load Dimpho release operations");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);

  const invoke=async(fn:string,body:any)=>{
    const {data,error}=await (supabase.functions as any).invoke(fn,{body});
    if(error)throw error;
    if(!data?.ok)throw new Error(data?.error||`${fn} failed`);
    return data;
  };

  const runEval=async()=>{
    setBusy("eval");
    try{const data=await invoke("dimpho-eval-worker",{action:"run_suite",suite_key:"production_gate"});toast[data.gate_passed?"success":"error"](`Evaluation ${data.gate_passed?"passed":"failed"}: ${fmtScore(data.score)} (${data.passed}/${data.total})`);await load();}
    catch(error:any){toast.error(error?.message||"Evaluation failed");}
    finally{setBusy(null);}
  };

  const freezeDataset=async()=>{
    setBusy("dataset");
    try{const data=await invoke("dimpho-model-ops",{action:"freeze_dataset",min_quality:.8});toast.success(`Dataset v${data.dataset?.version||"?"} frozen with ${data.dataset?.example_count||0} examples`);await load();}
    catch(error:any){toast.error(error?.message||"Dataset freeze failed");}
    finally{setBusy(null);}
  };

  const syncFineTunes=async()=>{
    setBusy("sync-ft");
    try{const data=await invoke("dimpho-model-ops",{action:"sync_finetune"});toast.success(`Synced ${data.jobs?.length||0} fine-tune job(s)`);await load();}
    catch(error:any){toast.error(error?.message||"Fine-tune sync failed");}
    finally{setBusy(null);}
  };

  const submitFineTune=async()=>{
    const dataset=datasets.find((d)=>d.status==="frozen"&&d.metadata?.artifact_path);
    if(!dataset)return toast.error("Freeze a training dataset first");
    if(!window.confirm(`This submits Dimpho-RK dataset v${dataset.version} to the configured fine-tuning provider and may incur API charges. Continue?`))return;
    const typed=window.prompt('Type AUTHORIZE_FINE_TUNE_COST to confirm the provider charge.');
    if(typed!=="AUTHORIZE_FINE_TUNE_COST")return toast.error("Fine-tune submission cancelled");
    setBusy("submit-ft");
    try{const data=await invoke("dimpho-model-ops",{action:"submit_finetune",dataset_release_id:dataset.id,confirm_cost:true,cost_confirmation:typed});toast.success(`Fine-tune job submitted: ${data.job?.provider_job_id||data.job?.id}`);await load();}
    catch(error:any){toast.error(error?.message||"Fine-tune submission failed");}
    finally{setBusy(null);}
  };

  const promote=async(model:any)=>{
    if(!window.confirm(`Promote ${model.display_name||model.model_name} to the routine production route? The latest evaluation gate must be green.`))return;
    setBusy(`promote:${model.id}`);
    try{await invoke("dimpho-model-ops",{action:"promote_model",model_id:model.id,route_key:"routine"});toast.success("Model promoted to the routine production route");await load();}
    catch(error:any){toast.error(error?.message||"Model promotion blocked");}
    finally{setBusy(null);}
  };

  const rollback=async(release:any)=>{
    if(!window.confirm(`Roll back ${release.release_key} to its previous production release?`))return;
    setBusy(`rollback:${release.id}`);
    try{await invoke("dimpho-model-ops",{action:"rollback_model",release_id:release.id,reason:"AdminOS manual rollback"});toast.success("Model route rolled back");await load();}
    catch(error:any){toast.error(error?.message||"Rollback failed");}
    finally{setBusy(null);}
  };

  const latestEval=evalRuns[0]||null;
  const candidates=useMemo(()=>models.filter((m)=>m.status==="candidate"||m.purpose==="fine_tuned"),[models]);
  const prodRelease=releases.find((r)=>r.status==="production")||null;

  if(loading&&!tools.length)return <div className="grid min-h-40 place-items-center text-sm text-muted-foreground"><div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Loading R5–R8 controls…</div></div>;

  return <div className="min-w-0 space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric icon={Wrench} label="Tools" value={`${tools.filter((x)=>x.enabled).length}/${tools.length}`} sub="R5 governed registry"/>
      <Metric icon={Database} label="Safe memories" value={String(memoryCount)} sub="R6 allowlisted context"/>
      <Metric icon={GitBranch} label="Active workflows" value={String(workflowRuns.filter((x)=>x.status==="active").length)} sub="resumable customer journeys"/>
      <Metric icon={FlaskConical} label="Eval gate" value={latestEval?fmtScore(latestEval.score):"Not run"} sub={latestEval?.gate_passed?"R7 green":"R7 verification required"}/>
      <Metric icon={BrainCircuit} label="Model routes" value={String(routes.filter((x)=>x.enabled).length)} sub="R8 provider-aware routing"/>
    </div>

    <Card className="rounded-[24px]"><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-lg">Release validation & model operations</CardTitle><CardDescription>Run the production regression gate, freeze governed Dimpho-RK datasets and operate fine-tune/model releases without exposing provider secrets.</CardDescription></div><Button variant="outline" size="sm" onClick={()=>void load()} disabled={Boolean(busy)}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div></CardHeader><CardContent className="flex flex-wrap gap-2">
      <Button onClick={runEval} disabled={Boolean(busy)}>{busy==="eval"?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<FlaskConical className="mr-2 h-4 w-4"/>}Run production gate</Button>
      <Button variant="outline" onClick={freezeDataset} disabled={Boolean(busy)}>{busy==="dataset"?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Database className="mr-2 h-4 w-4"/>}Freeze Dimpho-RK dataset</Button>
      <Button variant="outline" onClick={syncFineTunes} disabled={Boolean(busy)}>{busy==="sync-ft"?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Activity className="mr-2 h-4 w-4"/>}Sync fine-tunes</Button>
      <Button variant="destructive" onClick={submitFineTune} disabled={Boolean(busy)}>{busy==="submit-ft"?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Rocket className="mr-2 h-4 w-4"/>}Submit fine-tune (charged)</Button>
    </CardContent></Card>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-[24px]"><CardHeader><CardTitle className="text-base">R5 Tool Engine</CardTitle><CardDescription>Only registered tools can touch production data. Every invocation is permissioned and audited.</CardDescription></CardHeader><CardContent className="space-y-2">{tools.map((tool)=><div key={tool.tool_key} className="flex min-w-0 items-center gap-3 rounded-2xl border p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{tool.name}</p><p className="truncate text-xs text-muted-foreground">{tool.tool_key} · {tool.category}</p></div><Badge variant={tool.risk_level==="green"?"secondary":"outline"}>{tool.risk_level}</Badge>{tool.requires_confirmation&&<Badge variant="outline">confirm</Badge>}</div>)}</CardContent></Card>

      <Card className="rounded-[24px]"><CardHeader><CardTitle className="text-base">R7 Evaluation Lab</CardTitle><CardDescription>Model/release promotion is blocked unless the latest production gate passes.</CardDescription></CardHeader><CardContent className="space-y-2">{evalRuns.length?evalRuns.map((run)=><div key={run.id} className="flex items-center gap-3 rounded-2xl border p-3"><div className={`grid h-9 w-9 place-items-center rounded-xl ${run.gate_passed?"bg-emerald-500/10":"bg-destructive/10"}`}>{run.gate_passed?<CheckCircle2 className="h-4 w-4 text-emerald-600"/>:<XCircle className="h-4 w-4 text-destructive"/>}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{fmtScore(run.score)} · {run.passed_cases}/{run.total_cases} passed</p><p className="truncate text-xs text-muted-foreground">{run.model_key||"live-router"} · {fmtDate(run.completed_at||run.started_at)}</p></div><Badge variant={run.gate_passed?"secondary":"destructive"}>{run.status}</Badge></div>):<p className="text-sm text-muted-foreground">No evaluation run yet. Run the production gate before promoting a model.</p>}</CardContent></Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-[24px]"><CardHeader><CardTitle className="text-base">R8 Model Router</CardTitle><CardDescription>Routine, complex and training routes remain provider-aware and independently replaceable.</CardDescription></CardHeader><CardContent className="space-y-2">{routes.map((route)=>{const m=Array.isArray(route.dimpho_models)?route.dimpho_models[0]:route.dimpho_models;return <div key={route.id} className="rounded-2xl border p-3"><div className="flex items-center gap-2"><Badge>{route.route_key}</Badge><p className="min-w-0 flex-1 truncate text-sm font-bold">{m?.display_name||m?.model_name||"Unassigned"}</p><Badge variant={route.enabled?"secondary":"outline"}>{route.enabled?"active":"off"}</Badge></div><p className="mt-2 truncate text-xs text-muted-foreground">{m?.provider} · {m?.model_name}</p></div>;})}</CardContent></Card>

      <Card className="rounded-[24px]"><CardHeader><CardTitle className="text-base">Dimpho-RK candidates & release controls</CardTitle><CardDescription>Fine-tuned candidates cannot become production models until the R7 gate is green.</CardDescription></CardHeader><CardContent className="space-y-3">{candidates.length?candidates.map((model)=><div key={model.id} className="flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{model.display_name||model.model_name}</p><p className="truncate text-xs text-muted-foreground">{model.provider} · {model.model_name}</p></div><Button size="sm" onClick={()=>promote(model)} disabled={Boolean(busy)||!latestEval?.gate_passed}><ShieldCheck className="mr-2 h-4 w-4"/>Promote</Button></div>):<p className="text-sm text-muted-foreground">No Dimpho-RK candidate model has completed fine-tuning yet.</p>}
      {prodRelease&&<div className="mt-3 flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">Production: {prodRelease.release_key}</p><p className="text-xs text-muted-foreground">{prodRelease.route_key} · {prodRelease.traffic_percent}% traffic</p></div><Button size="sm" variant="outline" onClick={()=>rollback(prodRelease)} disabled={Boolean(busy)||!prodRelease.previous_release_id}>Rollback</Button></div>}</CardContent></Card>
    </div>

    <Card className="rounded-[24px]"><CardHeader><CardTitle className="text-base">Recent execution audit</CardTitle><CardDescription>Latest tool calls, model jobs and workflow progress from the intelligence runtime.</CardDescription></CardHeader><CardContent className="grid gap-3 lg:grid-cols-3"><AuditList title="Tool invocations" rows={invocations.map((x)=>({title:x.tool_key,sub:`${x.status} · ${x.duration_ms??"—"}ms`,time:x.created_at,bad:x.status==="failed"||x.status==="denied"}))}/><AuditList title="Workflow runs" rows={workflowRuns.map((x)=>({title:x.workflow_key,sub:`${x.status} · ${x.current_step_key||"no step"}`,time:x.last_progress_at,bad:x.status==="escalated"}))}/><AuditList title="Fine-tune jobs" rows={fineTunes.map((x)=>({title:x.fine_tuned_model||x.base_model,sub:x.status,time:x.completed_at||x.submitted_at||x.updated_at,bad:x.status==="failed"}))}/></CardContent></Card>
  </div>;
}

function Metric({icon:Icon,label,value,sub}:{icon:any;label:string;value:string;sub:string}){return <div className="min-w-0 rounded-[22px] border bg-background p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="h-4 w-4"/>{label}</div><p className="mt-2 truncate text-2xl font-black">{value}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{sub}</p></div>;}
function AuditList({title,rows}:{title:string;rows:{title:string;sub:string;time:any;bad?:boolean}[]}){return <div className="min-w-0 rounded-2xl border p-3"><p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">{title}</p><div className="space-y-2">{rows.slice(0,8).map((row,i)=><div key={`${row.title}-${i}`} className="min-w-0 rounded-xl bg-muted/40 px-3 py-2"><div className="flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${row.bad?"bg-destructive":"bg-emerald-500"}`}/><p className="truncate text-xs font-bold">{row.title}</p></div><p className="mt-1 truncate text-[10px] text-muted-foreground">{row.sub} · {fmtDate(row.time)}</p></div>)}{!rows.length&&<p className="text-xs text-muted-foreground">No records yet.</p>}</div></div>;}
