import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Integration = {
  status?: string;
  enabled?: boolean;
  setup_step?: number;
  external_account_label?: string | null;
  last_tested_at?: string | null;
  last_success_at?: string | null;
  last_error?: string | null;
};

type Health = {
  ok?: boolean;
  openai_configured?: boolean;
  openai_verified?: boolean;
  primary?: string | null;
  model?: string | null;
  error?: string | null;
};

export default function AdminOSOpenAIStatus() {
  const [integration, setIntegration] = useState<Integration>({});
  const [health, setHealth] = useState<Health>({});
  const [busy, setBusy] = useState(false);

  const readIntegration = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("adminos_integration_connections")
      .select("status,enabled,setup_step,external_account_label,last_tested_at,last_success_at,last_error")
      .eq("provider", "openai")
      .maybeSingle();
    if (error) throw error;
    setIntegration(data || {});
    return data || {};
  }, []);

  const syncHealth = useCallback(async () => {
    const { data, error } = await (supabase.functions as any).invoke("adminos-agent", { body: { action: "health" } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    setHealth(data || {});
    await readIntegration();
    return data;
  }, [readIntegration]);

  useEffect(() => {
    void (async () => {
      try {
        await syncHealth();
      } catch {
        try { await readIntegration(); } catch { /* surfaced by existing AdminOS health views */ }
      }
    })();
  }, [readIntegration, syncHealth]);

  const testAndActivate = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.functions as any).invoke("adminos-agent", { body: { action: "test" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setHealth(data || {});
      await readIntegration();
      toast.success(`OpenAI activated${data?.model ? ` · ${data.model}` : ""}`);
    } catch (error: any) {
      await readIntegration().catch(() => undefined);
      toast.error(error?.message || "OpenAI test failed");
    } finally {
      setBusy(false);
    }
  };

  const connected = integration.status === "connected" && integration.enabled === true;
  const configured = health.openai_configured === true;

  return (
    <Card className={connected ? "border-primary/30" : "border-amber-500/30"}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-muted p-2">
            {connected ? <CheckCircle2 className="h-5 w-5 text-primary" /> : configured ? <KeyRound className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold">OpenAI · Konnect Agent</p>
              <Badge variant={connected ? "default" : "outline"}>{connected ? "Connected" : configured ? "Key detected · test required" : "Setup required"}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {connected
                ? `${integration.external_account_label || "OpenAI API"} is verified and active.`
                : integration.last_error || (configured ? "The server can see OPENAI_API_KEY. Run the provider test to verify API access and activate it." : "OPENAI_API_KEY has not been detected by the active Edge Function runtime.")}
            </p>
            {integration.last_tested_at && <p className="mt-1 text-xs text-muted-foreground">Last tested {new Date(integration.last_tested_at).toLocaleString("en-ZA")}</p>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => void syncHealth()} disabled={busy}><RefreshCw className="h-4 w-4" />Refresh</Button>
          <Button size="sm" onClick={() => void testAndActivate()} disabled={busy}>{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}{connected ? "Re-test OpenAI" : "Test & Activate"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
