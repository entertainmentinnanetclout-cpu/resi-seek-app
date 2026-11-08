import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, CircleAlert, Clock3, Mail, RefreshCw, Send, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type Mode = "admin" | "landlord";
type Kind = "application" | "reservation" | "housing_lead" | "support_enquiry";
type Template = "status_update" | "feedback" | "documents_needed" | "next_steps" | "enquiry_response" | "viewing_invite";
interface Target {
  id:string; kind:Kind; label:string; status:string; email_hint:string|null;
  residence_name:string|null; created_at:string; can_email:boolean;
}
interface Preview {subject:string;body:string;recipient_hint:string}
interface History {
  id:string;target_kind:Kind;recipient_email:string;template_key:string;
  delivery_status:string;subject:string;created_at:string;failure_code:string|null;
}
const kinds:Record<Kind,string> = {
  application:"Applications", reservation:"Reservations",
  housing_lead:"Accommodation enquiries",support_enquiry:"Support enquiries"
};
const templates:Record<Kind,{key:Template;label:string}[]> = {
  application:[
    {key:"status_update",label:"Application status update"},
    {key:"feedback",label:"Application feedback"},
    {key:"documents_needed",label:"Request additional documents"},
    {key:"next_steps",label:"Next steps"}
  ],
  reservation:[
    {key:"status_update",label:"Reservation status"},
    {key:"feedback",label:"Reservation feedback"},
    {key:"next_steps",label:"Next steps"},
    {key:"viewing_invite",label:"Viewing information"}
  ],
  housing_lead:[
    {key:"enquiry_response",label:"Respond to enquiry"},
    {key:"viewing_invite",label:"Viewing arrangements"},
    {key:"feedback",label:"Follow-up"}
  ],
  support_enquiry:[
    {key:"enquiry_response",label:"Resolve enquiry"},
    {key:"feedback",label:"Service feedback"},
    {key:"next_steps",label:"Next steps"}
  ]
};
const isKind=(value:string|null):value is Kind=>!!value&&Object.prototype.hasOwnProperty.call(kinds,value);
const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());

