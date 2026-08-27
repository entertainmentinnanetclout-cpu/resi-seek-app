import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, FileCheck2, ShieldCheck, Sparkles } from "lucide-react";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import ApplicationDocumentUploader from "@/components/applications/ApplicationDocumentUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BRAND } from "@/constants/brand";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STAGES = [
  ["university_student", "University student"],
  ["tvet_student", "TVET student"],
  ["matriculant", "Matriculant / Grade 12"],
  ["private_applicant", "Private college / other applicant"],
  ["other", "Other"],
] as const;

const CreatorAssistanceIntake = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creator, setCreator] = useState<any>(null);
  const [caseRow, setCaseRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [docsReady, setDocsReady] = useState(false);
  const [form, setForm] = useState<any>({ applicant_name:"", email:"", phone:"", student_number:"", identity_number:"", applicant_stage:"matriculant", campus:"Not yet selected", course:"", year_of_study:"", institution_type:"university", target_institutions:"", qualification_interests:"", funding_type:"undecided", intake_year:"2027", student_notes:"" });

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      const { data: creatorData } = await (supabase as any).from("creator_partners").select("id,slug,display_name,handle,platform,status,profile_image_url").eq("slug", slug).eq("status", "active").maybeSingle();
      setCreator(creatorData || null);
      if (!user || !creatorData) { setLoading(false); return; }
      const [{ data: profile }, { data: existing }] = await Promise.all([
        (supabase as any).from("profiles").select("full_name,email,phone,student_number,identity_number,applicant_stage,campus,course,year_of_study").eq("id", user.id).maybeSingle(),
        (supabase as any).from("creator_assistance_cases").select("*").eq("creator_id", creatorData.id).eq("student_user_id", user.id).eq("intake_year", 2027).maybeSingle(),
      ]);
      if (existing) setCaseRow(existing);
      if (profile) setForm((prev:any) => ({ ...prev, applicant_name:profile.full_name||"", email:profile.email||user.email||"", phone:profile.phone||"", student_number:profile.student_number||"", identity_number:profile.identity_number||"", applicant_stage:profile.applicant_stage||prev.applicant_stage, campus:profile.campus||prev.campus, course:profile.course||"", year_of_study:profile.year_of_study||"" }));
      setLoading(false);
    };
    void load();
  }, [slug, user?.id]);

  const identifierOK = useMemo(() => form.student_number?.trim()?.length >= 5 || /^\d{13}$/.test(form.identity_number?.trim() || ""), [form.student_number, form.identity_number]);
  const canCreate = Boolean(creator && user && consent && form.applicant_name.trim().length >= 2 && form.phone.trim() && identifierOK && form.target_institutions.trim());

  const createCase = async () => {
    if (!user || !creator || !canCreate) return toast.error("Complete the required details and consent before continuing.");
    const targets = form.target_institutions.split(",").map((value:string) => value.trim()).filter(Boolean);
    const payload = {
      creator_id: creator.id,
      student_user_id: user.id,
      applicant_name: form.applicant_name.trim(), email: form.email.trim() || user.email || null, phone: form.phone.trim(),
      student_number: form.student_number.trim() || null, identity_number: form.identity_number.trim() || null,
      applicant_stage: form.applicant_stage, campus: form.campus || null, course: form.course.trim() || null, year_of_study: form.year_of_study || null,
      institution_type: form.institution_type, target_institutions: targets, qualification_interests: form.qualification_interests.trim() || null,
      funding_type: form.funding_type, intake_year: Number(form.intake_year || 2027), status: "documents_pending", consent_status: "granted", student_notes: form.student_notes.trim() || null,
    };
    const { data, error } = await (supabase as any).from("creator_assistance_cases").upsert(payload, { onConflict: "creator_id,student_user_id,intake_year" }).select("*").single();
    if (error) return toast.error(error.message || "Could not start application assistance");
    await (supabase as any).from("profiles").update({ phone: payload.phone, student_number: payload.student_number, identity_number: payload.identity_number, applicant_stage: payload.applicant_stage, campus: payload.campus }).eq("id", user.id);
    setCaseRow(data); toast.success(`Application assistance started with ${creator.display_name}`);
  };

  const markReady = async () => {
    if (!caseRow || !docsReady) return;
    const { data, error } = await (supabase as any).from("creator_assistance_cases").update({ status:"ready_to_apply" }).eq("id",caseRow.id).select("*").single();
    if (error) return toast.error(error.message);
    setCaseRow(data); toast.success("Your application pack is ready for creator assistance.");
  };

  const revoke = async () => {
    if (!caseRow) return;
    const { data, error } = await (supabase as any).from("creator_assistance_cases").update({ consent_status:"revoked", status:"closed" }).eq("id",caseRow.id).select("*").single();
    if (error) return toast.error(error.message);
    setCaseRow(data); toast.success("Creator document access has been revoked.");
  };

  if (loading) return <DashboardLayout><div className="py-24 text-center text-sm text-muted-foreground">Loading application assistance...</div></DashboardLayout>;
  if (!creator) return <DashboardLayout><div className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="text-2xl font-black">Creator assistance link unavailable</h1><p className="mt-2 text-muted-foreground">This creator is not currently active in the ResKonnect Creator Partner Programme.</p></div></DashboardLayout>;
  if (!user) return <DashboardLayout><div className="mx-auto max-w-xl px-4 py-20"><Card><CardContent className="p-8 text-center"><Sparkles className="mx-auto h-10 w-10 text-primary"/><h1 className="mt-4 text-2xl font-black">Get application help from {creator.display_name}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in or create a ResKonnect account first so your details and documents stay attached to your own protected profile.</p><Button className="mt-6" onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(`/creator-assist/${creator.slug}`)}`)}>Sign in to continue</Button></CardContent></Card></div></DashboardLayout>;

  return <DashboardLayout>
    <SEO noIndex title={`Application Assistance with ${creator.display_name} | ResKonnect`} description="Secure creator-assisted application preparation through ResKonnect." />
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <section className="overflow-hidden rounded-3xl bg-[#071326] p-6 text-white md:p-9"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10">{creator.profile_image_url ? <img src={creator.profile_image_url} alt="" className="h-full w-full object-cover"/> : <img src={BRAND.logos.icon} alt={BRAND.name} className="h-12 w-12 rounded-xl bg-white p-1"/>}</div><div><Badge className="bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]">CREATOR APPLICATION ASSISTANCE</Badge><h1 className="mt-3 text-3xl font-black">{creator.display_name} × ResKonnect</h1><p className="mt-2 text-sm text-white/70">Prepare your information and documents in one secure workspace. Your creator can assist with the application process after you explicitly grant access.</p></div></div></section>

      {!caseRow ? <Card><CardHeader><CardTitle>Your application assistance brief</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <Field label="Full name *"><Input value={form.applicant_name} onChange={(e)=>setForm({...form,applicant_name:e.target.value})}/></Field>
        <Field label="Phone / WhatsApp *"><Input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></Field>
        <Field label="I am a *"><Select value={form.applicant_stage} onValueChange={(v)=>setForm({...form,applicant_stage:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{STAGES.map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Funding"><Select value={form.funding_type} onValueChange={(v)=>setForm({...form,funding_type:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="undecided">Not sure yet</SelectItem><SelectItem value="nsfas">NSFAS</SelectItem><SelectItem value="private">Private / family funded</SelectItem><SelectItem value="bursary">Bursary / sponsor</SelectItem></SelectContent></Select></Field>
        <Field label="Student number (if you have one)"><Input value={form.student_number} onChange={(e)=>setForm({...form,student_number:e.target.value})}/></Field>
        <Field label="SA ID (use if you have no student number)"><Input inputMode="numeric" maxLength={13} value={form.identity_number} onChange={(e)=>setForm({...form,identity_number:e.target.value.replace(/\D/g,"").slice(0,13)})}/></Field>
        <Field label="Target institutions *" className="md:col-span-2"><Input value={form.target_institutions} onChange={(e)=>setForm({...form,target_institutions:e.target.value})} placeholder="e.g. TUT, UP, Tshwane South TVET College"/><p className="mt-1 text-[11px] text-muted-foreground">Separate multiple institutions with commas.</p></Field>
        <Field label="Qualifications / courses you want" className="md:col-span-2"><Textarea value={form.qualification_interests} onChange={(e)=>setForm({...form,qualification_interests:e.target.value})} placeholder="Tell your creator what you want to study."/></Field>
        <Field label="Anything the creator should know" className="md:col-span-2"><Textarea value={form.student_notes} onChange={(e)=>setForm({...form,student_notes:e.target.value})}/></Field>
        <div className="md:col-span-2 rounded-2xl border bg-muted/30 p-4"><div className="flex items-start gap-3"><Checkbox id="creator-consent" checked={consent} onCheckedChange={(value)=>setConsent(value===true)}/><Label htmlFor="creator-consent" className="text-sm leading-6">I authorize <strong>{creator.display_name}</strong> to view the application information and documents I upload to this assistance case so they can help me prepare and submit applications. I can revoke this access later.</Label></div><div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>This does not give the creator access to your entire ResKonnect account, accommodation portal data, passwords or unrelated private files.</div></div>
        <div className="md:col-span-2"><Button size="lg" className="w-full" disabled={!canCreate} onClick={()=>void createCase()}>Create secure assistance workspace</Button></div>
      </CardContent></Card> : <>
        <Card><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600"/><p className="font-black">Assistance case active</p><Badge variant="outline">{String(caseRow.status).replaceAll("_"," ")}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Target: {(caseRow.target_institutions||[]).join(", ") || "Not specified"}</p></div>{caseRow.consent_status === "granted" && <Button variant="outline" className="text-destructive" onClick={()=>void revoke()}>Revoke creator access</Button>}</CardContent></Card>
        {caseRow.consent_status === "granted" ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary"/>Application documents</CardTitle></CardHeader><CardContent><ApplicationDocumentUploader caseId={caseRow.id} applicantStage={caseRow.applicant_stage} onReadinessChange={setDocsReady}/>{caseRow.status === "documents_pending" && <Button className="mt-5 w-full" disabled={!docsReady} onClick={()=>void markReady()}>I have uploaded the required documents</Button>}</CardContent></Card> : <Card><CardContent className="p-8 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground"/><p className="mt-3 font-bold">Creator access revoked</p><p className="mt-1 text-sm text-muted-foreground">This case is closed and the creator can no longer read its application documents.</p></CardContent></Card>}
      </>}
    </div>
  </DashboardLayout>;
};

function Field({ label, children, className="" }: { label:string; children:React.ReactNode; className?:string }) { return <div className={`space-y-1.5 ${className}`}><Label>{label}</Label>{children}</div>; }

export default CreatorAssistanceIntake;
