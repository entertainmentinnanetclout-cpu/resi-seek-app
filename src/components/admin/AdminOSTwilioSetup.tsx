import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clipboard, ExternalLink, MessageCircle, Phone, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
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
  const [templates, setTemplates] = useState<AnyRow[]>([]);
  const [bootstrapHealth, setBootstrapHealth] = useState<AnyRow>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [integrationRes, templateRes] = await Promise.all([
      (supabase as any).from("adminos_integration_connections").select("*").in("provider", ["twilio_whatsapp", "twilio_voice"]).order("display_name"),
      (supabase as any).from("adminos_whatsapp_templates").select("*").order("created_at", { ascending: true }),
    ]);
    if (integrationRes.error) toast.error(integrationRes.error.message || "Could not load Twilio setup status");
    if (templateRes.error) toast.error(templateRes.error.message || "Could not load WhatsApp templates");
    setIntegrations(integrationRes.data || []);
    setTemplates(templateRes.data || []);
    try {
      const { data } = await (supabase.functions as any).invoke("adminos-twilio-bootstrap", { body: { action: "health" } });
      setBootstrapHealth(data || {});
    } catch {
      setBootstrapHealth({});
    }
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

  const invoke = async (key: string, functionName: string, action: string, success: string) => {
    setWorking(key);
    try {
      const { data, error } = await (supabase.functions as any).invoke(functionName, { body: { action } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(success);
      await load();
      return data;
    } catch (error: any) {
      toast.error(error?.message || "Provider action failed");
      await load();
      return null;
    } finally {
      setWorking(null);
    }
  };

  const test = (kind: "whatsapp" | "voice") => invoke(
    `test:${kind}`,
    kind === "whatsapp" ? "adminos-whatsapp" : "adminos-voice",
    kind === "whatsapp" ? "test" : "test_provider",
    kind === "whatsapp" ? "Twilio WhatsApp verified and activated" : "Twilio Voice provider verified",
  );

  const finishWhatsApp = () => invoke(
    "finish-whatsapp",
    "adminos-twilio-bootstrap",
    "finish_whatsapp",
    "WhatsApp sender, webhooks and templates have been submitted automatically",
  );

  const syncTemplates = () => invoke(
    "sync-templates",
    "adminos-twilio-bootstrap",
    "sync_templates",
    "WhatsApp template approval statuses synced",
  );

  const credentialsReady = Boolean(bootstrapHealth.credentials_ready);
  const approvedTemplates = templates.filter((row) => row.status === "approved").length;

  return (
    <div className="space-y-5">
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Twilio production setup</CardTitle>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">The verified WhatsApp sender can now be finished from AdminOS. Only the Twilio credentials and selected sender number must be placed in Supabase secrets manually; AdminOS can configure the sender webhook, create the Content API templates, submit them to WhatsApp and sync approval status.</p>
            </div>
            <div className="flex gap-2"><Badge variant={credentialsReady ? "default" : "outline"}>{credentialsReady ? "Credentials detected" : "Credentials required"}</Badge><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold">Minimal manual handoff</p>
                <p className="mt-1 text-sm text-muted-foreground">Add these three values once in Supabase Edge Function secrets. Do not place the Auth Token in chat or GitHub.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"].map((name) => <Badge key={name} variant="secondary" className="font-mono text-[11px]">{name}</Badge>)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline"><a href={secretsUrl} target="_blank" rel="noreferrer"><ShieldCheck />Open Supabase secrets</a></Button>
                <Button onClick={() => void finishWhatsApp()} disabled={working === "finish-whatsapp" || !credentialsReady}>
                  {working === "finish-whatsapp" ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                  Finish WhatsApp automatically
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChannelCard
              icon={MessageCircle}
              title="WhatsApp Business"
              status={whatsapp.status}
              step={whatsapp.setup_step}
              detail={whatsapp.config?.sender_id || whatsapp.external_account_label || "Verified sender waiting for final API bootstrap"}
              secretNames={["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"]}
              webhook={whatsappWebhook}
              providerGuide={whatsappGuide}
              providerLabel="WhatsApp sender"
              onCopy={copy}
              onTest={() => void test("whatsapp")}
              testing={working === "test:whatsapp"}
            />
            <ChannelCard
              icon={Phone}
              title="Programmable Voice"
              status={voice.status}
              step={voice.setup_step}
              detail={voice.external_account_label || "Voice remains separate and on standby"}
              secretNames={["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VOICE_FROM"]}
              webhook={voiceWebhook}
              providerGuide={numberGuide}
              providerLabel="Phone number setup"
              onCopy={copy}
              onTest={() => void test("voice")}
              testing={working === "test:voice"}
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><CardTitle className="text-base">WhatsApp Content API templates</CardTitle><p className="mt-1 text-sm text-muted-foreground">{approvedTemplates}/{templates.length} approved. AdminOS submits utility templates to Meta through Twilio Content API.</p></div>
                <Button variant="outline" size="sm" onClick={() => void syncTemplates()} disabled={working === "sync-templates" || !credentialsReady}>{working === "sync-templates" ? <RefreshCw className="animate-spin" /> : <RefreshCw />}Sync approvals</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {templates.map((template) => (
                  <div key={template.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-semibold">{template.display_name}</p><p className="mt-1 text-xs text-muted-foreground">{template.template_key}{template.content_sid ? ` · ${template.content_sid}` : " · not submitted yet"}</p></div>
                    <Badge variant={template.status === "approved" ? "default" : template.status === "rejected" || template.status === "provider_error" ? "destructive" : "outline"}>{String(template.status || "unknown").replaceAll("_", " ")}</Badge>
                  </div>
                ))}
                {templates.length === 0 && <div className="p-6 text-sm text-muted-foreground">No WhatsApp templates are configured.</div>}
              </div>
            </CardContent>
          </Card>

          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <SetupStep number="1" title="You: add credentials" text="Copy Account SID and Auth Token from Twilio into Supabase secrets, plus the verified WhatsApp number as TWILIO_WHATSAPP_FROM. This is the only WhatsApp credential handoff that cannot be read back automatically." />
              <SetupStep number="2" title="AdminOS: finish provider" text="Finish WhatsApp automatically discovers the registered Twilio sender, configures inbound/status webhooks, verifies its state and updates the AdminOS integration registry." />
              <SetupStep number="3" title="AdminOS + Meta" text="AdminOS creates the ResKonnect utility templates through Twilio Content API, submits them for WhatsApp approval and can sync Approved/Rejected status without manual template entry." />
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

function ChannelCard({ icon: Icon, title, status, step, detail, secretNames, webhook, providerGuide, providerLabel, onCopy, onTest, testing }: {
  icon: any; title: string; status?: string; step?: number; detail?: string; secretNames: string[]; webhook: string; providerGuide: string; providerLabel: string;
  onCopy: (value: string, label: string) => Promise<void>; onTest: () => void; testing: boolean;
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
        <p className="text-sm text-muted-foreground">{detail}</p>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required runtime values</p><div className="mt-2 flex flex-wrap gap-2">{secretNames.map((name) => <Badge key={name} variant="secondary" className="font-mono text-[11px]">{name}</Badge>)}</div></div>
        <div className="rounded-xl border p-3"><p className="text-xs font-semibold">Production webhook</p><p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{webhook}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => void onCopy(webhook, `${title} webhook`)}><Clipboard />Copy webhook</Button></div>
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><a href={providerGuide} target="_blank" rel="noreferrer"><ExternalLink />{providerLabel}</a></Button><Button size="sm" onClick={onTest} disabled={testing}>{testing ? <RefreshCw className="animate-spin" /> : connected ? <CheckCircle2 /> : <RefreshCw />}{connected ? "Re-test" : "Test provider"}</Button></div>
      </CardContent>
    </Card>
  );
}

function SetupStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-xl border bg-background p-4"><Badge variant="outline">Step {number}</Badge><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div>;
}
