import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, FileText, Loader2, MessageSquare, Send, ShieldCheck, User, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getResidenceApplicationRef, getResidenceApplicationStatusLabel } from "@/lib/residenceApplications";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import type { ResidencePortalContext } from "./ResidenceLayout";

interface ApplicationRow {
  id:string; user_id:string; residence_id:string; status:string; funding_type:string|null; created_at:string|null; updated_at:string|null; notes:string|null; application_date:string|null; move_in_date:string|null; moved_in:boolean|null; institution_type:string|null;
  applicant_name:string|null; student_number:string|null; campus:string|null; course:string|null;
}
interface MessageRow { id:string; sender_type:string; sender_user_id:string|null; message:string; created_at:string|null; }
interface ActivityRow { id:string; action_type:string; actor_type:string; metadata:Record<string,unknown>|null; created_at:string; }
interface DocumentRow { id:string; doc_type:string; original_filename:string|null; status:string; rejection_reason:string|null; uploaded_at:string; }

const STATUS_OPTIONS=[
  {value:"documents_required",label:"Request documents",icon:FileText},
  {value:"under_review",label:"Mark under review",icon:Clock3},
  {value:"conditionally_approved",label:"Conditionally approve",icon:CheckCircle2},
  {value:"approved",label:"Approve",icon:CheckCircle2},
  {value:"rejected",label:"Reject",icon:XCircle},
] as const;
const TEMPLATES=[
  "Thank you for your application. We need additional documents before we can continue reviewing it. Please upload the requested documents in ResKonnect.",
  "Your accommodation application is now under review. We will update you in ResKonnect as soon as a decision is available.",
  "Your application has been conditionally approved. Please review the remaining requirements in ResKonnect and complete them as soon as possible.",
];
const statusVariant=(status:string):"default"|"secondary"|"destructive"|"outline"=>status==="approved"?"default":status==="rejected"?"destructive":status==="withdrawn"?"outline":"secondary";

