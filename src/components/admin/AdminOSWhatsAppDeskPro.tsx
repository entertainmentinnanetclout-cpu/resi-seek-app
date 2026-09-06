import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Inbox,
  Info,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ThreadMode = "ai_auto" | "assist" | "human" | "escalated" | "closed";
type DeskSection = "inbox" | "setup" | "templates" | "automation" | "analytics";
type InboxFilter = "all" | "unread" | "ai" | "assist" | "human" | "escalated" | "resolved";

type Contact = {
  id: string;
  profile_user_id?: string | null;
  contact_type?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  student_number?: string | null;
  campus?: string | null;
  status?: string | null;
  primary_source?: string | null;
  metadata?: Record<string, any> | null;
  profile_picture_url?: string | null;
};

type Message = {
  id: string;
  thread_id: string;
  contact_id?: string | null;
  direction: "inbound" | "outbound";
  body_text?: string | null;
  media?: any[] | null;
  status?: string | null;
  risk_level?: string | null;
  confidence?: number | null;
  created_at: string;
  received_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  metadata?: Record<string, any> | null;
};

type Thread = {
  id: string;
  contact_id?: string | null;
  channel_address: string;
  normalized_address: string;
  status: string;
  mode?: ThreadMode | null;
  priority?: string | null;
  assigned_to?: string | null;
  unread_count: number;
  last_message_at?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  customer_window_expires_at?: string | null;
  last_summary?: string | null;
  tags?: any[] | null;
  is_pinned?: boolean | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  takeover_at?: string | null;
  takeover_by?: string | null;
  metadata?: Record<string, any> | null;
  contact?: Contact | null;
  lastMessage?: Message | null;
  assignee?: Staff | null;
};

type Staff = { id: string; full_name?: string | null; email?: string | null; role?: string | null; profile_picture_url?: string | null };
type Draft = { id: string; thread_id: string; body_text: string; status: string; risk_level: string; confidence?: number | null; metadata?: any; created_at: string };
type Activity = { id: string; thread_id: string; actor_id?: string | null; event_type: string; metadata?: any; created_at: string };
type Analytics = {
  totals: Record<string, number>;
  automation_share: number;
  delivery_rate: number;
  average_first_response_seconds: number | null;
  daily: Array<{ date: string; inbound: number; outbound: number }>;
};

type Props = { embedded?: boolean };

const sections: Array<{ value: DeskSection; label: string; icon: any }> = [
  { value: "inbox", label: "Inbox", icon: Inbox },
  { value: "setup", label: "Setup", icon: Settings2 },
  { value: "templates", label: "Templates", icon: FileText },
  { value: "automation", label: "Automation", icon: Zap },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
];

const filters: Array<{ value: InboxFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "ai", label: "AI Auto" },
  { value: "assist", label: "Assist" },
  { value: "human", label: "Human" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
];

const quickReplies = [
  "Thanks — I’m checking this for you now.",
  "Please send the outstanding document here and I’ll continue with the next step.",
  "I’ve received your message. I’ll guide you through the next step.",
];

