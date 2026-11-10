import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, Database, Activity, AlertTriangle, Loader2 } from "lucide-react";
import { supabase, activeBackendProvider } from "@/backend";
import { EXTERNAL_SUPABASE_URL } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

type ProviderRow = {
  id: string;
  check_type: string;
  status: string;
  checked_at: string;
  latency_ms: number | null;
};

type JobRow = { id: string; status: string; completed_at: string | null };
type JobStats = { pending: number; failed: number; completed: number; lastCompleted: string | null; sampled: number };

const pingPrimary = async () => {
  const start = performance.now();
  // The published, RLS-invoker aggregate exists in the production Data API.
  // Do not query the retired health_status relation.
  const { error } = await (supabase as any).from("reskonnect_city_coverage_v").select("city_key").limit(1);
  return { ok: !error, ms: Math.round(performance.now() - start), error: error?.message };
};

const pingAuth = async () => {
  try {
    const start = performance.now();
    const res = await fetch(`${EXTERNAL_SUPABASE_URL}/auth/v1/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    return { ok: res.ok, ms: Math.round(performance.now() - start), error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, ms: 0, error: error instanceof Error ? error.message : "Network error" };
  }
};

export const AdminBackendHealthContent = () => {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [jobs, setJobs] = useState<JobStats | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pings, setPings] = useState<{ primary?: any; auth?: any }>({});
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const failures: string[] = [];
    try {
      const [health, queue] = await Promise.all([
        (supabase as any).from("adminos_integration_health")
          .select("id,check_type,status,checked_at,latency_ms")
          .order("checked_at", { ascending: false }).limit(25),
        (supabase as any).from("adminos_automation_jobs")
          .select("id,status,completed_at")
          .order("created_at", { ascending: false }).limit(50),
      ]);
      if (health.error) failures.push("Integration health unavailable: " + health.error.message);
      else setRows((health.data || []) as ProviderRow[]);
      if (queue.error) {
        failures.push("Automation jobs unavailable: " + queue.error.message);
        setJobs(null);
      } else {
        const sample: JobRow[] = queue.data || [];
        setJobs({
          sampled: sample.length,
          pending: sample.filter(j => ["pending", "queued", "retry", "waiting"].includes(j.status)).length,
          failed: sample.filter(j => ["failed", "dead_letter", "error"].includes(j.status)).length,
          completed: sample.filter(j => ["completed", "succeeded", "sent"].includes(j.status)).length,
          lastCompleted: sample.map(j => j.completed_at).filter((d): d is string => Boolean(d))
            .sort().reverse()[0] || null,
        });
      }
      const [primary, auth] = await Promise.all([pingPrimary(), pingAuth()]);
      setPings({ primary, auth });
      if (!primary.ok) failures.push("Data API probe failed: " + (primary.error || "Unknown error"));
      if (!auth.ok) failures.push("Auth process probe failed: " + (auth.error || "Unknown error"));
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Backend health checks could not complete");
    } finally {
      setErrors(failures);
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const statusBadge = (ok?: boolean, label?: string) =>
    ok === undefined ? <Badge variant="outline">Not checked</Badge>
    : ok ? (
      <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/20 gap-1">
        <CheckCircle2 className="w-3 h-3" /> {label ?? "Healthy"}
      </Badge>
    ) : (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="w-3 h-3" /> {label ?? "Unavailable"}
      </Badge>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" /> Backend health
          </h2>
          <p className="text-muted-foreground">Production source: <Badge variant="outline">{activeBackendProvider}</Badge></p>
        </div>
        <Button onClick={() => void refresh()} disabled={loading} variant="outline">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>
      {!!errors.length && <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm text-amber-800 dark:text-amber-200">
        <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4"/>Live checks require attention</div>
        <p className="mt-1">{errors.join(" · ")}</p>
      </div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Database className="h-5 w-5"/>Data API</CardTitle>{statusBadge(pings.primary?.ok)}</div>
            <CardDescription>Production public inventory query; not a credentialed student-login test</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>Latency: <span className="font-mono">{pings.primary?.ms ?? "—"} ms</span></p>
            {pings.primary?.error && <p className="text-destructive">{pings.primary.error}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Database className="h-5 w-5"/>Supabase Auth service</CardTitle>{statusBadge(pings.auth?.ok)}</div>
            <CardDescription>Auth process health; real Google/email login must be tested separately</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>Latency: <span className="font-mono">{pings.auth?.ms ?? "—"} ms</span></p>
            {pings.auth?.error && <p className="text-destructive">{pings.auth.error}</p>}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent automation jobs</CardTitle>
          <CardDescription>Actual last 50 authorized jobs, not a legacy synchronization queue or a complete backlog total</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div><div className="text-xs text-muted-foreground">Pending (sample)</div><div className="text-2xl font-bold">{jobs ? jobs.pending : "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Failed (sample)</div><div className="text-2xl font-bold text-destructive">{jobs ? jobs.failed : "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Last completed</div><div className="text-sm font-medium">{jobs?.lastCompleted ? formatDistanceToNow(new Date(jobs.lastCompleted), { addSuffix: true }) : "Not available"}</div></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent integration health records</CardTitle>
          <CardDescription>Latest checks recorded by AdminOS; no unverified synthetic heartbeats</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{errors.length ? "Unable to confirm live integration health." : "No integration checks recorded yet."}</p>
          ) : (
            <div className="space-y-2">{rows.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{r.check_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.checked_at ? formatDistanceToNow(new Date(r.checked_at), { addSuffix: true }) : "Date unavailable"}
                    {r.latency_ms !== null ? ` · ${r.latency_ms} ms` : ""}
                  </p>
                </div>
                {statusBadge(["healthy", "ok", "passed", "success"].includes(r.status?.toLowerCase()), r.status)}
              </div>
            ))}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const AdminBackendHealth = () => <AdminBackendHealthContent />;
export default AdminBackendHealth;
