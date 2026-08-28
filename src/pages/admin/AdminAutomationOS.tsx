import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlarmClock, CheckCircle2, Clock3, RefreshCw, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AutomationTask = {
  id: string;
  task_type: string;
  source_type: string;
  source_id: string;
  user_id?: string | null;
  residence_id?: string | null;
  owner_scope: string;
  status: string;
  priority: string;
  due_at?: string | null;
  summary: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
};

const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());

export default function AdminAutomationOS() {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [scope, setScope] = useState("all");
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from("conversion_automation_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(500);
    if (status !== "all") query = query.eq("status", status);
    if (scope !== "all") query = query.eq("owner_scope", scope);
    const { data, error } = await query;
    setLoading(false);
    if (error) return toast.error(error.message || "Could not load automation queue");
    setTasks(data || []);
  }, [scope, status]);

  useEffect(() => { void load(); }, [load]);

  const now = Date.now();
  const metrics = useMemo(() => {
    const pending = tasks.filter((t) => t.status === "pending");
    const overdue = pending.filter((t) => t.due_at && new Date(t.due_at).getTime() < now);
    const high = pending.filter((t) => ["high", "urgent"].includes(t.priority));
    const automated = pending.filter((t) => ["application_follow_up", "reservation_follow_up", "creator_case_next_action", "listing_quality"].includes(t.task_type));
    return { pending: pending.length, overdue: overdue.length, high: high.length, automated: automated.length };
  }, [tasks, now]);

  const updateTask = async (task: AutomationTask, patch: Record<string, unknown>, success: string) => {
    const { error } = await (supabase as any).from("conversion_automation_tasks").update(patch).eq("id", task.id);
    if (error) return toast.error(error.message || "Could not update automation task");
    toast.success(success);
    void load();
  };

  const complete = (task: AutomationTask) => void updateTask(task, { status: "completed", completed_at: new Date().toISOString() }, "Exception marked complete");
  const snooze = (task: AutomationTask) => void updateTask(task, { due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), status: "pending" }, "Follow-up moved by 24 hours");

  return (
    <AdminLayout>
      <SEO noIndex title="Automation OS | ResKonnect" description="ResKonnect conversion automation and exception command centre." />
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-[#071326] p-6 text-white shadow-2xl md:p-9">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#2563EB]/30 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2"><Badge className="bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]"><Zap className="mr-1 h-3 w-3" />AUTOMATION OS</Badge><Badge variant="outline" className="border-white/25 text-white">90/10 operating model</Badge></div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Conversion Exception Command Centre</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">Applications, reservations, creator assistance and residence quality create their own next-action tasks. Humans work only overdue, high-risk or verification exceptions while normal workflow state changes complete tasks automatically.</p>
            </div>
            <div className="flex flex-wrap gap-2"><Select value={scope} onValueChange={setScope}><SelectTrigger className="w-44 border-white/20 bg-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All owner scopes</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="residence">Residence</SelectItem><SelectItem value="creator">Creator</SelectItem></SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40 border-white/20 bg-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="all">All statuses</SelectItem></SelectContent></Select><Button variant="hero" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button></div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Activity} label="Tasks in view" value={tasks.length} />
          <Metric icon={AlarmClock} label="Overdue exceptions" value={metrics.overdue} danger={metrics.overdue > 0} />
          <Metric icon={Target} label="High priority" value={metrics.high} danger={metrics.high > 0} />
          <Metric icon={Sparkles} label="Auto-generated next actions" value={metrics.automated} />
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20"><div className="flex items-center justify-between gap-3"><div><CardTitle>Human 10% queue</CardTitle><p className="mt-1 text-sm text-muted-foreground">Only exceptions requiring a real person should stay pending here.</p></div><Badge variant="outline" className="shrink-0"><ShieldCheck className="mr-1 h-3 w-3" />Synced from live workflows</Badge></div></CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="p-12 text-center text-sm text-muted-foreground">Loading automation queue…</div> : tasks.length === 0 ? <div className="p-12 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><p className="mt-3 font-black">No matching exceptions</p><p className="mt-1 text-sm text-muted-foreground">The automated workflow has nothing requiring human action in this view.</p></div> : <div className="divide-y">{tasks.map((task) => {
              const overdue = task.status === "pending" && task.due_at && new Date(task.due_at).getTime() < Date.now();
              return <div key={task.id} className="grid gap-3 p-4 lg:grid-cols-[1fr,180px,190px,auto] lg:items-center">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant={task.priority === "high" || task.priority === "urgent" ? "destructive" : "outline"}>{task.priority.toUpperCase()}</Badge><Badge variant="secondary">{pretty(task.owner_scope)}</Badge><span className="text-xs font-semibold text-muted-foreground">{pretty(task.source_type)}</span></div><p className="mt-2 font-black">{task.summary}</p><p className="mt-1 text-xs text-muted-foreground">{pretty(task.task_type)} · source {task.source_id.slice(0, 8)}</p></div>
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Due</p><p className={`mt-1 text-sm font-bold ${overdue ? "text-destructive" : ""}`}>{task.due_at ? new Date(task.due_at).toLocaleString("en-ZA") : "No deadline"}</p></div>
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Automation state</p><div className="mt-1 flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><span className="text-sm font-bold capitalize">{task.status}</span></div></div>
                <div className="flex flex-wrap gap-2 lg:justify-end">{task.status === "pending" && <><Button size="sm" variant="outline" onClick={() => snooze(task)}>Snooze 24h</Button><Button size="sm" onClick={() => complete(task)}>Mark done</Button></>}</div>
              </div>;
            })}</div>}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Metric({ icon: Icon, label, value, danger = false }: { icon: any; label: string; value: number; danger?: boolean }) {
  return <Card><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className={`text-3xl font-black ${danger ? "text-destructive" : ""}`}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div><div className={`rounded-xl p-2.5 ${danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}><Icon className="h-5 w-5" /></div></CardContent></Card>;
}