export default function AdminOSWhatsAppDeskPro({ embedded = false }: Props) {
  const [section, setSection] = useState<DeskSection>("inbox");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [integration, setIntegration] = useState<any>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [composer, setComposer] = useState("");
  const [noteText, setNoteText] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const invokeDesk = useCallback(async (body: any) => {
    const { data, error } = await (supabase.functions as any).invoke("adminos-whatsapp-desk", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const loadDesk = useCallback(async () => {
    setLoading(true);
    try {
      const [threadRes, messageRes, templateRes, integrationRes, staffRes, analyticsRes] = await Promise.all([
        (supabase as any).from("adminos_whatsapp_threads").select("*").order("is_pinned", { ascending: false }).order("last_message_at", { ascending: false }).limit(200),
        (supabase as any).from("adminos_whatsapp_messages").select("*").order("created_at", { ascending: false }).limit(800),
        (supabase as any).from("adminos_whatsapp_templates").select("*").order("created_at", { ascending: true }),
        (supabase as any).from("adminos_integration_connections").select("*").eq("provider", "twilio_whatsapp").maybeSingle(),
        invokeDesk({ action: "staff" }).catch(() => ({ staff: [] })),
        invokeDesk({ action: "analytics" }).catch(() => ({ analytics: null })),
      ]);
      const error = threadRes.error || messageRes.error || templateRes.error || integrationRes.error;
      if (error) throw error;
      const rawThreads = (threadRes.data || []) as Thread[];
      const rawMessages = (messageRes.data || []) as Message[];
      const staffRows = (staffRes.staff || []) as Staff[];
      const staffMap = new Map(staffRows.map((row) => [row.id, row]));
      const contactIds = Array.from(new Set(rawThreads.map((row) => row.contact_id).filter(Boolean))) as string[];
      const contactMap = new Map<string, Contact>();
      if (contactIds.length) {
        const { data: contactRows, error: contactError } = await (supabase as any)
          .from("adminos_contacts")
          .select("id,profile_user_id,contact_type,full_name,email,phone,student_number,campus,status,primary_source,metadata")
          .in("id", contactIds);
        if (contactError) throw contactError;
        const profileIds = Array.from(new Set((contactRows || []).map((row: any) => row.profile_user_id).filter(Boolean))) as string[];
        const profileMap = new Map<string, string | null>();
        if (profileIds.length) {
          const { data: profiles } = await (supabase as any).from("profiles").select("id,profile_picture_url").in("id", profileIds);
          for (const profile of profiles || []) profileMap.set(profile.id, profile.profile_picture_url || null);
        }
        for (const contact of contactRows || []) contactMap.set(contact.id, { ...contact, profile_picture_url: contact.profile_user_id ? profileMap.get(contact.profile_user_id) || null : null });
      }
      const lastByThread = new Map<string, Message>();
      for (const message of rawMessages) if (!lastByThread.has(message.thread_id)) lastByThread.set(message.thread_id, message);
      const hydrated = rawThreads.map((thread) => ({
        ...thread,
        contact: thread.contact_id ? contactMap.get(thread.contact_id) || null : null,
        lastMessage: lastByThread.get(thread.id) || null,
        assignee: thread.assigned_to ? staffMap.get(thread.assigned_to) || null : null,
      }));
      setThreads(hydrated);
      setRecentMessages(rawMessages);
      setTemplates(templateRes.data || []);
      setIntegration(integrationRes.data || null);
      setStaff(staffRows);
      setAnalytics(analyticsRes.analytics || null);
      setSelectedThreadId((current) => current && hydrated.some((row) => row.id === current) ? current : hydrated[0]?.id || null);
    } catch (error: any) {
      toast.error(error?.message || "Could not load WhatsApp Desk");
    } finally {
      setLoading(false);
    }
  }, [invokeDesk]);

  const loadThread = useCallback(async (threadId: string) => {
    setThreadLoading(true);
    try {
      const [messageRes, noteRes, draftRes, activityRes, threadRes] = await Promise.all([
        (supabase as any).from("adminos_whatsapp_messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(1000),
        (supabase as any).from("adminos_whatsapp_notes").select("*").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("adminos_whatsapp_drafts").select("*").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(20),
        (supabase as any).from("adminos_whatsapp_activity").select("*").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(40),
        (supabase as any).from("adminos_whatsapp_threads").select("*").eq("id", threadId).maybeSingle(),
      ]);
      const error = messageRes.error || noteRes.error || draftRes.error || activityRes.error || threadRes.error;
      if (error) throw error;
      setMessages(messageRes.data || []);
      setNotes(noteRes.data || []);
      setDrafts(draftRes.data || []);
      setActivity(activityRes.data || []);
      const thread = threadRes.data as Thread | null;
      let contact: Contact | null = null;
      let application: any = null;
      if (thread?.contact_id) {
        const { data, error: contactError } = await (supabase as any)
          .from("adminos_contacts")
          .select("id,profile_user_id,contact_type,full_name,email,phone,student_number,campus,status,primary_source,metadata")
          .eq("id", thread.contact_id)
          .maybeSingle();
        if (contactError) throw contactError;
        contact = data || null;
        if (contact?.profile_user_id) {
          const [{ data: profile }, { data: apps }] = await Promise.all([
            (supabase as any).from("profiles").select("profile_picture_url").eq("id", contact.profile_user_id).maybeSingle(),
            (supabase as any).from("applications").select("id,status,funding_type,application_date,move_in_date,moved_in,residence_id").eq("user_id", contact.profile_user_id).order("created_at", { ascending: false }).limit(1),
          ]);
          contact = { ...contact, profile_picture_url: profile?.profile_picture_url || null };
          application = apps?.[0] || null;
        }
      }
      setSelectedContact(contact);
      setSelectedApplication(application);
      if ((thread?.unread_count || 0) > 0) await (supabase as any).from("adminos_whatsapp_threads").update({ unread_count: 0, updated_at: new Date().toISOString() }).eq("id", threadId);
    } catch (error: any) {
      toast.error(error?.message || "Could not load conversation");
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => { void loadDesk(); }, [loadDesk]);
  useEffect(() => {
    if (selectedThreadId) void loadThread(selectedThreadId);
    else { setMessages([]); setNotes([]); setDrafts([]); setActivity([]); setSelectedContact(null); setSelectedApplication(null); }
    setComposer(""); setAttachment(null); setSelectedDraftId(null); setSelectedTemplateKey(""); setTemplateVars({});
  }, [selectedThreadId, loadThread]);

  useEffect(() => {
    const channel = (supabase as any)
      .channel("adminos-whatsapp-desk-pro-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "adminos_whatsapp_threads" }, () => void loadDesk())
      .on("postgres_changes", { event: "*", schema: "public", table: "adminos_whatsapp_messages" }, (payload: any) => { void loadDesk(); const id = payload?.new?.thread_id || payload?.old?.thread_id; if (id === selectedThreadId) void loadThread(id); })
      .on("postgres_changes", { event: "*", schema: "public", table: "adminos_whatsapp_drafts" }, (payload: any) => { const id = payload?.new?.thread_id || payload?.old?.thread_id; if (id === selectedThreadId) void loadThread(id); })
      .on("postgres_changes", { event: "*", schema: "public", table: "adminos_whatsapp_notes" }, (payload: any) => { const id = payload?.new?.thread_id || payload?.old?.thread_id; if (id === selectedThreadId) void loadThread(id); })
      .subscribe((status: string) => setRealtimeConnected(status === "SUBSCRIBED"));
    return () => { void (supabase as any).removeChannel(channel); };
  }, [loadDesk, loadThread, selectedThreadId]);

  const selectedThread = useMemo(() => threads.find((row) => row.id === selectedThreadId) || null, [threads, selectedThreadId]);
  const selectedTemplate = useMemo(() => templates.find((row) => row.template_key === selectedTemplateKey) || null, [templates, selectedTemplateKey]);
  const readyDraft = useMemo(() => drafts.find((row) => row.status === "ready") || null, [drafts]);
  const windowOpen = selectedThread?.customer_window_expires_at ? new Date(selectedThread.customer_window_expires_at).getTime() > Date.now() : false;
  const approvedTemplates = useMemo(() => templates.filter((row) => row.status === "approved" && row.content_sid), [templates]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const next: Record<string, string> = {};
    for (const variable of selectedTemplate.variables || []) {
      const key = String(variable);
      next[key] = key.includes("name") ? (selectedContact?.full_name || "") : key.includes("campus") ? (selectedContact?.campus || "") : "";
    }
    setTemplateVars(next);
  }, [selectedTemplate, selectedContact]);

  const filteredThreads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return threads.filter((thread) => {
      const mode = thread.mode || "ai_auto";
      if (filter === "unread" && !thread.unread_count) return false;
      if (filter === "ai" && mode !== "ai_auto") return false;
      if (filter === "assist" && mode !== "assist") return false;
      if (filter === "human" && mode !== "human") return false;
      if (filter === "escalated" && mode !== "escalated" && thread.status !== "escalated") return false;
      if (filter === "resolved" && !["resolved", "archived"].includes(thread.status)) return false;
      if (!needle) return true;
      return [displayName(thread), thread.channel_address, thread.contact?.email, thread.contact?.student_number, thread.lastMessage?.body_text, thread.assignee?.full_name].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [threads, filter, search]);

  const run = async (key: string, fn: () => Promise<any>, success?: string) => {
    setWorking(key);
    try {
      const result = await fn();
      if (success) toast.success(success);
      await Promise.all([loadDesk(), selectedThreadId ? loadThread(selectedThreadId) : Promise.resolve()]);
      return result;
    } catch (error: any) {
      toast.error(error?.message || "Action failed");
      return null;
    } finally { setWorking(null); }
  };

  const uploadAttachment = async () => {
    if (!attachment || !selectedThreadId) return null;
    if (attachment.size > 20 * 1024 * 1024) throw new Error("Attachment must be 20MB or smaller");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Session expired");
    const safe = attachment.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
    const path = `${auth.user.id}/${selectedThreadId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("adminos-whatsapp-media").upload(path, attachment, { upsert: false, contentType: attachment.type || undefined });
    if (error) throw error;
    return path;
  };

  const sendMessage = async () => {
    if (!selectedThread) return;
    await run("send", async () => {
      let mediaPath: string | null = null;
      if (attachment) mediaPath = await uploadAttachment();
      const result = await invokeDesk({
        action: "send",
        thread_id: selectedThread.id,
        body_text: composer,
        template_key: selectedTemplateKey || null,
        template_vars: templateVars,
        media_path: mediaPath,
        media_name: attachment?.name || null,
        media_type: attachment?.type || null,
        draft_id: selectedDraftId,
      });
      setComposer(""); setAttachment(null); setSelectedDraftId(null); setSelectedTemplateKey(""); setTemplateVars({});
      return result;
    }, selectedTemplateKey ? "Template sent" : "WhatsApp message sent");
  };

  const createDraft = async () => {
    if (!selectedThread) return;
    const result = await run("draft", () => invokeDesk({ action: "ai_draft", thread_id: selectedThread.id }), "Luna prepared a reply");
    if (result?.draft?.body_text) { setComposer(result.draft.body_text); setSelectedDraftId(result.draft.id); }
  };

  const useDraft = (draft: Draft) => { setComposer(draft.body_text); setSelectedDraftId(draft.id); };
  const dismissDraft = async (draft: Draft) => { if (selectedThread) await run("dismiss", () => invokeDesk({ action: "dismiss_draft", thread_id: selectedThread.id, draft_id: draft.id }), "Draft dismissed"); };
  const setMode = async (mode: ThreadMode) => { if (selectedThread) await run(`mode:${mode}`, () => invokeDesk({ action: "set_mode", thread_id: selectedThread.id, mode }), `${modeLabel(mode)} enabled`); };
  const assign = async (value: string) => { if (selectedThread) await run("assign", () => invokeDesk({ action: "assign", thread_id: selectedThread.id, assigned_to: value === "unassigned" ? null : value }), "Assignment updated"); };
  const setPriority = async (value: string) => { if (selectedThread) await run("priority", () => invokeDesk({ action: "thread_state", thread_id: selectedThread.id, priority: value }), "Priority updated"); };
  const togglePin = async () => { if (selectedThread) await run("pin", () => invokeDesk({ action: "thread_state", thread_id: selectedThread.id, is_pinned: !selectedThread.is_pinned }), selectedThread.is_pinned ? "Conversation unpinned" : "Conversation pinned"); };
  const resolve = async () => { if (selectedThread) await run("resolve", () => invokeDesk({ action: "resolve", thread_id: selectedThread.id }), "Conversation resolved"); };
  const reopen = async () => { if (selectedThread) await run("reopen", () => invokeDesk({ action: "reopen", thread_id: selectedThread.id, mode: "human" }), "Conversation reopened"); };
  const escalate = async () => { if (selectedThread) await run("escalate", () => invokeDesk({ action: "escalate", thread_id: selectedThread.id, reason: "Manual staff escalation" }), "Conversation escalated"); };
  const summarize = async () => { if (selectedThread) await run("summary", () => invokeDesk({ action: "ai_summary", thread_id: selectedThread.id }), "Conversation summary updated"); };
  const addNote = async () => {
    if (!selectedThread || !noteText.trim()) return;
    const value = noteText.trim();
    const result = await run("note", () => invokeDesk({ action: "note", thread_id: selectedThread.id, body: value }), "Internal note added");
    if (result) setNoteText("");
  };

  const unreadTotal = threads.reduce((sum, row) => sum + Number(row.unread_count || 0), 0);

  return (
    <div className={cn("space-y-5", embedded && "space-y-4")}>
      {!embedded && (
        <section className="relative overflow-hidden rounded-[34px] border bg-gradient-to-br from-background via-background to-slate-500/5 p-5 shadow-[0_22px_70px_-46px_rgba(0,0,0,0.4)] sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <SenderAvatar className="h-14 w-14 rounded-[18px] shadow-lg ring-1 ring-black/5" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp Desk</Badge>
                  <Badge variant="outline" className="rounded-full">Phases 1–5 complete</Badge>
                  <Badge variant={integration?.status === "connected" ? "default" : "outline"} className="rounded-full">{integration?.status === "connected" ? "Sender live" : "Provider attention"}</Badge>
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">ResKonnect Messages</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Your complete WhatsApp operating desk: human messaging, secure media, templates, assignment, Luna Auto/Assist, summaries, realtime control and analytics.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border bg-background/80 px-3 py-2 text-xs font-medium shadow-sm backdrop-blur-xl"><span className={cn("h-2 w-2 rounded-full", realtimeConnected ? "bg-emerald-500" : "bg-amber-500")} />{realtimeConnected ? "Live sync" : "Connecting"}</div>
              <Button variant="outline" className="rounded-full bg-background/80 backdrop-blur-xl" onClick={() => void loadDesk()} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh</Button>
            </div>
          </div>
        </section>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-2xl border bg-muted/40 p-1.5 shadow-sm backdrop-blur-xl">
        {sections.map((item) => <button key={item.value} type="button" onClick={() => setSection(item.value)} className={cn("flex min-w-max items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all", section === item.value ? "bg-background text-foreground shadow-sm ring-1 ring-black/5" : "text-muted-foreground hover:text-foreground")}><item.icon className="h-4 w-4" />{item.label}</button>)}
      </div>

      {section === "inbox" && (
        <div className="grid min-h-[760px] overflow-hidden rounded-[32px] border bg-background shadow-[0_24px_80px_-50px_rgba(0,0,0,.42)] md:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)_340px]">
          <aside className={cn("min-w-0 flex-col border-r bg-muted/20 md:flex", mobileChatOpen ? "hidden" : "flex")}>
            <div className="border-b bg-background/85 p-4 backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3"><div><p className="text-lg font-black tracking-tight">Messages</p><p className="text-xs text-muted-foreground">{threads.length} conversations · {unreadTotal} unread</p></div><div className="grid h-9 w-9 place-items-center rounded-full border bg-background shadow-sm"><MessageCircle className="h-4 w-4" /></div></div>
              <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="h-11 rounded-2xl border-0 bg-muted/70 pl-9 shadow-none focus-visible:ring-1" /></div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">{filters.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", filter === item.value ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}>{item.label}</button>)}</div>
            </div>
            <ScrollArea className="h-[650px] flex-1">
              {loading ? <LoadingInbox /> : filteredThreads.length ? <div className="p-2">{filteredThreads.map((thread) => <ConversationRow key={thread.id} thread={thread} selected={thread.id === selectedThreadId} onClick={() => { setSelectedThreadId(thread.id); setMobileChatOpen(true); }} />)}</div> : <EmptyInbox />}
            </ScrollArea>
          </aside>

          <main className={cn("min-w-0 flex-col bg-gradient-to-b from-muted/15 to-background md:flex", mobileChatOpen ? "flex" : "hidden")}>
            {selectedThread ? <>
              <div className="sticky top-0 z-20 border-b bg-background/82 px-3 py-3 backdrop-blur-2xl sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="rounded-full md:hidden" onClick={() => setMobileChatOpen(false)}><ArrowLeft className="h-5 w-5" /></Button><ContactAvatar thread={{ ...selectedThread, contact: selectedContact || selectedThread.contact }} className="h-10 w-10" /><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-bold">{displayName({ ...selectedThread, contact: selectedContact || selectedThread.contact })}</p><ModeDot mode={(selectedThread.mode || "ai_auto") as ThreadMode} /></div><p className="truncate text-xs text-muted-foreground">{formatPhone(selectedThread.channel_address)} · {selectedThread.assignee?.full_name || "Unassigned"}</p></div></div>
                  <div className="flex items-center gap-1.5"><Button variant="outline" size="icon" className="rounded-full" onClick={togglePin} disabled={working === "pin"}>{selectedThread.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</Button><Sheet><SheetTrigger asChild><Button variant="outline" size="icon" className="rounded-full xl:hidden"><Info className="h-4 w-4" /></Button></SheetTrigger><SheetContent className="w-[94vw] max-w-md overflow-y-auto"><SheetHeader><SheetTitle>Conversation control</SheetTitle></SheetHeader><ContextPanel thread={selectedThread} contact={selectedContact} application={selectedApplication} notes={notes} activity={activity} staff={staff} noteText={noteText} setNoteText={setNoteText} onAddNote={addNote} onAssign={assign} onPriority={setPriority} onSummarize={summarize} onResolve={resolve} onReopen={reopen} onEscalate={escalate} working={working} /></SheetContent></Sheet></div>
                </div>
                <ModeControl mode={(selectedThread.mode || "ai_auto") as ThreadMode} onMode={setMode} disabled={Boolean(working)} />
              </div>

              <ScrollArea className="h-[520px] flex-1">
                <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-end px-4 py-6 sm:px-6">
                  <div className="mb-5 flex justify-center"><span className="rounded-full border bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">Secure business messaging · Twilio transport · AdminOS control</span></div>
                  {threadLoading && !messages.length ? <div className="py-20 text-center text-sm text-muted-foreground">Loading conversation…</div> : messages.length ? messages.map((message) => <MessageBubble key={message.id} message={message} />) : <div className="py-24 text-center"><MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 font-semibold">No messages in this thread yet</p></div>}
                </div>
              </ScrollArea>

              <div className="border-t bg-background/88 p-3 backdrop-blur-2xl sm:p-4">
                <div className="mx-auto max-w-4xl space-y-2.5">
                  {readyDraft && <DraftCard draft={readyDraft} onUse={() => useDraft(readyDraft)} onDismiss={() => void dismissDraft(readyDraft)} />}
                  {!windowOpen && approvedTemplates.length === 0 && <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">The 24-hour WhatsApp service window is closed and no approved template is available yet. A template must be approved by Meta before a new outbound conversation can be started.</div>}
                  <div className="flex gap-1.5 overflow-x-auto pb-1">{quickReplies.map((text) => <button key={text} type="button" onClick={() => { setComposer(text); setSelectedDraftId(null); }} className="whitespace-nowrap rounded-full border bg-background px-3 py-1.5 text-[11px] font-semibold shadow-sm hover:bg-muted">{text}</button>)}</div>
                  <div className="rounded-[26px] border bg-muted/35 p-2 shadow-sm">
                    {selectedTemplateKey && selectedTemplate && <div className="mb-2 rounded-2xl border bg-background p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black">{selectedTemplate.display_name}</p><p className="text-[10px] text-muted-foreground">Approved template</p></div><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setSelectedTemplateKey("")}><X className="h-3.5 w-3.5" /></Button></div>{(selectedTemplate.variables || []).length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{selectedTemplate.variables.map((variable: string) => <Input key={variable} value={templateVars[variable] || ""} onChange={(e) => setTemplateVars((current) => ({ ...current, [variable]: e.target.value }))} placeholder={variable.replaceAll("_", " ")} className="h-9 rounded-xl" />)}</div>}</div>}
                    {attachment && <div className="mb-2 flex items-center justify-between rounded-2xl border bg-background px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{attachment.name}</p><p className="text-[10px] text-muted-foreground">{formatBytes(attachment.size)}</p></div><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setAttachment(null)}><X className="h-3.5 w-3.5" /></Button></div>}
                    <Textarea value={composer} onChange={(e) => { setComposer(e.target.value); if (selectedDraftId && e.target.value !== readyDraft?.body_text) setSelectedDraftId(null); }} placeholder={selectedTemplateKey ? "Optional internal preview text" : windowOpen ? "Message…" : "Choose an approved template to send"} disabled={!windowOpen && !selectedTemplateKey} className="min-h-[76px] resize-none border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && (composer.trim() || selectedTemplateKey || attachment)) { event.preventDefault(); void sendMessage(); } }} />
                    <div className="flex items-center justify-between gap-2 border-t px-1 pt-2">
                      <div className="flex items-center gap-1"><input ref={fileRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,.docx" onChange={(e) => setAttachment(e.target.files?.[0] || null)} /><Button variant="ghost" size="icon" className="rounded-full" disabled={!windowOpen || Boolean(selectedTemplateKey)} onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /></Button><Button variant="ghost" className="rounded-full gap-1.5" onClick={() => void createDraft()} disabled={working === "draft"}><Sparkles className="h-4 w-4" /> Draft</Button>{approvedTemplates.length > 0 && <Select value={selectedTemplateKey || "none"} onValueChange={(value) => setSelectedTemplateKey(value === "none" ? "" : value)}><SelectTrigger className="h-9 w-[150px] rounded-full border-0 bg-background"><SelectValue placeholder="Template" /></SelectTrigger><SelectContent><SelectItem value="none">No template</SelectItem>{approvedTemplates.map((template) => <SelectItem key={template.id} value={template.template_key}>{template.display_name}</SelectItem>)}</SelectContent></Select>}</div>
                      <Button className="h-10 rounded-full px-5" onClick={() => void sendMessage()} disabled={working === "send" || (!selectedTemplateKey && !windowOpen) || (!selectedTemplateKey && !composer.trim() && !attachment)}><Send className="h-4 w-4" /> Send</Button>
                    </div>
                  </div>
                </div>
              </div>
            </> : <NoConversation />}
          </main>

          <aside className="hidden min-w-0 border-l bg-muted/15 xl:block"><ScrollArea className="h-[760px]"><ContextPanel thread={selectedThread} contact={selectedContact} application={selectedApplication} notes={notes} activity={activity} staff={staff} noteText={noteText} setNoteText={setNoteText} onAddNote={addNote} onAssign={assign} onPriority={setPriority} onSummarize={summarize} onResolve={resolve} onReopen={reopen} onEscalate={escalate} working={working} /></ScrollArea></aside>
        </div>
      )}

      {section === "setup" && <SetupPanel integration={integration} realtimeConnected={realtimeConnected} />}
      {section === "templates" && <TemplatesPanel templates={templates} />}
      {section === "automation" && <AutomationPanel threads={threads} selectedThread={selectedThread} onMode={setMode} />}
      {section === "analytics" && <AnalyticsPanel analytics={analytics} />}
    </div>
  );
}

function ConversationRow({ thread, selected, onClick }: { thread: Thread; selected: boolean; onClick: () => void }) {
  const unread = Number(thread.unread_count || 0);
  return <button type="button" onClick={onClick} className={cn("group mb-1 flex w-full items-center gap-3 rounded-[20px] p-3 text-left transition-all", selected ? "bg-background shadow-sm ring-1 ring-black/5" : "hover:bg-background/75")}><ContactAvatar thread={thread} className="h-12 w-12" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-1.5">{thread.is_pinned && <Pin className="h-3 w-3 shrink-0" />}<p className={cn("truncate text-sm", unread ? "font-extrabold" : "font-semibold")}>{displayName(thread)}</p></div><span className={cn("shrink-0 text-[10px]", unread ? "font-bold text-foreground" : "text-muted-foreground")}>{relativeTime(thread.last_message_at)}</span></div><div className="mt-1 flex items-center gap-2"><p className={cn("min-w-0 flex-1 truncate text-xs", unread ? "font-semibold text-foreground" : "text-muted-foreground")}>{thread.lastMessage?.direction === "outbound" ? "You: " : ""}{thread.lastMessage?.body_text || "New WhatsApp conversation"}</p>{unread > 0 && <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}</div><div className="mt-2 flex items-center gap-1.5"><ModeBadge mode={(thread.mode || "ai_auto") as ThreadMode} compact />{thread.priority && thread.priority !== "normal" && <Badge variant="outline" className="h-5 rounded-full px-2 text-[9px] uppercase">{thread.priority}</Badge>}{thread.assignee?.full_name && <span className="truncate text-[9px] text-muted-foreground">· {thread.assignee.full_name}</span>}</div></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100" /></button>;
}

function ModeControl({ mode, onMode, disabled }: { mode: ThreadMode; onMode: (mode: ThreadMode) => Promise<void>; disabled?: boolean }) {
  const items: Array<[ThreadMode, string]> = [["ai_auto", "AI Auto"], ["assist", "Assist"], ["human", "Human"]];
  return <div className="mt-3 flex w-fit rounded-full border bg-muted/60 p-1">{items.map(([value, label]) => <button key={value} type="button" disabled={disabled} onClick={() => void onMode(value)} className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold transition-all", mode === value ? "bg-background shadow-sm ring-1 ring-black/5" : "text-muted-foreground hover:text-foreground")}>{label}</button>)}</div>;
}

function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";
  const authorType = message.metadata?.author_type || (outbound && message.metadata?.source === "whatsapp_auto_reply" ? "ai" : outbound ? "human" : "contact");
  return <div className={cn("mb-2 flex", outbound ? "justify-end" : "justify-start")}><div className="max-w-[86%] sm:max-w-[72%]">{outbound && authorType === "ai" && <div className="mb-1 flex justify-end"><span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300"><Sparkles className="h-2.5 w-2.5" /> Luna AI</span></div>}{outbound && authorType === "human" && <div className="mb-1 flex justify-end"><span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Staff</span></div>}<div className={cn("rounded-[22px] px-4 py-2.5 shadow-sm", outbound ? "rounded-br-md bg-foreground text-background" : "rounded-bl-md border bg-background")}>{message.body_text && <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body_text}</p>}{Array.isArray(message.media) && message.media.length > 0 && <div className="mt-2 space-y-1">{message.media.map((item, index) => <div key={index} className={cn("rounded-xl px-3 py-2 text-xs", outbound ? "bg-background/10" : "bg-muted/70")}><Paperclip className="mr-1 inline h-3 w-3" />{item?.name || item?.content_type || "Attachment"}</div>)}</div>}<div className={cn("mt-1.5 flex items-center justify-end gap-1 text-[9px]", outbound ? "text-background/65" : "text-muted-foreground")}>{clockTime(message.sent_at || message.received_at || message.created_at)}{outbound && <DeliveryIcon status={String(message.status || "sent")} />}</div></div></div></div>;
}

function DraftCard({ draft, onUse, onDismiss }: { draft: Draft; onUse: () => void; onDismiss: () => void }) {
  return <div className="rounded-[22px] border border-violet-500/20 bg-violet-500/5 p-3.5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/10"><Sparkles className="h-4 w-4 text-violet-600" /></div><div><p className="text-xs font-black">Luna suggested reply</p><p className="text-[10px] text-muted-foreground">{draft.risk_level} risk · {draft.confidence ? `${Math.round(Number(draft.confidence) * 100)}% confidence` : "review before sending"}</p></div></div><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onDismiss}><X className="h-3.5 w-3.5" /></Button></div><p className="mt-3 text-sm leading-6">{draft.body_text}</p><Button size="sm" className="mt-3 rounded-full" onClick={onUse}>Use draft</Button></div>;
}

function ContextPanel(props: { thread: Thread | null; contact: Contact | null; application: any; notes: any[]; activity: Activity[]; staff: Staff[]; noteText: string; setNoteText: (value: string) => void; onAddNote: () => Promise<void>; onAssign: (value: string) => Promise<void>; onPriority: (value: string) => Promise<void>; onSummarize: () => Promise<void>; onResolve: () => Promise<void>; onReopen: () => Promise<void>; onEscalate: () => Promise<void>; working: string | null }) {
  const { thread, contact, application, notes, activity, staff, noteText, setNoteText, onAddNote, onAssign, onPriority, onSummarize, onResolve, onReopen, onEscalate, working } = props;
  if (!thread) return <div className="p-6 text-sm text-muted-foreground">Select a conversation to see customer context.</div>;
  const serviceWindow = thread.customer_window_expires_at ? new Date(thread.customer_window_expires_at).getTime() > Date.now() : false;
  const tags = Array.isArray(thread.tags) ? thread.tags : [];
  return <div className="space-y-5 p-5"><div className="text-center"><ContactAvatar thread={{ ...thread, contact }} className="mx-auto h-20 w-20 shadow-md ring-4 ring-background" /><p className="mt-3 text-lg font-black">{contact?.full_name || displayName(thread)}</p><p className="text-xs text-muted-foreground">{formatPhone(thread.channel_address)}</p><div className="mt-3 flex justify-center gap-2"><ModeBadge mode={(thread.mode || "ai_auto") as ThreadMode} /><Badge variant="outline" className="rounded-full">{thread.status}</Badge></div></div>
    <ContextCard title="Operations" icon={UsersRound}><div className="space-y-2"><Select value={thread.assigned_to || "unassigned"} onValueChange={(value) => void onAssign(value)}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Assign staff" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{staff.map((member) => <SelectItem key={member.id} value={member.id}>{member.full_name || member.email || "Staff"}</SelectItem>)}</SelectContent></Select><Select value={thread.priority || "normal"} onValueChange={(value) => void onPriority(value)}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["low", "normal", "high", "urgent"].map((value) => <SelectItem key={value} value={value}>{value[0].toUpperCase() + value.slice(1)} priority</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-2 gap-2"><Button variant="outline" className="rounded-xl" onClick={() => void onSummarize()} disabled={working === "summary"}><Sparkles className="h-4 w-4" /> Summarize</Button>{thread.status === "resolved" ? <Button className="rounded-xl" onClick={() => void onReopen()}>Reopen</Button> : <Button className="rounded-xl" onClick={() => void onResolve()}>Resolve</Button>}</div><Button variant="outline" className="w-full rounded-xl border-red-500/20 text-red-600 hover:bg-red-500/5" onClick={() => void onEscalate()}><CircleAlert className="h-4 w-4" /> Escalate to human</Button></div></ContextCard>
    <ContextCard title="AI context" icon={Sparkles}><p className="text-sm leading-6 text-muted-foreground">{thread.last_summary || "No saved summary yet. Tap Summarize to generate a concise staff brief from the full conversation history."}</p></ContextCard>
    <ContextCard title="CRM profile" icon={UserRound}><Detail label="Type" value={contact?.contact_type || "WhatsApp contact"} /><Detail label="Status" value={contact?.status || "Active"} /><Detail label="Email" value={contact?.email || "—"} /><Detail label="Student no." value={contact?.student_number || "—"} /><Detail label="Campus" value={contact?.campus || "—"} /><Detail label="Source" value={contact?.primary_source || "WhatsApp"} /></ContextCard>
    <ContextCard title="Application" icon={FileText}>{application ? <><Detail label="Status" value={application.status || "—"} /><Detail label="Funding" value={application.funding_type || "—"} /><Detail label="Move-in" value={application.move_in_date || "—"} /></> : <p className="text-xs text-muted-foreground">No linked accommodation application found.</p>}</ContextCard>
    <ContextCard title="Messaging window" icon={Clock3}><div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">24-hour service window</span><Badge variant={serviceWindow ? "default" : "outline"} className="rounded-full">{serviceWindow ? "Open" : "Template required"}</Badge></div>{thread.customer_window_expires_at && <p className="mt-2 text-[11px] text-muted-foreground">{serviceWindow ? "Closes" : "Closed"} {new Date(thread.customer_window_expires_at).toLocaleString("en-ZA")}</p>}</ContextCard>
    <ContextCard title="Tags" icon={MoreHorizontal}><div className="flex flex-wrap gap-1.5">{tags.length ? tags.map((tag, index) => <Badge key={index} variant="secondary" className="rounded-full">{String(tag)}</Badge>) : <span className="text-xs text-muted-foreground">No tags yet.</span>}</div></ContextCard>
    <ContextCard title="Internal notes" icon={Info}><div className="flex gap-2"><Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add private note" className="rounded-xl" onKeyDown={(e) => { if (e.key === "Enter") void onAddNote(); }} /><Button size="sm" className="rounded-xl" onClick={() => void onAddNote()} disabled={!noteText.trim()}>Add</Button></div>{notes.length ? <div className="mt-3 space-y-2">{notes.slice(0, 5).map((note) => <div key={note.id} className="rounded-xl bg-muted/60 p-2.5"><p className="text-xs leading-5">{note.body}</p><p className="mt-1 text-[9px] text-muted-foreground">{relativeTime(note.created_at)}</p></div>)}</div> : <p className="mt-3 text-xs text-muted-foreground">No internal notes yet.</p>}</ContextCard>
    <ContextCard title="Activity" icon={Clock3}>{activity.length ? <div className="space-y-3">{activity.slice(0, 8).map((item) => <div key={item.id} className="flex gap-2.5"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-foreground/50" /><div><p className="text-xs font-semibold">{activityLabel(item.event_type)}</p><p className="text-[10px] text-muted-foreground">{relativeTime(item.created_at)}</p></div></div>)}</div> : <p className="text-xs text-muted-foreground">No activity recorded yet.</p>}</ContextCard>
  </div>;
}

function SetupPanel({ integration, realtimeConnected }: { integration: any; realtimeConnected: boolean }) {
  const connected = integration?.status === "connected";
  return <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><div className="relative overflow-hidden rounded-[30px] border bg-gradient-to-br from-background to-emerald-500/5 p-6 shadow-sm"><div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><SenderAvatar className="h-20 w-20 rounded-[24px] shadow-xl ring-1 ring-black/5" /><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">WhatsApp Business</p><h3 className="mt-1 text-2xl font-black">ResKonnect Pty Ltd</h3><p className="mt-1 text-sm text-muted-foreground">Connecting Residents. Advancing Futures.</p></div></div><Badge variant={connected ? "default" : "outline"} className="w-fit rounded-full px-4 py-2">{connected ? "Connected · 3/3" : "Needs attention"}</Badge></div><div className="relative mt-6 grid gap-3 sm:grid-cols-4"><StatusTile icon={ShieldCheck} title="Provider" value={connected ? "Authenticated" : "Check setup"} good={connected} /><StatusTile icon={Wifi} title="Realtime" value={realtimeConnected ? "Live" : "Connecting"} good={realtimeConnected} /><StatusTile icon={Bot} title="AI" value="Luna active" good /><StatusTile icon={Paperclip} title="Media" value="Secure" good /></div><div className="relative mt-5 rounded-2xl border bg-background/70 p-4 backdrop-blur-xl"><p className="text-xs font-semibold">Sender account</p><p className="mt-1 text-sm text-muted-foreground">{integration?.external_account_label || "ResKonnect WhatsApp sender"}</p><p className="mt-3 text-xs font-semibold">AdminOS control plane</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Manual messaging, AI Auto, Assist drafts, human takeover, templates, secure attachments, notes, assignment, escalation and analytics are all enabled inside AdminOS.</p></div></div><div className="rounded-[30px] border bg-background p-6 shadow-sm"><p className="text-lg font-black">Production path</p><div className="mt-5 space-y-4"><FlowStep n="1" title="WhatsApp receives" text="Messages arrive on the verified ResKonnect business number." /><FlowStep n="2" title="Twilio transports" text="Webhooks and delivery receipts move securely through Twilio." /><FlowStep n="3" title="AdminOS operates" text="CRM context, staff replies, Luna Auto/Assist, media, notes and analytics happen here." /></div></div></div>;
}

function TemplatesPanel({ templates }: { templates: any[] }) {
  const approved = templates.filter((row) => row.status === "approved").length;
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><MetricCard title="Approved" value={approved} sub="Ready to send" icon={CheckCheck} /><MetricCard title="Pending" value={templates.filter((row) => row.status === "pending_approval").length} sub="Meta review" icon={Clock3} /><MetricCard title="Total" value={templates.length} sub="Content API templates" icon={FileText} /></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.length ? templates.map((template) => <div key={template.id} className="rounded-[26px] border bg-background p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10"><FileText className="h-5 w-5" /></div><TemplateStatus value={template.status} /></div><p className="mt-4 font-black">{template.display_name}</p><p className="mt-1 text-xs text-muted-foreground">{template.template_key}</p><p className="mt-4 text-sm leading-6 text-muted-foreground">{template.preview_text}</p>{template.content_sid && <p className="mt-4 truncate rounded-xl bg-muted/50 px-3 py-2 font-mono text-[10px] text-muted-foreground">{template.content_sid}</p>}</div>) : <div className="col-span-full rounded-[28px] border p-10 text-center text-sm text-muted-foreground">No WhatsApp templates configured.</div>}</div></div>;
}

function AutomationPanel({ threads, selectedThread, onMode }: { threads: Thread[]; selectedThread: Thread | null; onMode: (mode: ThreadMode) => Promise<void> }) {
  const modes: Array<{ mode: ThreadMode; title: string; text: string }> = [
    { mode: "ai_auto", title: "AI Auto", text: "Luna uses the full conversation history and replies automatically only when the response is green-risk." },
    { mode: "assist", title: "Assist", text: "Every new inbound message produces a Luna draft for staff review instead of sending automatically." },
    { mode: "human", title: "Human", text: "Automation pauses completely and staff own the conversation." },
    { mode: "escalated", title: "Escalated", text: "High-risk or manually escalated conversations are surfaced for human action." },
  ];
  return <div className="space-y-4">{selectedThread && <div className="rounded-[26px] border bg-background p-5 shadow-sm"><p className="text-sm font-black">Selected conversation control</p><p className="mt-1 text-xs text-muted-foreground">{displayName(selectedThread)}</p><div className="mt-4"><ModeControl mode={(selectedThread.mode || "ai_auto") as ThreadMode} onMode={onMode} /></div></div>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{modes.map((item) => { const count = threads.filter((thread) => (thread.mode || "ai_auto") === item.mode || (item.mode === "escalated" && thread.status === "escalated")).length; return <div key={item.mode} className="rounded-[26px] border bg-background p-5 shadow-sm"><div className="flex items-center justify-between"><ModeBadge mode={item.mode} /><span className="text-3xl font-black">{count}</span></div><p className="mt-5 font-black">{item.title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p></div>; })}</div></div>;
}

function AnalyticsPanel({ analytics }: { analytics: Analytics | null }) {
  if (!analytics) return <div className="rounded-[28px] border p-12 text-center text-sm text-muted-foreground">Analytics are loading.</div>;
  const t = analytics.totals || {};
  const max = Math.max(1, ...analytics.daily.map((row) => row.inbound + row.outbound));
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><MetricCard title="Conversations" value={t.conversations || 0} sub="All threads" icon={MessageCircle} /><MetricCard title="Open" value={t.open || 0} sub="Active workload" icon={Inbox} /><MetricCard title="AI Auto" value={t.ai_auto || 0} sub={`${Math.round((analytics.automation_share || 0) * 100)}% AI share`} icon={Sparkles} /><MetricCard title="Assist" value={t.assist || 0} sub="Draft-first" icon={Bot} /><MetricCard title="Delivery" value={Math.round((analytics.delivery_rate || 0) * 100)} sub="% delivered/read" icon={CheckCheck} /><MetricCard title="Avg response" value={analytics.average_first_response_seconds == null ? 0 : Math.round(analytics.average_first_response_seconds)} sub={analytics.average_first_response_seconds == null ? "No sample yet" : "seconds"} icon={Clock3} /></div><div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]"><div className="rounded-[30px] border bg-background p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="font-black">14-day message activity</p><p className="text-xs text-muted-foreground">Inbound vs outbound workload</p></div><Badge variant="outline" className="rounded-full">Live production</Badge></div><div className="mt-6 flex h-56 items-end gap-2">{analytics.daily.map((row) => { const total = row.inbound + row.outbound; return <div key={row.date} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="flex h-44 w-full items-end justify-center"><div className="w-full max-w-8 overflow-hidden rounded-t-lg bg-muted" style={{ height: `${Math.max(4, (total / max) * 100)}%` }}><div className="w-full bg-emerald-500/75" style={{ height: `${total ? (row.inbound / total) * 100 : 0}%` }} /></div></div><span className="text-[8px] text-muted-foreground">{row.date.slice(5)}</span></div>; })}</div><div className="mt-3 flex gap-4 text-[10px] text-muted-foreground"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Inbound</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-muted" />Outbound</span></div></div><div className="space-y-3"><StatLine label="Service windows open" value={t.service_windows_open || 0} /><StatLine label="Human replies" value={t.human_outbound || 0} /><StatLine label="AI replies" value={t.ai_outbound || 0} /><StatLine label="Escalated" value={t.escalated || 0} /><StatLine label="Failed/undelivered" value={t.failed || 0} /></div></div></div>;
}

function SenderAvatar({ className }: { className?: string }) { return <Avatar className={cn("bg-white", className)}><AvatarImage src="/icon-512.png" alt="ResKonnect" className="object-cover" /><AvatarFallback className="bg-background font-black">RK</AvatarFallback></Avatar>; }
function ContactAvatar({ thread, className }: { thread: Thread; className?: string }) { const avatar = thread.contact?.profile_picture_url || thread.contact?.metadata?.avatar_url || thread.contact?.metadata?.profile_picture_url || null; const name = displayName(thread); return <Avatar className={cn("bg-muted ring-1 ring-black/5", className)}>{avatar && <AvatarImage src={avatar} alt={name} className="object-cover" />}<AvatarFallback className="bg-gradient-to-br from-muted to-muted/60 text-xs font-black">{initials(name)}</AvatarFallback></Avatar>; }
function ModeBadge({ mode, compact = false }: { mode: ThreadMode; compact?: boolean }) { const styles: Record<ThreadMode, string> = { ai_auto: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300", assist: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300", human: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300", escalated: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300", closed: "border-muted bg-muted/60 text-muted-foreground" }; return <Badge variant="outline" className={cn("rounded-full font-bold", compact ? "h-5 px-2 text-[9px]" : "px-2.5 py-1 text-[10px]", styles[mode])}>{mode === "ai_auto" && <Sparkles className="mr-1 h-2.5 w-2.5" />}{modeLabel(mode)}</Badge>; }
function ModeDot({ mode }: { mode: ThreadMode }) { return <span className={cn("h-2 w-2 rounded-full", mode === "ai_auto" ? "bg-violet-500" : mode === "assist" ? "bg-sky-500" : mode === "human" ? "bg-amber-500" : mode === "escalated" ? "bg-red-500" : "bg-muted-foreground")} />; }
function DeliveryIcon({ status }: { status: string }) { if (["delivered", "read"].includes(status)) return <CheckCheck className={cn("h-3 w-3", status === "read" && "text-sky-300")} />; if (["sent", "queued", "sending"].includes(status)) return <Check className="h-3 w-3" />; if (["failed", "undelivered"].includes(status)) return <CircleAlert className="h-3 w-3" />; return null; }
function TemplateStatus({ value }: { value?: string }) { const approved = value === "approved"; const rejected = value === "rejected" || value === "provider_error"; return <Badge variant={approved ? "default" : rejected ? "destructive" : "outline"} className="rounded-full">{String(value || "unknown").replaceAll("_", " ")}</Badge>; }
function ContextCard({ title, icon: Icon, children }: { title: string; icon: any; children: any }) { return <div className="rounded-[20px] border bg-background/75 p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-xl bg-muted"><Icon className="h-3.5 w-3.5" /></div><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{title}</p></div>{children}</div>; }
function Detail({ label, value }: { label: string; value: any }) { return <div className="flex items-start justify-between gap-3 border-b py-2 last:border-0"><span className="text-xs text-muted-foreground">{label}</span><span className="max-w-[58%] break-words text-right text-xs font-semibold">{String(value || "—")}</span></div>; }
function StatusTile({ icon: Icon, title, value, good }: { icon: any; title: string; value: string; good?: boolean }) { return <div className="rounded-2xl border bg-background/75 p-4 backdrop-blur"><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><span className="text-xs font-semibold text-muted-foreground">{title}</span></div><div className="mt-3 flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", good ? "bg-emerald-500" : "bg-amber-500")} /><span className="text-sm font-black">{value}</span></div></div>; }
function FlowStep({ n, title, text }: { n: string; title: string; text: string }) { return <div className="flex gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-xs font-black text-background">{n}</div><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></div>; }
function MetricCard({ title, value, sub, icon: Icon }: { title: string; value: number; sub: string; icon: any }) { return <div className="rounded-[24px] border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><div className="grid h-9 w-9 place-items-center rounded-2xl bg-muted"><Icon className="h-4 w-4" /></div><span className="text-2xl font-black">{value}</span></div><p className="mt-4 text-sm font-black">{title}</p><p className="mt-1 text-[10px] text-muted-foreground">{sub}</p></div>; }
function StatLine({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between rounded-[20px] border bg-background p-4 shadow-sm"><span className="text-sm font-semibold text-muted-foreground">{label}</span><span className="text-2xl font-black">{value}</span></div>; }
function LoadingInbox() { return <div className="space-y-2 p-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex animate-pulse items-center gap-3 rounded-2xl p-3"><div className="h-12 w-12 rounded-full bg-muted" /><div className="flex-1"><div className="h-3 w-2/3 rounded bg-muted" /><div className="mt-2 h-2.5 w-full rounded bg-muted" /></div></div>)}</div>; }
function EmptyInbox() { return <div className="px-6 py-20 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-muted"><MessageCircle className="h-6 w-6 text-muted-foreground" /></div><p className="mt-4 font-black">Nothing here yet</p><p className="mt-1 text-xs leading-5 text-muted-foreground">New inbound WhatsApp conversations will appear here automatically.</p></div>; }
function NoConversation() { return <div className="grid min-h-[760px] place-items-center p-8"><div className="max-w-sm text-center"><SenderAvatar className="mx-auto h-20 w-20 rounded-[24px] shadow-xl" /><h3 className="mt-5 text-xl font-black">ResKonnect WhatsApp is ready</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Select a conversation to message manually, use Luna Assist, assign staff and manage the full customer journey.</p></div></div>; }
function displayName(thread: Thread) { return thread.contact?.full_name || thread.lastMessage?.metadata?.profile_name || thread.metadata?.profile_name || formatPhone(thread.channel_address) || "WhatsApp contact"; }
function initials(value: string) { const words = String(value || "RK").trim().split(/\s+/).filter(Boolean); return (words.slice(0, 2).map((word) => word[0]).join("") || "RK").toUpperCase(); }
function formatPhone(value?: string | null) { const raw = String(value || "").replace(/^whatsapp:/i, ""); if (raw.startsWith("+27") && raw.length === 12) return `+27 ${raw.slice(3, 5)} ${raw.slice(5, 8)} ${raw.slice(8)}`; return raw || "Unknown number"; }
function modeLabel(mode: ThreadMode | string) { return mode === "ai_auto" ? "AI Auto" : mode === "assist" ? "Assist" : mode === "human" ? "Human" : mode === "escalated" ? "Escalated" : "Closed"; }
function relativeTime(value?: string | null) { if (!value) return "—"; const ms = Date.now() - new Date(value).getTime(); if (ms < 60_000) return "now"; if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`; if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`; if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d`; return new Date(value).toLocaleDateString("en-ZA", { day: "2-digit", month: "short" }); }
function clockTime(value?: string | null) { if (!value) return ""; return new Date(value).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }); }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function activityLabel(value: string) { return String(value || "activity").replaceAll(".", " · ").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()); }