/** Shared across the admin Communications office and the residence portal. */
export default function CommunicationEmailWorkspace({mode}:{mode:Mode}) {
  const [params,setParams]=useSearchParams();
  const initialKind=isKind(params.get("kind"))?params.get("kind") as Kind:"application";
  const [kind,setKind]=useState<Kind>(mode==="landlord"&&initialKind==="support_enquiry"?"application":initialKind);
  const [targets,setTargets]=useState<Target[]>([]);
  const [selectedId,setSelectedId]=useState(params.get("target")||"");
  const [template,setTemplate]=useState<Template>(templates[mode==="landlord"&&initialKind==="support_enquiry"?"application":initialKind][0].key);
  const [message,setMessage]=useState("");
  const [preview,setPreview]=useState<Preview|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [connection,setConnection]=useState<{connected:boolean;email:string|null}|null>(null);
  const [history,setHistory]=useState<History[]>([]);
  const [recordsLoading,setRecordsLoading]=useState(false);
  const [busy,setBusy]=useState<"connect"|"preview"|"send"|"disconnect"|null>(null);
  const [query,setQuery]=useState("");
  const [connectionError,setConnectionError]=useState("");

  const invoke=useCallback(async (fn:string,body:Record<string,unknown>)=>{
    const {data,error}=await supabase.functions.invoke(fn,{body});
    if(error){
      let reason=error.message;
      try{
        const detail=await error.context?.json?.();
        if(typeof detail?.error==="string")reason=detail.error;
      }catch{/* Endpoint may not have supplied a JSON error. */}
      throw new Error(reason);
    }
    return data;
  },[]);
  const loadConnection=useCallback(async()=>{
    try{
      const data=await invoke("gmail-connect",{action:"status"});
      setConnection({connected:!!data.connected,email:data.email||null});
      setConnectionError("");
    }catch(error){
      setConnectionError(error instanceof Error?error.message:"Gmail status unavailable");
    }
  },[invoke]);
  const loadHistory=useCallback(async()=>{
    try{
      const data=await invoke("reskonnect-email",{action:"history"});
      setHistory(data.items||[]);
    }catch(error){console.warn("Email history unavailable",error);}
  },[invoke]);
  const loadTargets=useCallback(async()=>{
    setRecordsLoading(true);
    try{
      const data=await invoke("reskonnect-email",{action:"list",kind});
      setTargets(data.items||[]);
    }catch(error){
      setTargets([]);
      toast.error(error instanceof Error?error.message:"Could not load communication records");
    }finally{setRecordsLoading(false);}
  },[invoke,kind]);

  useEffect(()=>{void loadConnection();void loadHistory();},[loadConnection,loadHistory]);
  useEffect(()=>{void loadTargets();},[loadTargets]);
  const selected=targets.find(t=>t.id===selectedId);
  const visible=useMemo(()=>targets.filter(t=>(
    (t.label+" "+t.status+" "+(t.residence_name||"")).toLowerCase().includes(query.trim().toLowerCase())
  )),[targets,query]);

  const clearDraft=()=>{setPreview(null);setConfirmed(false);};
  const onKind=(value:Kind)=>{
    setKind(value);setSelectedId("");setQuery("");setMessage("");clearDraft();
    setTemplate(templates[value][0].key);
    const next=new URLSearchParams(params);next.set("kind",value);next.delete("target");setParams(next,{replace:true});
  };
  const onTarget=(id:string)=>{
    setSelectedId(id);clearDraft();
    const next=new URLSearchParams(params);next.set("kind",kind);next.set("target",id);setParams(next,{replace:true});
  };
  const onTemplate=(next:Template)=>{setTemplate(next);clearDraft();};
  const handleConnect=async()=>{
    setBusy("connect");
    try{
      const data=await invoke("gmail-connect",{action:"connect"});
      if(!data.authorization_url || !String(data.authorization_url).startsWith("https://accounts.google.com/")){
        throw new Error("Google authorization URL was not returned");
      }
      window.location.assign(data.authorization_url);
    }catch(error){toast.error(error instanceof Error?error.message:"Gmail connection could not start");setBusy(null);}
  };
  const handleDisconnect=async()=>{
    if(!window.confirm("Disconnect this Gmail account from ResKonnect? Existing email history will remain available."))return;
    setBusy("disconnect");
    try{
      await invoke("gmail-connect",{action:"disconnect"});
      toast.success("Gmail disconnected");
      setConnection({connected:false,email:null});clearDraft();
    }catch(error){toast.error(error instanceof Error?error.message:"Could not disconnect Gmail");}
    finally{setBusy(null);}
  };
  const handlePreview=async()=>{
    if(!selectedId){toast.error("Choose a record first");return;}
    setBusy("preview");clearDraft();
    try{
      const data=await invoke("reskonnect-email",{
        action:"preview",kind,target_id:selectedId,template_key:template,message
      });
      setPreview(data);
    }catch(error){toast.error(error instanceof Error?error.message:"Could not preview email");}
    finally{setBusy(null);}
  };
  const handleSend=async()=>{
    if(!preview||!selectedId||!confirmed||!connection?.connected)return;
    setBusy("send");
    try{
      const idempotency=crypto.randomUUID();
      const response=await invoke("reskonnect-email",{
        action:"send",kind,target_id:selectedId,template_key:template,message,idempotency_key:idempotency
      });
      if(!response.sent)throw new Error("Gmail did not confirm sending");
      toast.success("Email accepted by Gmail");
      clearDraft();setMessage("");
      await Promise.all([loadHistory(),loadConnection()]);
    }catch(error){toast.error(error instanceof Error?error.message:"Could not send email");}
    finally{setBusy(null);}
  };

  return <div className="space-y-5">
    <Card className="border-primary/20">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Mail className="h-5 w-5"/>Gmail sender</CardTitle>
        <CardDescription>{mode==="admin"?"Connect the official ResKonnect Gmail address to send service messages as ResKonnect.":"Connect your landlord Gmail account to send approved accommodation messages without revealing applicants' addresses."}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {connection?.connected?<CheckCircle2 className="h-5 w-5 text-emerald-600"/>:<CircleAlert className="h-5 w-5 text-amber-600"/>}
          <div><p className="text-sm font-semibold">{connection?.connected?"Connected to Gmail":"Gmail not connected"}</p>
            <p className="text-xs text-muted-foreground">{connection?.email||connectionError||"An authorized account is required before sending."}</p></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={()=>void loadConnection()}><RefreshCw className="mr-1.5 h-3.5 w-3.5"/>Check</Button>
          {connection?.connected
            ?<Button variant="outline" size="sm" disabled={!!busy} onClick={()=>void handleDisconnect()}><Unplug className="mr-1.5 h-3.5 w-3.5"/>Disconnect</Button>
            :<Button size="sm" disabled={!!busy} onClick={()=>void handleConnect()}>Connect Gmail</Button>}
        </div>
      </CardContent>
    </Card>
    <div className="grid gap-5 xl:grid-cols-[minmax(290px,.9fr)_minmax(0,1.1fr)]">
      <Card className="min-w-0">
        <CardHeader><CardTitle className="text-base">Choose a conversation</CardTitle>
          <CardDescription>Only application, reservation and enquiry records already in ResKonnect can be emailed.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">{(Object.keys(kinds) as Kind[]).filter(k=>mode==="admin"||k!=="support_enquiry").map(k=>
            <Button key={k} variant={kind===k?"default":"outline"} size="sm" onClick={()=>onKind(k)}>{kinds[k]}</Button>
          )}</div>
          <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter records by name, status or property" aria-label="Search email records"/>
          <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {recordsLoading?<p className="py-6 text-center text-sm text-muted-foreground">Loading records…</p>
              :visible.length===0?<p className="py-6 text-center text-sm text-muted-foreground">No matching records found.</p>
              :visible.map(t=><button type="button" key={t.id}
                aria-pressed={selectedId===t.id} onClick={()=>onTarget(t.id)}
                className={`w-full rounded-xl border p-3 text-left transition hover:border-primary/40 ${selectedId===t.id?"border-primary bg-primary/5":"bg-card"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{t.label}</p><Badge variant="outline">{label(t.status)}</Badge></div>
                <p className="mt-1 text-xs text-muted-foreground">{t.residence_name||kinds[t.kind]} · {t.email_hint||"No email recorded"}</p>
                {!t.can_email&&<p className="mt-1 text-xs font-medium text-amber-700">Email unavailable or contact permission missing</p>}
              </button>)}
          </div>
          <Button size="sm" variant="ghost" onClick={()=>void loadTargets()} disabled={recordsLoading}><RefreshCw className="mr-1.5 h-4 w-4"/>Refresh records</Button>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader><CardTitle className="text-base">Compose service email</CardTitle><CardDescription>Use accurate, factual updates. No automatic bulk sending.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Recipient record</Label><p className="mt-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm">{selected?selected.label+" · "+(selected.email_hint||"email unavailable"):selectedId?"Selected record "+selectedId.slice(0,8):"Select a record on the left"}</p></div>
          <div><Label htmlFor="res-email-template">Email purpose</Label>
            <Select value={template} onValueChange={v=>onTemplate(v as Template)}><SelectTrigger id="res-email-template" className="mt-1"><SelectValue/></SelectTrigger>
              <SelectContent>{templates[kind].map(t=><SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label htmlFor="res-email-note">Additional information</Label>
            <Textarea id="res-email-note" className="mt-1 min-h-28" maxLength={2500}
              placeholder="Write clear feedback, missing documents, next steps, viewing details or a response to the student's question."
              value={message} onChange={e=>{setMessage(e.target.value);clearDraft();}}/>
            <p className="mt-1 text-xs text-muted-foreground">{message.length}/2,500 characters · Avoid personal ID numbers and unnecessary sensitive details.</p>
          </div>
          <Button variant="outline" onClick={()=>void handlePreview()} disabled={!selectedId||!!busy}><Mail className="mr-2 h-4 w-4"/> {busy==="preview"?"Preparing preview…":"Preview email"}</Button>
          {preview&&<div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-semibold text-muted-foreground">TO: {preview.recipient_hint}</p>
            <p className="text-sm font-bold">SUBJECT: {preview.subject}</p>
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-6">{preview.body}</pre>
            <div className="flex items-start gap-2 border-t pt-3">
              <Checkbox id="res-email-confirm" checked={confirmed} onCheckedChange={v=>setConfirmed(v===true)}/>
              <Label htmlFor="res-email-confirm" className="cursor-pointer text-xs leading-5">I have checked the recipient, recorded status and message. I authorize sending this service email.</Label>
            </div>
            <Button onClick={()=>void handleSend()} disabled={!connection?.connected||!confirmed||!!busy||!selectedId} className="w-full">
              <Send className="mr-2 h-4 w-4"/>{busy==="send"?"Sending…":"Send using connected Gmail"}
            </Button>
          </div>}
          {!connection?.connected&&<p className="text-xs text-muted-foreground">Preview is available now; connect Gmail before sending.</p>}
        </CardContent>
      </Card>
    </div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4"/>Email history</CardTitle>
        <CardDescription>Gmail accepting a message is not proof that the recipient opened or received it.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {history.length===0?<p className="text-sm text-muted-foreground">No email attempts from this connected account yet.</p>:history.map(item=>
          <div key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3">
            <div><p className="text-sm font-medium">{item.subject}</p><p className="text-xs text-muted-foreground">{item.recipient_email} · {new Date(item.created_at).toLocaleString("en-ZA")}</p>
              {item.failure_code&&<p className="mt-1 text-xs text-amber-700">{item.failure_code}</p>}</div>
            <Badge variant={item.delivery_status==="sent"?"default":item.delivery_status==="failed"?"destructive":"outline"}>{label(item.delivery_status)}</Badge>
          </div>)}
        <Button size="sm" variant="ghost" onClick={()=>void loadHistory()}><RefreshCw className="mr-1.5 h-4 w-4"/>Refresh email history</Button>
      </CardContent>
    </Card>
    <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>Only authenticated ResKonnect staff and authorized landlords can send. Recipient addresses are resolved server-side; Gmail permissions are limited to sending.</p>
  </div>;
}
