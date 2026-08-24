import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileText, Loader2, Mail, MessageSquare, Phone, Send, User, XCircle } from "lucide-react";
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

interface ApplicantProfile {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  student_number: string | null;
  campus: string | null;
  course: string | null;
}

interface ApplicationRow {
  id: string;
  user_id: string;
  residence_id: string;
  status: string;
  funding_type: string | null;
  created_at: string | null;
  updated_at: string | null;
  notes: string | null;
  application_date: string | null;
  move_in_date: string | null;
  moved_in: boolean | null;
  institution_type: string | null;
  profile: ApplicantProfile | null;
}

interface MessageRow {
  id: string;
  sender_type: string;
  sender_user_id: string | null;
  message: string;
  created_at: string | null;
}

interface ActivityRow {
  id: string;
  action_type: string;
  actor_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface DocumentRow {
  id: string;
  doc_type: string;
  original_filename: string | null;
  status: string;
  rejection_reason: string | null;
  uploaded_at: string;
}

const STATUS_OPTIONS = [
  { value: "documents_required", label: "Request documents", icon: FileText },
  { value: "under_review", label: "Mark under review", icon: Clock3 },
  { value: "conditionally_approved", label: "Conditionally approve", icon: CheckCircle2 },
  { value: "approved", label: "Approve", icon: CheckCircle2 },
  { value: "rejected", label: "Reject", icon: XCircle },
] as const;

const MESSAGE_TEMPLATES = [
  { label: "Request documents", text: "Thank you for your application. We need additional documents before we can continue reviewing it. Please upload the requested documents in ResKonnect, then check your application again." },
  { label: "Under review", text: "Your accommodation application is now under review. We will update you as soon as a decision is available." },
  { label: "Conditional approval", text: "Your application has been conditionally approved. Please review the remaining requirements in ResKonnect and complete them as soon as possible." },
] as const;

const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  if (status === "withdrawn") return "outline";
  return "secondary";
};

const ResidenceApplicationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { residence } = useOutletContext<ResidencePortalContext>();
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = useCallback(async () => {
    if (!id || !residence?.id) return;
    setLoading(true);
    setError(null);

    try {
      const { data: appData, error: appError } = await supabase
        .from("applications")
        .select("id, user_id, residence_id, status, funding_type, created_at, updated_at, notes, application_date, move_in_date, moved_in, institution_type")
        .eq("id", id)
        .eq("residence_id", residence.id)
        .single();
      if (appError) throw appError;

      let profile: ApplicantProfile | null = null;
      if (appData.user_id) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, email, phone, student_number, campus, course")
          .eq("id", appData.user_id)
          .single();
        if (profileError) throw profileError;
        profile = profileData;
      }

      const [{ data: messageData }, { data: activityData }, { data: documentData }] = await Promise.all([
        supabase.from("application_messages").select("id, sender_type, sender_user_id, message, created_at").eq("application_id", id).eq("residence_id", residence.id).order("created_at", { ascending: true }),
        supabase.from("application_activity_log").select("id, action_type, actor_type, metadata, created_at").eq("application_id", id).eq("residence_id", residence.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("application_documents").select("id, doc_type, original_filename, status, rejection_reason, uploaded_at").eq("application_id", id).eq("residence_id", residence.id).order("uploaded_at", { ascending: false }),
      ]);

      setApplication({ ...appData, user_id: appData.user_id as string, profile } as ApplicationRow);
      setMessages((messageData || []) as MessageRow[]);
      setActivity((activityData || []) as ActivityRow[]);
      setDocuments((documentData || []) as DocumentRow[]);
    } catch (err) {
      console.error("Residence application detail failed:", err);
      setError("This application could not be loaded. It may not belong to your residence, or the data is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [id, residence?.id]);

  useEffect(() => {
    if (!id || !residence?.id) return;
    void load();

    const channel = supabase
      .channel(`residence-application-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "application_messages", filter: `application_id=eq.${id}` }, (payload) => {
        const next = payload.new as MessageRow;
        setMessages((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "applications", filter: `id=eq.${id}` }, () => void load())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [id, residence?.id, load]);

  useEffect(() => {
    if (!id || !residence?.id || !application) return;
    const logView = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("application_activity_log").insert({ application_id: id, residence_id: residence.id, actor_user_id: user.id, actor_type: "residence", action_type: "viewed", metadata: {} });
    };
    void logView();
  }, [id, residence?.id, application?.id]);

  const sendMessage = async () => {
    const body = message.trim();
    if (!body || !application || !residence) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired");

      const { error: sendError } = await supabase.from("application_messages").insert({ application_id: application.id, residence_id: residence.id, sender_type: "residence", sender_user_id: user.id, message: body });
      if (sendError) throw sendError;

      await supabase.from("notifications").insert({
        user_id: application.user_id,
        type: "application_message",
        title: `Message from ${residence.name}`,
        message: body.length > 180 ? `${body.slice(0, 177)}...` : body,
        metadata: { application_id: application.id, residence_id: residence.id },
      });

      setMessage("");
      toast.success("Message sent to applicant.");
    } catch (err) {
      console.error("Residence application message failed:", err);
      toast.error("Message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async () => {
    if (!selectedStatus || !application || !residence) return;
    setUpdatingStatus(true);
    try {
      const label = getResidenceApplicationStatusLabel(selectedStatus);
      const timestamp = new Date().toLocaleString("en-ZA");
      const note = statusNote.trim();
      const notes = note ? `${application.notes ? `${application.notes}\n` : ""}[${timestamp}] ${label}: ${note}` : application.notes;

      const { error: updateError } = await supabase
        .from("applications")
        .update({ status: selectedStatus, ...(note ? { notes } : {}) })
        .eq("id", application.id)
        .eq("residence_id", residence.id);
      if (updateError) throw updateError;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("application_activity_log").insert({
          application_id: application.id,
          residence_id: residence.id,
          actor_user_id: user.id,
          actor_type: "residence",
          action_type: "status_updated",
          metadata: { previous_status: application.status, new_status: selectedStatus, note: note || null },
        });
      }

      await supabase.from("notifications").insert({
        user_id: application.user_id,
        type: "application_status",
        title: `${residence.name}: ${label}`,
        message: note ? `Your accommodation application is now ${label.toLowerCase()}. ${note}` : `Your accommodation application is now ${label.toLowerCase()}.`,
        metadata: { application_id: application.id, residence_id: residence.id, status: selectedStatus },
      });

      toast.success(`Application updated to ${label}.`);
      setStatusDialog(false);
      setSelectedStatus("");
      setStatusNote("");
      await load();
    } catch (err) {
      console.error("Residence status update failed:", err);
      toast.error("Application status could not be updated.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (!residence) return <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">Loading your residence...</div>;
  if (loading) return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  if (error || !application) {
    return (
      <Card className="mx-auto max-w-xl"><CardContent className="p-8 text-center"><p className="font-semibold">Application unavailable</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{error || "The application could not be found."}</p><div className="mt-5 flex justify-center gap-2"><Button variant="outline" onClick={() => navigate("/residence/inbox")}>Back to applications</Button><Button onClick={() => void load()}>Try again</Button></div></CardContent></Card>
    );
  }

  const profile = application.profile;
  const appliedAt = application.application_date || application.created_at;

  return (
    <>
      <SEO noIndex title={`Application ${getResidenceApplicationRef(application.id)} | ${residence.name} | ResKonnect`} description="Review a residence application." />
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate("/residence/inbox")} aria-label="Back to applications"><ArrowLeft className="h-4 w-4" /></Button>
            <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{profile?.full_name || "Applicant"}</h1><Badge variant={statusBadgeVariant(application.status)}>{getResidenceApplicationStatusLabel(application.status)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Ref {getResidenceApplicationRef(application.id)} · {appliedAt ? `Applied ${new Date(appliedAt).toLocaleDateString("en-ZA")}` : "Application date unavailable"}</p></div>
          </div>
          <Button onClick={() => setStatusDialog(true)}>Update application status</Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Applicant details</CardTitle><CardDescription>Information supplied through the applicant's ResKonnect profile.</CardDescription></CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full name</p><p className="mt-1 font-semibold">{profile?.full_name || "Not provided"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student number</p><p className="mt-1 font-semibold">{profile?.student_number || "Not provided"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campus</p><p className="mt-1 font-semibold">{profile?.campus || "Not provided"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Course</p><p className="mt-1 font-semibold">{profile?.course || "Not provided"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Funding</p><p className="mt-1 font-semibold uppercase">{application.funding_type || "Not specified"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Institution type</p><p className="mt-1 font-semibold capitalize">{application.institution_type || "Not specified"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Move-in date</p><p className="mt-1 font-semibold">{application.move_in_date ? new Date(`${application.move_in_date}T00:00:00`).toLocaleDateString("en-ZA") : "Not specified"}</p></div>
                <div className="sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p><div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">{profile?.email && <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline"><Mail className="h-3.5 w-3.5" />{profile.email}</a>}{profile?.phone && <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-1.5 text-primary hover:underline"><Phone className="h-3.5 w-3.5" />{profile.phone}</a>}{!profile?.email && !profile?.phone && <span className="text-muted-foreground">No contact details provided</span>}</div></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Applicant messages</CardTitle><CardDescription>Keep application communication inside ResKonnect.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-xl border bg-muted/20 p-3">
                  {messages.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">No messages yet. Send the applicant an update below.</div> : messages.map((item) => (
                    <div key={item.id} className={`flex ${item.sender_type === "residence" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.sender_type === "residence" ? "bg-primary text-primary-foreground" : "bg-card border"}`}><p className="whitespace-pre-wrap">{item.message}</p><p className={`mt-1 text-[10px] ${item.sender_type === "residence" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{item.created_at ? new Date(item.created_at).toLocaleString("en-ZA") : ""}</p></div></div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">{MESSAGE_TEMPLATES.map((template) => <Button key={template.label} size="sm" variant="outline" onClick={() => setMessage(template.text)}>{template.label}</Button>)}</div>
                <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write a message to the applicant..." />
                <div className="flex justify-end"><Button onClick={sendMessage} disabled={sending || !message.trim()}>{sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send message</Button></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Application documents</CardTitle><CardDescription>Documents explicitly shared with this residence application.</CardDescription></CardHeader>
              <CardContent>{documents.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No application-specific documents have been shared yet.</div> : <div className="divide-y">{documents.map((doc) => <div key={doc.id} className="flex items-start justify-between gap-4 py-3"><div><p className="font-semibold">{doc.original_filename || doc.doc_type.replace(/_/g, " ")}</p><p className="mt-1 text-xs text-muted-foreground">{doc.doc_type.replace(/_/g, " ")} · uploaded {new Date(doc.uploaded_at).toLocaleDateString("en-ZA")}</p>{doc.rejection_reason && <p className="mt-1 text-xs text-destructive">{doc.rejection_reason}</p>}</div><Badge variant={doc.status === "verified" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"}>{doc.status}</Badge></div>)}</div>}</CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="xl:sticky xl:top-24">
              <CardHeader><CardTitle>Application actions</CardTitle><CardDescription>Update the application without leaving this page.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {STATUS_OPTIONS.map((option) => <Button key={option.value} variant={application.status === option.value ? "default" : "outline"} className="w-full justify-start" onClick={() => { setSelectedStatus(option.value); setStatusDialog(true); }}><option.icon className="mr-2 h-4 w-4" />{option.label}</Button>)}
                {application.notes && <div className="mt-4 rounded-xl bg-muted/50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal application notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{application.notes}</p></div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Activity</CardTitle></CardHeader>
              <CardContent>{activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : <div className="space-y-3">{activity.slice(0, 10).map((entry) => <div key={entry.id} className="border-l-2 border-primary/20 pl-3"><p className="text-sm font-semibold">{entry.action_type.replace(/_/g, " ")}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString("en-ZA")} · {entry.actor_type}</p></div>)}</div>}</CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={statusDialog} onOpenChange={setStatusDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update application status</DialogTitle><DialogDescription>The applicant will receive a ResKonnect notification after the status is saved.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Status</Label><Select value={selectedStatus} onValueChange={setSelectedStatus}><SelectTrigger><SelectValue placeholder="Choose a status" /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Optional note</Label><Textarea rows={4} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Add a clear note for the application record and applicant..." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setStatusDialog(false)}>Cancel</Button><Button onClick={updateStatus} disabled={!selectedStatus || updatingStatus}>{updatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save status</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ResidenceApplicationDetail;
