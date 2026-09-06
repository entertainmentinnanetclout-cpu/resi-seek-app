import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clipboard, ExternalLink, MessageCircle, Phone, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AnyRow = Record<string, any>;

const projectRef = "mefjzkhobkltlbmhusdh";
const secretsUrl = `https://supabase.com/dashboard/project/${projectRef}/settings/functions`;
const whatsappWebhook = `https://${projectRef}.supabase.co/functions/v1/adminos-whatsapp-webhook`;
const voiceWebhook = `https://${projectRef}.supabase.co/functions/v1/adminos-voice-webhook`;
const twilioConsole = "https://console.twilio.com/";
const whatsappGuide = "https://www.twilio.com/docs/whatsapp/self-sign-up";
const numberGuide = "https://www.twilio.com/docs/numbers-and-senders";

export default function AdminOSTwilioSetup() {
  const [integrations, setIntegrations] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("adminos_integration_connections")
      .select("*")
      .in("provider", ["twilio_whatsapp", "twilio_voice"])
      .order("display_name");
    if (error) toast.error(error.message || "Could not load Twilio setup status");
    setIntegrations(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const whatsapp = integrations.find((row) => row.provider === "twilio_whatsapp") || {};
  const voice = integrations.find((row) => row.provider === "twilio_voice") || {};

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const test = async (kind: "whatsapp" | "voice") => {
    setWorking(kind);
    try {
      const functionName = kind === "whatsapp" ? "adminos-whatsapp" : "adminos-voice";
      const action = kind === "whatsapp" ? "test" : "test_provider";
      const { data, error } = await (supabase.functions as any).invoke(functionName, { body: { action } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(kind === "whatsapp" ? "Twilio WhatsApp verified and activated" : "Twilio Voice provider verified");
      await load();
    } catch (error: any) {
      toast.error(error?.message || `Twilio ${kind} test failed`);
      await load();
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Twilio paid-account setup</CardTitle>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Your paid Twilio account can now be connected to AdminOS. Finish WhatsApp Business and Programmable Voice in three controlled steps. Credential values stay in Supabase Edge Function secrets and are never displayed back in AdminOS.</p>
            </div>
            <div className="flex gap-2"><Badge variant="outline">Production onboarding</Badge><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <ChannelCard
              icon={MessageCircle}
              title="WhatsApp Business"
              status={whatsapp.status}
              step={whatsapp.setup_step}
              secretNames={["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM", "TWILIO_WHATSAPP_WEBHOOK_URL", "TWILIO_WHATSAPP_STATUS_CALLBACK_URL"]}
              webhook={whatsappWebhook}
              providerGuide={whatsappGuide}
              providerLabel="WhatsApp Self Sign-up"
              onCopy={copy}
              onTest={() => void test("whatsapp")}
              testing={working === "whatsapp"}
            />
            <ChannelCard
              icon={Phone}
              title="Programmable Voice"
              status={voice.status}
              step={voice.setup_step}
              secretNames={["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VOICE_FROM", "TWILIO_VOICE_WEBHOOK_URL"]}
              webhook={voiceWebhook}
              providerGuide={numberGuide}
              providerLabel="Phone number setup"
              onCopy={copy}
              onTest={() => void test("voice")}
              testing={working === "voice"}
            />
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <SetupStep number="1" title="Twilio account + senders" text="Register the ResKonnect WhatsApp sender through Twilio Self Sign-up. For calling, buy/provision a South African Voice-capable Twilio number and complete the required local regulatory registration." />
              <SetupStep number="2" title="Add Supabase secrets" text="Copy Account SID/Auth Token plus the approved WhatsApp sender and Voice number into Supabase Edge Function secrets. Also add the exact production webhook URLs shown above." />
              <SetupStep number="3" title="Test & activate" text="Return here and run Test provider. WhatsApp becomes connected after a successful provider test. Voice can be verified now but AI Voice remains standby until you explicitly enable it in Phase 10." />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm"><a href={twilioConsole} target="_blank" rel="noreferrer"><ExternalLink />Open Twilio Console</a></Button>
              <Button asChild variant="outline" size="sm"><a href={secretsUrl} target="_blank" rel="noreferrer"><ShieldCheck />Open Supabase secrets</a></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ChannelCard({ icon: Icon, title, status, step, secretNames, webhook, providerGuide, providerLabel, onCopy, onTest, testing }: {
  icon: any;
  title: string;
  status?: string;
  step?: number;
  secretNames: string[];
  webhook: string;
  providerGuide: string;
  providerLabel: string;
  onCopy: (value: string, label: string) => Promise<void>;
  onTest: () => void;
  testing: boolean;
}) {
  const connected = status === "connected";
  return (
    <Card className={connected ? "border-primary/30" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" />{title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Current setup step {step || 1}/3</p></div>
          <Badge variant={connected ? "default" : "outline"}>{String(status || "not connected").replaceAll("_", " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Server secret names</p>
          <div className="mt-2 flex flex-wrap gap-2">{secretNames.map((name) => <Badge key={name} variant="secondary" className="font-mono text-[11px]">{name}</Badge>)}</div>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs font-semibold">Production webhook</p>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{webhook}</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => void onCopy(webhook, `${title} webhook`)}><Clipboard />Copy webhook</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><a href={providerGuide} target="_blank" rel="noreferrer"><ExternalLink />{providerLabel}</a></Button>
          <Button size="sm" onClick={onTest} disabled={testing}>{testing ? <RefreshCw className="animate-spin" /> : connected ? <CheckCircle2 /> : <RefreshCw />}{connected ? "Re-test" : "Test provider"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SetupStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-xl border bg-background p-4"><Badge variant="outline">Step {number}</Badge><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div>;
}
