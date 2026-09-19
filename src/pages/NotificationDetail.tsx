import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bell, CalendarClock, FileText, ShieldCheck } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { safeShortDate } from "@/lib/safeDates";

type Notice = { id: string; title: string | null; message: string | null; type: string | null; metadata: unknown; created_at: string | null; is_read: boolean | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function actionPath(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  if (typeof m.application_id === "string" && uuid.test(m.application_id)) return "/my-applications";
  if (m.kind === "profile" || m.action === "complete_profile") return "/profile";
  if (m.kind === "accommodation") return "/findmyres";
  if (m.kind === "service") return "/dashboard/services";
  const path = m.action_url ?? m.url;
  const allow = new Set(["/dashboard", "/profile", "/findmyres", "/my-applications", "/dashboard/services", "/documents", "/wil", "/opportunities"]);
  return typeof path === "string" && allow.has(path) ? path : null;
}
export default function NotificationDetail() {
  const [params] = useSearchParams();
  const id = params.get("id");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    if (!user?.id || !id || !uuid.test(id)) { setLoading(false); setError(true); return; }
    setLoading(true); setError(false);
    (async () => {
      const { data, error: readError } = await supabase.from("notifications")
        .select("id,title,message,type,metadata,created_at,is_read")
        .eq("id", id).eq("user_id", user.id).maybeSingle();
      if (!active) return;
      if (readError || !data) { setError(true); setLoading(false); return; }
      setNotice(data as Notice); setLoading(false);
      if (!data.is_read) {
        const { error: markError } = await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", user.id);
        if (!markError && active) setNotice(previous => previous ? { ...previous, is_read: true } : null);
      }
    })().catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [id, user?.id]);
  const path = actionPath(notice?.metadata);
  return <DashboardLayout><main className="mx-auto max-w-3xl space-y-5 px-4 py-6 pb-24 sm:px-7 sm:py-10">
    <Button variant="ghost" className="-ml-3 rounded-full" onClick={() => navigate("/dashboard/updates")}><ArrowLeft className="mr-2 h-4 w-4" />All notifications</Button>
    {loading ? <div role="status" className="rounded-3xl border bg-card p-8 text-sm text-muted-foreground">Loading your message…</div>
    : error || !notice ? <Card><CardContent className="space-y-3 p-7"><h1 className="text-xl font-bold">Notification unavailable</h1><p className="text-sm text-muted-foreground">This message may have been removed, or it does not belong to this account.</p><Button asChild><Link to="/dashboard/updates">Back to notifications</Link></Button></CardContent></Card>
    : <article className="overflow-hidden rounded-[28px] border border-primary/15 bg-card shadow-lg shadow-primary/5">
      <div className="flex items-center gap-3 bg-gradient-to-r from-sky-500/10 via-violet-500/10 to-emerald-500/10 p-6 sm:p-8"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><Bell className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-[.16em] text-primary">ResKonnect account update</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />For your account only</p></div></div>
      <div className="space-y-5 p-6 sm:p-8"><p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="h-4 w-4" />{notice.created_at ? safeShortDate(notice.created_at) : "Recent update"}</p><h1 className="text-2xl font-black leading-tight sm:text-3xl">{notice.title || "Your ResKonnect update"}</h1><div className="whitespace-pre-wrap break-words text-base leading-7 text-foreground/85">{notice.message || "Open your account to see the latest update."}</div>
      {path && <Button onClick={() => navigate(path)} className="rounded-full"><FileText className="mr-2 h-4 w-4" />Open related section</Button>}</div>
    </article>}
  </main></DashboardLayout>;
}
