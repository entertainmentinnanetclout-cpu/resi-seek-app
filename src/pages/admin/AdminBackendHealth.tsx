import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, Database, Activity, AlertTriangle, Loader2 } from "lucide-react";
import { supabase, activeBackendProvider } from "@/backend";
import { EXTERNAL_SUPABASE_URL } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

type ProviderRow = {
  provider: string;
  status: string;
  last_checked_at: string;
  last_success_at: string | null;
  details: any;
};

type SyncStats = { pending: number; failed: number; sent: number; lastSent: string | null };

const pingPrimary = async () => {
  const start = performance.now();
  const { error } = await supabase.from("health_status").select("provider").limit(1);
  return { ok: !error, ms: Math.round(performance.now() - start), error: error?.message };
};

const pingExternal = async () => {
  const url = EXTERNAL_SUPABASE_URL;
  try {
    const start = performance.now();
    const res = await fetch(`${url}/auth/v1/health`, { method: "GET" });
    return { ok: res.ok, ms: Math.round(performance.now() - start), error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, ms: 0, error: e.message };
  }
};

export const AdminBackendHealthContent = () => {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [sync, setSync] = useState<SyncStats>({ pending: 0, failed: 0, sent: 0, lastSent: null });
  const [pings, setPings] = useState<{ primary?: any; external?: any }>({});
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [{ data: hs }, { data: pending }, { data: failed }, { data: lastSent }] = await Promise.all([
      supabase.from("health_status").select("provider,status,last_checked_at,last_success_at,details"),
      supabase.from("sync_queue").select("id", { count: "exact", head: false }).eq("status", "pending"),
      supabase.from("sync_queue").select("id", { count: "exact", head: false }).eq("status", "failed"),
      supabase.from("sync_queue").select("sent_at").eq("status", "sent").order("sent_at", { ascending: false }).limit(1),
    ]);
    setRows((hs as ProviderRow[]) || []);
    setSync({
      pending: pending?.length ?? 0,
      failed: failed?.length ?? 0,
      sent: 0,
      lastSent: (lastSent as any)?.[0]?.sent_at ?? null,
    });
    const [primary, external] = await Promise.all([pingPrimary(), pingExternal()]);
    setPings({ primary, external });
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const statusBadge = (ok?: boolean, label?: string) =>
    ok ? (
      <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/20 gap-1">
        <CheckCircle2 className="w-3 h-3" /> {label ?? "Healthy"}
      </Badge>
    ) : (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="w-3 h-3" /> {label ?? "Down"}
      </Badge>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" /> God Mode — Backend Health
          </h2>
          <p className="text-muted-foreground">
            Active provider: <Badge variant="outline">{activeBackendProvider}</Badge>
          </p>
        </div>
        <Button onClick={refresh} disabled={loading} variant="outline">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-5 h-5" /> Active App Client
              </CardTitle>
              {statusBadge(pings.primary?.ok)}
            </div>
            <CardDescription>UI data path — pinned to External Supabase</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <div>Latency: <span className="font-mono">{pings.primary?.ms ?? "—"} ms</span></div>
            {pings.primary?.error && (
              <div className="text-destructive flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5" />{pings.primary.error}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-5 h-5" /> External Supabase
              </CardTitle>
              {statusBadge(pings.external?.ok)}
            </div>
            <CardDescription>Primary source of truth</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <div>Latency: <span className="font-mono">{pings.external?.ms ?? "—"} ms</span></div>
            {pings.external?.error && (
              <div className="text-destructive flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5" />{pings.external.error}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Queue</CardTitle>
          <CardDescription>Legacy queue kept for audit only; External Supabase is the source of truth.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Pending</div>
            <div className="text-2xl font-bold">{sync.pending}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Failed</div>
            <div className="text-2xl font-bold text-destructive">{sync.failed}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Last sent</div>
            <div className="text-sm font-medium">
              {sync.lastSent ? formatDistanceToNow(new Date(sync.lastSent), { addSuffix: true }) : "Never"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provider Heartbeats</CardTitle>
          <CardDescription>Persisted health_status table</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No heartbeats recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.provider} className="flex items-center justify-between border rounded-md p-3 text-sm">
                  <div>
                    <div className="font-medium">{r.provider}</div>
                    <div className="text-xs text-muted-foreground">
                      Last checked {formatDistanceToNow(new Date(r.last_checked_at), { addSuffix: true })}
                    </div>
                  </div>
                  {statusBadge(r.status === "healthy", r.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const AdminBackendHealth = () => <AdminBackendHealthContent />;
export default AdminBackendHealth;