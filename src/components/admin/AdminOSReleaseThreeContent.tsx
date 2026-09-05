import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, FileText, MessageCircle, Play, RefreshCw, Send, ShieldCheck, TimerReset, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminOSReleaseThreeContent() {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [progress, setProgress] = useState<any>({});
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [waThreads, setWaThreads] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [sequenceKey, setSequenceKey] = useState("");
  const [contactId, setContactId] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [mergeData, setMergeData] = useState<Record<string,string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [p,i,w,s,e,a,t,d,c] = await Promise.all([
      (supabase as any).from("platform_settings").select("value").eq("key","adminos_release_progress").maybeSingle(),
      (supabase as any).from("adminos_integration_connections").select("*").in("provider",["twilio_whatsapp","gmail","openai","lovable_ai_gateway"]).order("display_name"),
      (supabase as any).from("adminos_whatsapp_threads").select("*").order("last_message_at",{ascending:false}).limit(25),
      (supabase as any).from("adminos_followup_sequences").select("*").order("name"),
      (supabase as any).from("adminos_followup_enrollments").select("*,adminos_contacts(full_name,email,phone),adminos_followup_sequences(name,sequence_key)").order("enrolled_at",{ascending:false}).limit(25),
      (supabase as any).from("adminos_followup_attempts").select("*").order("created_at",{ascending:false}).limit(25),
      (supabase as any).from("adminos_document_templates").select("*").eq("active",true).order("name"),
      (supabase as any).from("adminos_company_documents").select("*").order("updated_at",{ascending:false}).limit(25),
      (supabase as any).from("adminos_contacts").select("id,full_name,email,phone,status").eq("status","active").order("updated_at",{ascending:false}).limit(100),
    ]);
    const err = p.error||i.error||w.error||s.error||e.error||a.error||t.error||d.error||c.error;
    if (err) toast.error(err.message || "Could not load AdminOS Release 3");
    setProgress(p.data?.value||{}); setIntegrations(i.data||[]); setWaThreads(w.data||[]); setSequences(s.data||[]); setEnrollments(e.data||[]); setAttempts(a.data||[]); setTemplates(t.data||[]); setDocuments(d.data||[]); setContacts(c.data||[]);
    if (!sequenceKey && s.data?.[0]) setSequenceKey(s.data[0].sequence_key);
    if (!templateKey && t.data?.[0]) setTemplateKey(t.data[0].template_key);
    setLoading(false);
  }, [sequenceKey, templateKey]);
  useEffect(()=>{ void load(); },[]);

  const selectedTemplate = useMemo(()=>templates.find((x)=>x.template_key===templateKey),[templates,templateKey]);
  useEffect(()=>{ setMergeData({}); },[templateKey]);

  const run = async (key:string, fn:()=>Promise<any>, success:string|((d:any)=>string)) => {
    setWorking(key);
    try { const data = await fn(); toast.success(typeof success === "function" ? success(data) : success); await load(); return data; }
    catch (e:any) { toast.error(e?.message || "Action failed"); }
    finally { setWorking(null); }
  };
  const invoke = async (name:string, body:any) => { const {data,error}=await (supabase.functions as any).invoke(name,{body}); if(error) throw error; if(data?.error) throw new Error(data.error); return data; };

  const enroll = () => run("enroll",()=>invoke("adminos-followup-autopilot",{action:"enroll",sequence_key:sequenceKey,contact_id:contactId}),"Contact enrolled in Follow-up Autopilot");
  const tick = () => run("tick",()=>invoke("adminos-followup-autopilot",{action:"tick",max:25,source:"admin_ui"}),(d)=>`Processed ${d.processed} due follow-ups`);
  const generate = () => run("generate",()=>invoke("adminos-paperwork",{action:"generate",template_key:templateKey,merge_data:mergeData,title:selectedTemplate?.name}),"Company document generated");
  const preview = async (id:string) => {
    const data = await run(`preview:${id}`,()=>invoke("adminos-paperwork",{action:"signed_url",document_id:id}),"Secure preview created");
    if(data?.url) window.open(data.url,"_blank","noopener,noreferrer");
  };
  const finalize = (id:string) => run(`finalize:${id}`,()=>invoke("adminos-paperwork",{action:"finalize",document_id:id}),"Document finalized");

  return <div className="space-y-5">
    <section className="rounded-3xl border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="flex flex-wrap gap-2"><Badge className="gap-1"><Bot className="h-3.5 w-3.5"/>ADMINOS</Badge><Badge variant="outline">Release Gate 3</Badge><Badge variant="secondary">Phases 6–8</Badge><Badge variant={progress.release_gate_3==="complete"?"default":"outline"}>{progress.release_gate_3||"running"}</Badge></div><h2 className="mt-4 text-2xl font-black sm:text-3xl">Communicate. Follow up. Keep the paperwork.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">WhatsApp Business, scheduled follow-up automation and versioned company paperwork now operate inside the same AdminOS control plane. Phase 9 and voice remain outside this gate.</p></div>
        <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={loading?"animate-spin":""}/>Refresh</Button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-9">{Array.from({length:9},(_,p)=><Phase key={p} n={p} status={progress[`phase_${p}`]||"complete"}/>)}</div>
    </section>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Metric icon={MessageCircle} label="WhatsApp threads" value={waThreads.length}/><Metric icon={Workflow} label="Sequences" value={sequences.length}/><Metric icon={TimerReset} label="Active enrollments" value={enrollments.filter(x=>x.status==="active").length}/><Metric icon={Send} label="Follow-up attempts" value={attempts.length}/><Metric icon={FileText} label="Company documents" value={documents.length}/><Metric icon={ShieldCheck} label="Awaiting approval" value={documents.filter(x=>x.status==="awaiting_approval").length}/>
    </div>

    <Tabs defaultValue="whatsapp" className="space-y-4">
      <TabsList className="flex h-auto flex-wrap gap-1"><TabsTrigger value="whatsapp">Phase 6 · WhatsApp</TabsTrigger><TabsTrigger value="followups">Phase 7 · Follow-ups</TabsTrigger><TabsTrigger value="paperwork">Phase 8 · Paperwork</TabsTrigger><TabsTrigger value="integrations">Integrations</TabsTrigger></TabsList>

      <TabsContent value="whatsapp" className="space-y-4">
        <Card><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span>WhatsApp Business control</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>void run("wa-health",()=>invoke("adminos-whatsapp",{action:"health"}),(d)=>d.configured?"Twilio WhatsApp configured":"WhatsApp software healthy; credentials still required")}>Health</Button><Button size="sm" variant="outline" onClick={()=>void run("wa-test",()=>invoke("adminos-whatsapp",{action:"test"}),"Twilio account verified")}>Test provider</Button></div></CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Inbound webhook validation, CRM resolution, 24-hour customer service window enforcement, template gating, POPIA communication preferences, AI auto-replies and human escalation are active.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Recent WhatsApp conversations</CardTitle></CardHeader><CardContent className="p-0">{waThreads.length===0?<Empty text="No WhatsApp conversations yet."/>:<div className="divide-y">{waThreads.map(x=><div key={x.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-semibold">{x.channel_address}</p><p className="text-xs text-muted-foreground">{x.last_message_at?new Date(x.last_message_at).toLocaleString("en-ZA"):"No messages yet"}</p></div><Status value={x.status}/></div>)}</div>}</CardContent></Card>
      </TabsContent>

      <TabsContent value="followups" className="space-y-4">
        <Card><CardHeader><CardTitle>Follow-up Autopilot</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]"><Select value={sequenceKey} onValueChange={setSequenceKey}><SelectTrigger><SelectValue placeholder="Sequence"/></SelectTrigger><SelectContent>{sequences.map(s=><SelectItem key={s.id} value={s.sequence_key}>{s.name}</SelectItem>)}</SelectContent></Select><Select value={contactId} onValueChange={setContactId}><SelectTrigger><SelectValue placeholder="Contact"/></SelectTrigger><SelectContent>{contacts.map(c=><SelectItem key={c.id} value={c.id}>{c.full_name||c.email||c.phone||c.id.slice(0,8)}</SelectItem>)}</SelectContent></Select><Button onClick={()=>void enroll()} disabled={!sequenceKey||!contactId||working==="enroll"}><Play/>Enroll</Button><Button variant="outline" onClick={()=>void tick()} disabled={working==="tick"}><TimerReset/>Run due</Button></div><p className="text-xs text-muted-foreground">The production scheduler runs every 15 minutes. Quiet hours, do-not-contact, channel preferences, direct-marketing consent, stop-on-reply, pipeline stop stages and idempotency are enforced before each attempt.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Recent enrollments</CardTitle></CardHeader><CardContent className="p-0">{enrollments.length===0?<Empty text="No follow-up enrollments yet."/>:<div className="divide-y">{enrollments.map(e=><div key={e.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{e.adminos_contacts?.full_name||e.adminos_contacts?.email||"Contact"}</p><p className="text-xs text-muted-foreground">{e.adminos_followup_sequences?.name} · step {e.current_step} · next {e.next_run_at?new Date(e.next_run_at).toLocaleString("en-ZA"):"—"}</p></div><Status value={e.status}/></div></div>)}</div>}</CardContent></Card>
      </TabsContent>

      <TabsContent value="paperwork" className="space-y-4">
        <Card><CardHeader><CardTitle>Generate company paperwork</CardTitle></CardHeader><CardContent className="space-y-4"><Select value={templateKey} onValueChange={setTemplateKey}><SelectTrigger><SelectValue placeholder="Template"/></SelectTrigger><SelectContent>{templates.map(t=><SelectItem key={t.id} value={t.template_key}>{t.name} · {t.risk_level}</SelectItem>)}</SelectContent></Select>{selectedTemplate&&<div className="grid gap-3 md:grid-cols-2">{(selectedTemplate.variables||[]).map((v:string)=><div key={v} className="space-y-1.5"><Label>{v.replaceAll("_"," ")}</Label><Input value={mergeData[v]||""} onChange={e=>setMergeData(x=>({...x,[v]:e.target.value}))}/></div>)}</div>}<div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Green templates can remain drafts or be finalized. Amber/red templates always enter human approval before finalization.</p><Button onClick={()=>void generate()} disabled={!templateKey||working==="generate"}><FileText/>Generate</Button></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Document vault</CardTitle></CardHeader><CardContent className="p-0">{documents.length===0?<Empty text="No company documents generated yet."/>:<div className="divide-y">{documents.map(d=><div key={d.id} className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap gap-2"><Badge variant="outline">{d.document_number}</Badge><Badge variant={d.risk_level==="red"?"destructive":"secondary"}>{d.risk_level}</Badge></div><p className="mt-2 font-semibold">{d.title}</p><p className="text-xs text-muted-foreground">v{d.current_version} · {d.category}</p></div><div className="flex flex-wrap gap-2"><Status value={d.status}/><Button size="sm" variant="outline" onClick={()=>void preview(d.id)}>Preview</Button>{["draft","approved"].includes(d.status)&&<Button size="sm" onClick={()=>void finalize(d.id)}>Finalize</Button>}</div></div></div>)}</div>}</CardContent></Card>
      </TabsContent>

      <TabsContent value="integrations"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{integrations.map(i=><Card key={i.id}><CardHeader><CardTitle className="text-base">{i.display_name}</CardTitle></CardHeader><CardContent className="space-y-2"><div className="flex items-center justify-between"><Status value={i.status}/><Badge variant="outline">Step {i.setup_step}/3</Badge></div>{i.external_account_label&&<p className="text-sm font-medium">{i.external_account_label}</p>}<p className="text-xs text-muted-foreground">Secrets remain server-side. A connector can be production software-complete while credentials are still awaiting connection.</p></CardContent></Card>)}</div></TabsContent>
    </Tabs>
  </div>;
}

function Phase({n,status}:{n:number;status:string}){const done=status==="complete";return <Card className={done?"border-primary/30":""}><CardContent className="p-3"><div className="flex items-center justify-between"><Badge variant="outline">{n}/11</Badge>{done?<CheckCircle2 className="h-4 w-4"/>:<Bot className="h-4 w-4 text-muted-foreground"/>}</div><p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">{String(status).replaceAll("_"," ")}</p></CardContent></Card>}
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number}){return <Card><CardContent className="p-4"><div className="flex items-center justify-between"><Icon className="h-4 w-4"/><strong className="text-xl">{value}</strong></div><p className="mt-3 text-xs text-muted-foreground">{label}</p></CardContent></Card>}
function Status({value}:{value:string}){const good=["complete","connected","active","sent","finalized","approved","resolved"].includes(value);const bad=["failed","blocked","rejected","error"].includes(value);return <Badge variant={bad?"destructive":good?"default":"outline"}>{String(value||"unknown").replaceAll("_"," ")}</Badge>}
function Empty({text}:{text:string}){return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>}
