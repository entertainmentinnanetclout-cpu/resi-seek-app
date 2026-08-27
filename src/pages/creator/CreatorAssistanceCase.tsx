import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ExternalLink, FileText, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage/signedUrl";
import { toast } from "sonner";

const STATUSES = [
  ["requested", "Requested"], ["documents_pending", "Documents pending"], ["ready_to_apply", "Ready to apply"],
  ["in_progress", "In progress"], ["submitted", "Submitted"], ["awaiting_response", "Awaiting response"],
  ["completed", "Completed"], ["closed", "Closed"],
] as const;

const CreatorAssistanceCase = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [row, setRow] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("requested");

  const load = async () => {
    if (!user || !caseId) return;
    setLoading(true);
    const { data, error } = await (supabase as any).from("creator_assistance_cases").select("*").eq("id", caseId).maybeSingle();
    if (error || !data) { setLoading(false); return; }
    setRow(data); setNotes(data.creator_notes || ""); setReference(data.application_reference || ""); setStatus(data.status || "requested");
    const { data: docRows } = await (supabase as any).from("application_assistance_documents").select("*").eq("case_id", data.id).order("created_at", { ascending:false });
    setDocs(docRows || []); setLoading(false);
  };
  useEffect(() => { void load(); }, [caseId, user?.id]);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const { data, error } = await (supabase as any).from("creator_assistance_cases").update({ status, creator_notes:notes.trim() || null, application_reference:reference.trim() || null }).eq("id",row.id).select("*").single();
    setSaving(false);
    if (error) return toast.error(error.message || "Could not update assistance case");
    setRow(data); toast.success("Application assistance case updated");
  };

  const openDoc = async (doc:any) => {
    try { window.open(await getSignedUrl("application-documents",doc.file_path,900),"_blank","noopener,noreferrer"); }
    catch { toast.error("Document access has expired or was revoked"); }
  };

  if (loading) return <DashboardLayout><div className="py-24 text-center text-sm text-muted-foreground">Loading assistance case...</div></DashboardLayout>;
  if (!row) return <DashboardLayout><div className="mx-auto max-w-xl px-4 py-24 text-center"><LockKeyhole className="mx-auto h-10 w-10 text-muted-foreground"/><h1 className="mt-4 text-2xl font-black">Case unavailable</h1><p className="mt-2 text-sm text-muted-foreground">You do not have access to this application case, or the student has revoked consent.</p><Button className="mt-5" onClick={()=>navigate("/creator-partners")}>Back to Creator Dashboard</Button></div></DashboardLayout>;

  return <DashboardLayout>
    <SEO noIndex title={`Application Assistance | ${row.applicant_name} | ResKonnect`} description="Protected creator application assistance workspace." />
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div><Button asChild variant="ghost" className="-ml-3"><Link to="/creator-partners"><ArrowLeft className="mr-2 h-4 w-4"/>Creator Dashboard</Link></Button></div>
      <section className="overflow-hidden rounded-3xl bg-[#071326] p-6 text-white md:p-8"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><Badge className="bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]">APPLICATION ASSISTANCE</Badge><h1 className="mt-3 text-3xl font-black">{row.applicant_name}</h1><p className="mt-2 text-sm text-white/70">{row.applicant_stage?.replaceAll("_"," ")} · Intake {row.intake_year} · {(row.target_institutions||[]).join(", ")}</p></div><Badge variant="secondary" className="w-fit">{String(row.status).replaceAll("_"," ")}</Badge></div></section>

      <div className="grid gap-6 lg:grid-cols-[1fr,.9fr]">
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Applicant information</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Full name" value={row.applicant_name}/><Info label="Phone / WhatsApp" value={row.phone}/><Info label="Email" value={row.email}/><Info label="Campus / context" value={row.campus}/><Info label="Student number" value={row.student_number || "Not supplied"}/><Info label="South African ID" value={row.identity_number || "Not supplied"}/><Info label="Course / current study" value={row.course || "Not supplied"}/><Info label="Funding" value={row.funding_type || "Undecided"}/><Info label="Qualification interests" value={row.qualification_interests || "Not supplied"} className="sm:col-span-2"/><Info label="Student notes" value={row.student_notes || "None"} className="sm:col-span-2"/>
            <div className="sm:col-span-2 rounded-xl border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mr-1 inline h-4 w-4 text-primary"/>These details are visible because the applicant explicitly consented to creator-assisted applications. Do not copy, export or use them outside the student's application work.</div>
          </CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary"/>Application documents</CardTitle></CardHeader><CardContent>{docs.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</div> : <div className="space-y-2">{docs.map((doc)=><div key={doc.id} className="flex items-center gap-3 rounded-xl border p-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{doc.file_name}</p><p className="text-xs text-muted-foreground">{doc.document_type.replaceAll("_"," ")}</p></div><Button size="sm" variant="outline" onClick={()=>void openDoc(doc)}><ExternalLink className="mr-2 h-4 w-4"/>Open</Button></div>)}</div>}</CardContent></Card>
        </div>

        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Application workflow</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{STATUSES.map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Application / reference number</Label><Input value={reference} onChange={(e)=>setReference(e.target.value)} placeholder="Add after submission"/></div>
            <div className="space-y-1.5"><Label>Creator working notes</Label><Textarea value={notes} onChange={(e)=>setNotes(e.target.value)} className="min-h-[180px]" placeholder="Requirements checked, institution portal progress, next follow-up..."/></div>
            <Button className="w-full" onClick={()=>void save()} disabled={saving}><Save className="mr-2 h-4 w-4"/>{saving ? "Saving..." : "Save progress"}</Button>
          </CardContent></Card>
          {row.status === "submitted" || row.status === "completed" ? <Card className="border-emerald-500/30 bg-emerald-500/[0.04]"><CardContent className="p-5"><CheckCircle2 className="h-6 w-6 text-emerald-600"/><p className="mt-3 font-black">Submission tracked</p><p className="mt-1 text-sm text-muted-foreground">This outcome is now part of the creator's measurable ResKonnect conversion record.</p></CardContent></Card> : null}
        </div>
      </div>
    </div>
  </DashboardLayout>;
};

function Info({label,value,className=""}:{label:string;value:any;className?:string}) { return <div className={className}><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value || "—"}</p></div>; }

export default CreatorAssistanceCase;
