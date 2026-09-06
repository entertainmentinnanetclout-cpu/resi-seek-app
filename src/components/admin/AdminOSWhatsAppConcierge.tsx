import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  FileCheck2,
  GraduationCap,
  Image as ImageIcon,
  Layers3,
  MessageCircleMore,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RichContent = {
  id: string;
  content_key: string;
  display_name: string;
  content_type: string;
  content_sid?: string | null;
  approval_required: boolean;
  status: string;
  purpose: string;
  config?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
};

type Journey = {
  id: string;
  journey_key: string;
  display_name: string;
  description?: string | null;
  trigger_terms?: string[] | null;
  entry_content_key?: string | null;
  enabled: boolean;
  escalation_required: boolean;
  config?: Record<string, any> | null;
};

type SiteEvent = {
  id: string;
  event_type: string;
  source_table: string;
  status: string;
  attempts: number;
  last_error?: string | null;
  created_at: string;
  processed_at?: string | null;
  payload?: Record<string, any> | null;
};

const journeyIcons: Record<string, any> = {
  main: Sparkles,
  accommodation: Building2,
  applications: FileCheck2,
  opportunities: GraduationCap,
  technical: Wrench,
  partnerships: UserRoundCheck,
  human: ShieldCheck,
};

const statusClass = (status: string) => {
  if (["approved", "created", "sent"].includes(status)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["pending_approval", "waiting_template", "pending", "processing"].includes(status)) return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (["provider_error", "failed", "rejected", "blocked"].includes(status)) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-border bg-muted text-muted-foreground";
};