export default function ResidenceApplicationDetail(){
  const {id}=useParams<{id:string}>();
  const navigate=useNavigate();
  const {residence}=useOutletContext<ResidencePortalContext>();
  const [application,setApplication]=useState<ApplicationRow|null>(null);
  const [messages,setMessages]=useState<MessageRow[]>([]);
  const [activity,setActivity]=useState<ActivityRow[]>([]);
  const [documents,setDocuments]=useState<DocumentRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [sending,setSending]=useState(false);
  const [statusDialog,setStatusDialog]=useState(false);
  const [selectedStatus,setSelectedStatus]=useState("");
  const [statusNote,setStatusNote]=useState("");
  const [updating,setUpdating]=useState(false);

  const load=useCallback(async()=>{
    if(!id||!residence?.id)return;
    setLoading(true);setError(null);
    try{
      const {data:appData,error:appError}=await (supabase as any).from("residence_portal_applications_safe").select("*").eq("id",id).eq("residence_id",residence.id).single();
      if(appError)throw appError;
      const [{data:messageData},{data:activityData},{data:documentData}]=await Promise.all([
        supabase.from("application_messages").select("id,sender_type,sender_user_id,message,created_at").eq("application_id",id).eq("residence_id",residence.id).order("created_at",{ascending:true}),
        supabase.from("application_activity_log").select("id,action_type,actor_type,metadata,created_at").eq("application_id",id).eq("residence_id",residence.id).order("created_at",{ascending:false}).limit(20),
        supabase.from("application_documents").select("id,doc_type,original_filename,status,rejection_reason,uploaded_at").eq("application_id",id).eq("residence_id",residence.id).order("uploaded_at",{ascending:false}),
      ]);
      setApplication(appData as ApplicationRow);setMessages((messageData||[]) as MessageRow[]);setActivity((activityData||[]) as ActivityRow[]);setDocuments((documentData||[]) as DocumentRow[]);
    }catch(err){console.error(err);setError("This application could not be loaded. It may not belong to your residence, or the data is temporarily unavailable.");}
    finally{setLoading(false);}
  },[id,residence?.id]);

  useEffect(()=>{if(!id||!residence?.id)return;void load();const channel=supabase.channel(`residence-application-${id}`).on("postgres_changes",{event:"*",schema:"public",table:"application_messages",filter:`application_id=eq.${id}`},()=>void load()).on("postgres_changes",{event:"UPDATE",schema:"public",table:"applications",filter:`id=eq.${id}`},()=>void load()).subscribe();return()=>{void supabase.removeChannel(channel);};},[id,residence?.id,load]);

  const sendMessage=async()=>{
    const body=message.trim();if(!body||!application||!residence)return;setSending(true);
    try{const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Session expired");const {error:sendError}=await supabase.from("application_messages").insert({application_id:application.id,residence_id:residence.id,sender_type:"residence",sender_user_id:user.id,message:body});if(sendError)throw sendError;await supabase.from("notifications").insert({user_id:application.user_id,type:"application_message",title:`Message from ${residence.name}`,message:body.length>180?`${body.slice(0,177)}...`:body,metadata:{application_id:application.id,residence_id:residence.id}});setMessage("");toast.success("Message sent through ResKonnect.");await load();}catch(err){console.error(err);toast.error("Message could not be sent.");}finally{setSending(false);}
  };

  const updateStatus=async()=>{
    if(!selectedStatus||!application||!residence)return;setUpdating(true);
    try{const label=getResidenceApplicationStatusLabel(selectedStatus);const note=statusNote.trim();const timestamp=new Date().toLocaleString("en-ZA");const notes=note?`${application.notes?`${application.notes}\n`:""}[${timestamp}] ${label}: ${note}`:application.notes;const {error:updateError}=await supabase.from("applications").update({status:selectedStatus,...(note?{notes}:{})}).eq("id",application.id).eq("residence_id",residence.id);if(updateError)throw updateError;const {data:{user}}=await supabase.auth.getUser();if(user)await supabase.from("application_activity_log").insert({application_id:application.id,residence_id:residence.id,actor_user_id:user.id,actor_type:"residence",action_type:"status_updated",metadata:{previous_status:application.status,new_status:selectedStatus,note:note||null}});await supabase.from("notifications").insert({user_id:application.user_id,type:"application_status",title:`${residence.name}: ${label}`,message:note?`Your accommodation application is now ${label.toLowerCase()}. ${note}`:`Your accommodation application is now ${label.toLowerCase()}.`,metadata:{application_id:application.id,residence_id:residence.id,status:selectedStatus}});toast.success(`Application updated to ${label}.`);setStatusDialog(false);setSelectedStatus("");setStatusNote("");await load();}catch(err){console.error(err);toast.error("Application status could not be updated.");}finally{setUpdating(false);}
  };

  if(!residence)return <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">Loading your residence...</div>;
  if(loading)return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary"/></div>;
  if(error||!application)return <Card className="mx-auto max-w-xl"><CardContent className="p-8 text-center"><p className="font-semibold">Application unavailable</p><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-5" variant="outline" onClick={()=>navigate("/residence/inbox")}>Back to applications</Button></CardContent></Card>;
  const appliedAt=application.application_date||application.created_at;

  return <><SEO noIndex title={`Application ${getResidenceApplicationRef(application.id)} | ${residence.name} | ResKonnect`} description="Review a residence application."/><div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="flex items-start gap-3"><Button variant="outline" size="icon" onClick={()=>navigate("/residence/inbox")}><ArrowLeft className="h-4 w-4"/></Button><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black sm:text-3xl">{application.applicant_name||"Applicant"}</h1><Badge variant={statusVariant(application.status)}>{getResidenceApplicationStatusLabel(application.status)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Ref {getResidenceApplicationRef(application.id)} · {appliedAt?`Applied ${new Date(appliedAt).toLocaleDateString("en-ZA")}`:"Application date unavailable"}</p></div></div><Button onClick={()=>setStatusDialog(true)}>Update application status</Button></div>

    <Card className="border-emerald-500/20 bg-emerald-500/[0.035]"><CardContent className="flex items-start gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"/><div><p className="text-sm font-bold">Protected communication</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Student phone numbers and email addresses are intentionally hidden from the residence portal. Use ResKonnect messaging and application status updates to communicate with the applicant.</p></div></CardContent></Card>

    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5"/>Applicant details</CardTitle><CardDescription>Operational information needed to assess the accommodation application.</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[["Full name",application.applicant_name||"Not provided"],["Student number",application.student_number||"Not provided"],["Campus",application.campus||"Not provided"],["Course",application.course||"Not provided"],["Funding",application.funding_type||"Not specified"],["Institution type",application.institution_type||"Not specified"],["Move-in",application.move_in_date?new Date(`${application.move_in_date}T00:00:00`).toLocaleDateString("en-ZA"):"Not specified"]].map(([label,value])=><div key={label}><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/>ResKonnect messages</CardTitle><CardDescription>Keep applicant communication inside the platform.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border bg-muted/20 p-3">{messages.length?messages.map((m)=><div key={m.id} className={`max-w-[88%] rounded-xl p-3 text-sm ${m.sender_type==="residence"?"ml-auto bg-primary text-primary-foreground":"bg-background border"}`}><p>{m.message}</p><p className={`mt-1 text-[10px] ${m.sender_type==="residence"?"text-primary-foreground/70":"text-muted-foreground"}`}>{m.created_at?new Date(m.created_at).toLocaleString("en-ZA"):""}</p></div>):<p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>}</div><div className="flex flex-wrap gap-2">{TEMPLATES.map((t,i)=><Button key={i} size="sm" variant="outline" onClick={()=>setMessage(t)}>Template {i+1}</Button>)}</div><Textarea rows={4} value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="Send an in-platform message to the applicant…"/><Button onClick={()=>void sendMessage()} disabled={sending||!message.trim()}><Send className="mr-2 h-4 w-4"/>{sending?"Sending…":"Send through ResKonnect"}</Button></CardContent></Card>
      </div>

      <div className="space-y-6">
        <Card><CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader><CardContent className="space-y-2">{documents.length?documents.map((doc)=><div key={doc.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{doc.original_filename||doc.doc_type}</p><Badge variant="outline">{doc.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{doc.doc_type.replace(/_/g," ")} · {new Date(doc.uploaded_at).toLocaleDateString("en-ZA")}</p>{doc.rejection_reason&&<p className="mt-1 text-xs text-destructive">{doc.rejection_reason}</p>}</div>):<p className="text-sm text-muted-foreground">No application documents uploaded yet.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader><CardContent className="space-y-3">{activity.length?activity.map((item)=><div key={item.id} className="border-l-2 border-primary/25 pl-3"><p className="text-sm font-semibold">{item.action_type.replace(/_/g," ")}</p><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("en-ZA")} · {item.actor_type}</p></div>):<p className="text-sm text-muted-foreground">No activity recorded yet.</p>}</CardContent></Card>
      </div>
    </div>

    <Dialog open={statusDialog} onOpenChange={setStatusDialog}><DialogContent><DialogHeader><DialogTitle>Update application status</DialogTitle><DialogDescription>The applicant will be notified inside ResKonnect. Add a note when context is useful.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Status</Label><Select value={selectedStatus} onValueChange={setSelectedStatus}><SelectTrigger><SelectValue placeholder="Choose a status"/></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((s)=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Optional note</Label><Textarea rows={4} value={statusNote} onChange={(e)=>setStatusNote(e.target.value)} placeholder="Explain the next step or reason…"/></div></div><DialogFooter><Button variant="outline" onClick={()=>setStatusDialog(false)}>Cancel</Button><Button onClick={()=>void updateStatus()} disabled={!selectedStatus||updating}>{updating?"Updating…":"Update status"}</Button></DialogFooter></DialogContent></Dialog>
  </div></>;
}