export default function AdminOSWhatsAppConcierge() {
  const [loading, setLoading] = useState(true);
  const [rich, setRich] = useState<RichContent[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [threadCount, setThreadCount] = useState(0);
  const [aiCount, setAiCount] = useState(0);
  const [residence, setResidence] = useState<any>(null);
  const [integration, setIntegration] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [richRes, journeyRes, eventRes, threadRes, integrationRes, residenceRes] = await Promise.all([
        (supabase as any).from("adminos_whatsapp_rich_content").select("*").order("created_at", { ascending: true }),
        (supabase as any).from("adminos_whatsapp_journeys").select("*").order("created_at", { ascending: true }),
        (supabase as any).from("adminos_whatsapp_site_events").select("*").order("created_at", { ascending: false }).limit(30),
        (supabase as any).from("adminos_whatsapp_threads").select("id,mode", { count: "exact" }).limit(500),
        (supabase as any).from("adminos_integration_connections").select("*").eq("provider", "twilio_whatsapp").maybeSingle(),
        (supabase as any).from("residences").select("id,name,slug,campus,city,price,private_price,nsfas_price,cover_image_url,image_url,available_spots").or("cover_image_url.not.is.null,image_url.not.is.null").neq("is_visible", false).order("is_spotlight", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const error = richRes.error || journeyRes.error || eventRes.error || threadRes.error || integrationRes.error;
      if (error) throw error;
      setRich(richRes.data || []);
      setJourneys(journeyRes.data || []);
      setEvents(eventRes.data || []);
      const threads = threadRes.data || [];
      setThreadCount(threadRes.count ?? threads.length);
      setAiCount(threads.filter((row: any) => (row.mode || "ai_auto") === "ai_auto").length);
      setIntegration(integrationRes.data || null);
      setResidence(residenceRes.data || null);
    } catch (error: any) {
      toast.error(error?.message || "Could not load Luna Concierge");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const channel = (supabase as any)
      .channel("adminos-whatsapp-concierge-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "adminos_whatsapp_rich_content" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "adminos_whatsapp_site_events" }, () => void load())
      .subscribe();
    return () => { void (supabase as any).removeChannel(channel); };
  }, [load]);

  const created = rich.filter((row) => ["created", "approved", "pending_approval"].includes(row.status)).length;
  const pendingApproval = rich.filter((row) => row.status === "pending_approval").length;
  const operational = rich.filter((row) => ["created", "approved"].includes(row.status)).length;
  const automationCoverage = 99;
  const eventSent = events.filter((row) => row.status === "sent").length;
  const eventWaiting = events.filter((row) => row.status === "waiting_template").length;

  const mainMenu = useMemo(() => rich.find((row) => row.content_key === "rk_main_menu"), [rich]);
  const menuItems = (mainMenu?.config?.items || []) as any[];

  return (
    <div className="space-y-5 pb-12">
      <section className="relative overflow-hidden rounded-[34px] border bg-gradient-to-br from-background via-background to-violet-500/5 p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,.55)] sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative grid gap-7 xl:grid-cols-[1.05fr_.95fr] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full gap-1.5 px-3 py-1"><Sparkles className="h-3.5 w-3.5" /> Luna Premium Concierge</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">OpenAI + Twilio</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">Rich WhatsApp UI</Badge>
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.035em] sm:text-4xl">A guided WhatsApp concierge — not a text-only bot.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">Luna now routes routine enquiries through interactive menus, verified ResKonnect data, rich residence media and site-event automations. Human intervention is reserved for protected decisions, partnerships and genuine exceptions.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusPill label="Twilio sender" value={integration?.status === "connected" ? "Live" : "Attention"} good={integration?.status === "connected"} />
              <StatusPill label="Rich content" value={`${operational}/${rich.length} operational`} good={operational > 0} />
              <StatusPill label="Journeys" value={`${journeys.filter((j) => j.enabled).length} active`} good />
              <StatusPill label="Automation design target" value={`${automationCoverage}%`} good />
            </div>
          </div>

          <PhonePreview menuItems={menuItems} residence={residence} />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={Layers3} label="Rich content" value={rich.length} sub={`${pendingApproval} awaiting Meta`} />
        <Metric icon={Route} label="Guided journeys" value={journeys.filter((j) => j.enabled).length} sub="Intent-aware routing" />
        <Metric icon={MessageCircleMore} label="Conversations" value={threadCount} sub={`${aiCount} in AI Auto`} />
        <Metric icon={Zap} label="Recent automations" value={eventSent} sub={`${eventWaiting} waiting on template`} />
        <Metric icon={ShieldCheck} label="Human fallback" value={journeys.filter((j) => j.escalation_required).length} sub="Protected paths" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="rounded-[28px] shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div><CardTitle className="text-xl">Journey coverage</CardTitle><p className="mt-1 text-xs text-muted-foreground">What Luna can route before falling back to open-ended AI.</p></div>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => void load()} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh</Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {journeys.map((journey) => {
              const Icon = journeyIcons[journey.journey_key] || Bot;
              return (
                <div key={journey.id} className="rounded-[22px] border bg-muted/20 p-4 transition hover:bg-muted/35">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-background shadow-sm ring-1 ring-black/5"><Icon className="h-4 w-4" /></div>
                    <Badge variant="outline" className={cn("rounded-full text-[10px]", journey.escalation_required ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>{journey.escalation_required ? "Human gate" : "Luna managed"}</Badge>
                  </div>
                  <p className="mt-4 font-black">{journey.display_name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{journey.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{(journey.trigger_terms || []).slice(0, 5).map((term) => <span key={term} className="rounded-full bg-muted px-2 py-1 text-[9px] font-semibold text-muted-foreground">{term}</span>)}</div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-xl">Site-to-WhatsApp automation</CardTitle><p className="mt-1 text-xs text-muted-foreground">Transactional events generated by ResKonnect product activity.</p></CardHeader>
          <CardContent className="space-y-3">
            <AutomationLine icon={Building2} title="Accommodation application" text="Confirmation, property context, image and tracking actions." />
            <AutomationLine icon={CheckCircle2} title="Reservation" text="Confirmation, residence image and next-step menu." />
            <AutomationLine icon={FileCheck2} title="Missing documents" text="Attention notice with secure portal handoff." />
            <AutomationLine icon={GraduationCap} title="WIL application" text="Confirmation, WIL status and document journey." />
            <AutomationLine icon={Wrench} title="Support enquiry" text="Acknowledgement and guided troubleshooting." />
            <AutomationLine icon={Activity} title="Status changes" text="Application, reservation and WIL updates." />
            <div className="rounded-2xl border bg-muted/25 p-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Near real-time worker:</strong> queued site events are processed every minute. Outside the WhatsApp 24-hour service window, approved Meta templates are required automatically.</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><CardTitle className="text-xl">Rich Content Library</CardTitle><p className="mt-1 text-xs text-muted-foreground">Interactive list pickers, quick replies and transactional content provisioned through Twilio Content API.</p></div><Badge variant="outline" className="rounded-full">{created}/{rich.length} provisioned</Badge></div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rich.map((row) => (
              <div key={row.id} className="rounded-[22px] border p-4">
                <div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted"><RichIcon type={row.content_type} /></div><Badge variant="outline" className={cn("rounded-full text-[9px] uppercase", statusClass(row.status))}>{row.status.replaceAll("_", " ")}</Badge></div>
                <p className="mt-4 font-black">{row.display_name}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{row.content_type.replace("twilio/", "")}</p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{row.approval_required ? "Can initiate or continue a transactional conversation once Meta approves it." : "Interactive in-session content for active WhatsApp conversations."}</p>
                {row.content_sid && <p className="mt-3 truncate rounded-xl bg-muted/55 px-3 py-2 font-mono text-[9px] text-muted-foreground">{row.content_sid}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Card className="rounded-[28px] shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-xl">Operating rules</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Rule good title="Luna resolves routine enquiries" text="Accommodation, applications, WIL, general support and standard platform questions remain automated when verified data is available." />
            <Rule good title="Rich UI first" text="Greetings and known intents use menus or quick replies before relying on open-ended text." />
            <Rule good title="Verified property facts" text="Availability, price and residence recommendations come from published ResKonnect residence records." />
            <Rule good title="Privacy-aware" text="Sensitive documents and credentials are routed to secure portal pages, not requested in open chat." />
            <Rule title="Human when genuinely required" text="Partnership decisions, protected actions, safety/legal issues and unresolved technical exceptions escalate with context attached." />
          </CardContent>
        </Card>

        <Card className="rounded-[28px] shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-xl">Recent automation activity</CardTitle><p className="mt-1 text-xs text-muted-foreground">Latest application, reservation, document, WIL and enquiry triggers.</p></CardHeader>
          <CardContent>
            {events.length ? <div className="space-y-2">{events.slice(0, 12).map((event) => <div key={event.id} className="flex items-center gap-3 rounded-2xl border p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-muted"><Clock3 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{event.event_type.replaceAll("_", " ")}</p><p className="truncate text-[10px] text-muted-foreground">{event.source_table} · {new Date(event.created_at).toLocaleString("en-ZA")}</p></div><Badge variant="outline" className={cn("rounded-full text-[9px]", statusClass(event.status))}>{event.status.replaceAll("_", " ")}</Badge></div>)}</div> : <div className="rounded-2xl border border-dashed p-8 text-center"><Zap className="mx-auto h-7 w-7 text-muted-foreground/50" /><p className="mt-3 font-semibold">Waiting for the next site event</p><p className="mt-1 text-xs text-muted-foreground">New applications, reservations and eligible support activity will appear here automatically.</p></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PhonePreview({ menuItems, residence }: { menuItems: any[]; residence: any }) {
  return (
    <div className="mx-auto w-full max-w-[390px] rounded-[42px] border-[7px] border-foreground/90 bg-background p-2 shadow-[0_36px_70px_-30px_rgba(0,0,0,.55)]">
      <div className="overflow-hidden rounded-[30px] border bg-muted/20">
        <div className="flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur-xl">
          <img src="/icon-512.png" alt="ResKonnect" className="h-10 w-10 rounded-full bg-white object-cover ring-1 ring-black/5" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">ResKonnect</p><p className="text-[10px] text-emerald-600">Business · Luna Concierge</p></div>
          <Sparkles className="h-4 w-4 text-violet-500" />
        </div>
        <div className="min-h-[490px] space-y-3 bg-gradient-to-b from-emerald-500/[.04] to-background p-3">
          <div className="max-w-[88%] rounded-[18px] rounded-tl-md border bg-background p-3 shadow-sm">
            <p className="text-[12px] leading-5"><strong>Hi there.</strong> Thanks for contacting ResKonnect. How can we help you today?</p>
            <div className="mt-3 overflow-hidden rounded-xl border">
              {(menuItems.length ? menuItems : [
                { item: "Accommodation", description: "Find, apply, reserve or track" },
                { item: "Application status", description: "Status and missing documents" },
                { item: "WIL & Opportunities", description: "Placement and WIL support" },
                { item: "Speak to a human", description: "Escalate when needed" },
              ]).slice(0, 5).map((item, index) => <div key={`${item.item}-${index}`} className="flex items-center gap-2 border-b px-3 py-2.5 last:border-0"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-[10px] font-black text-emerald-700">{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">{item.item}</p><p className="truncate text-[9px] text-muted-foreground">{item.description}</p></div><ArrowRight className="h-3 w-3 text-muted-foreground" /></div>)}
            </div>
            <div className="mt-2 rounded-xl bg-emerald-500 px-3 py-2 text-center text-[10px] font-black text-white">Choose an option</div>
          </div>

          {residence && <div className="ml-auto max-w-[87%] overflow-hidden rounded-[18px] rounded-tr-md border bg-background shadow-sm">{(residence.cover_image_url || residence.image_url) && <img src={residence.cover_image_url || residence.image_url} alt="" className="h-28 w-full object-cover" />}<div className="p-3"><p className="text-[11px] font-black">{residence.name}</p><p className="mt-1 text-[9px] text-muted-foreground">{residence.campus || residence.city || "Verified accommodation"}</p><div className="mt-2 flex items-center justify-between text-[9px]"><span>{residence.price ? `From R${Number(residence.price).toLocaleString("en-ZA")}` : "View price"}</span><span>{residence.available_spots != null ? `${residence.available_spots} spots` : "Check availability"}</span></div></div></div>}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number | string; sub: string }) { return <div className="rounded-[24px] border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><div className="grid h-9 w-9 place-items-center rounded-2xl bg-muted"><Icon className="h-4 w-4" /></div><span className="text-2xl font-black">{value}</span></div><p className="mt-4 text-sm font-black">{label}</p><p className="mt-1 text-[10px] text-muted-foreground">{sub}</p></div>; }
function StatusPill({ label, value, good }: { label: string; value: string; good?: boolean }) { return <div className="flex items-center gap-2 rounded-full border bg-background/80 px-3 py-2 text-[10px] font-semibold shadow-sm backdrop-blur-xl"><span className={cn("h-2 w-2 rounded-full", good ? "bg-emerald-500" : "bg-amber-500")} /><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div>; }
function AutomationLine({ icon: Icon, title, text }: { icon: any; title: string; text: string }) { return <div className="flex gap-3 rounded-2xl border p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-muted"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{text}</p></div></div>; }
function Rule({ title, text, good = false }: { title: string; text: string; good?: boolean }) { return <div className="flex gap-3 rounded-2xl border p-3"><div className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", good ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700")}>{good ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}</div><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{text}</p></div></div>; }
function RichIcon({ type }: { type: string }) { if (type.includes("list")) return <Layers3 className="h-4 w-4" />; if (type.includes("quick")) return <MessageCircleMore className="h-4 w-4" />; if (type.includes("media")) return <ImageIcon className="h-4 w-4" />; return <Bot className="h-4 w-4" />; }
