import { useCallback, useEffect, useMemo, useState } from "react";
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
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  Wifi,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ThreadMode = "ai_auto" | "assist" | "human" | "escalated" | "closed";
type DeskSection = "inbox" | "setup" | "templates" | "automation" | "analytics";
type InboxFilter = "all" | "unread" | "ai" | "human" | "escalated";

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
  metadata?: Record<string, any> | null;
  contact?: Contact | null;
  lastMessage?: Message | null;
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
  { value: "ai", label: "AI Active" },
  { value: "human", label: "Human" },
  { value: "escalated", label: "Escalated" },
];

export default function AdminOSWhatsAppDesk({ embedded = false }: Props) {
  const [section, setSection] = useState<DeskSection>("inbox");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [integration, setIntegration] = useState<any>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const loadDesk = useCallback(async () => {
    setLoading(true);
    try {
      const [threadRes, messageRes, templateRes, integrationRes] = await Promise.all([
        (supabase as any).from("adminos_whatsapp_threads").select("*").order("is_pinned", { ascending: false }).order("last_message_at", { ascending: false }).limit(150),
        (supabase as any).from("adminos_whatsapp_messages").select("*").order("created_at", { ascending: false }).limit(500),
        (supabase as any).from("adminos_whatsapp_templates").select("*").order("created_at", { ascending: true }),
        (supabase as any).from("adminos_integration_connections").select("*").eq("provider", "twilio_whatsapp").maybeSingle(),
      ]);
      const error = threadRes.error || messageRes.error || templateRes.error || integrationRes.error;
      if (error) throw error;

      const rawThreads = (threadRes.data || []) as Thread[];
      const rawMessages = (messageRes.data || []) as Message[];
      const contactIds = Array.from(new Set(rawThreads.map((row) => row.contact_id).filter(Boolean))) as string[];
      const contactMap = new Map<string, Contact>();
      if (contactIds.length) {
        const { data: contactRows, error: contactError } = await (supabase as any)
          .from("adminos_contacts")
          .select("id,profile_user_id,contact_type,full_name,email,phone,student_number,campus,status,primary_source,metadata")
          .in("id", contactIds);
        if (contactError) throw contactError;
        for (const contact of contactRows || []) contactMap.set(contact.id, contact);
      }

      const lastByThread = new Map<string, Message>();
      for (const message of rawMessages) if (!lastByThread.has(message.thread_id)) lastByThread.set(message.thread_id, message);
      const hydrated = rawThreads.map((thread) => ({
        ...thread,
        contact: thread.contact_id ? contactMap.get(thread.contact_id) || null : null,
        lastMessage: lastByThread.get(thread.id) || null,
      }));

      setThreads(hydrated);
      setRecentMessages(rawMessages);
      setTemplates(templateRes.data || []);
      setIntegration(integrationRes.data || null);
      setSelectedThreadId((current) => current && hydrated.some((row) => row.id === current) ? current : hydrated[0]?.id || null);
    } catch (error: any) {
      toast.error(error?.message || "Could not load WhatsApp Desk");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    setThreadLoading(true);
    try {
      const [messageRes, noteRes, threadRes] = await Promise.all([
        (supabase as any).from("adminos_whatsapp_messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(1000),
        (supabase as any).from("adminos_whatsapp_notes").select("*").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(20),
        (supabase as any).from("adminos_whatsapp_threads").select("*").eq("id", threadId).maybeSingle(),
      ]);
      const error = messageRes.error || noteRes.error || threadRes.error;
      if (error) throw error;
      setMessages(messageRes.data || []);
      setNotes(noteRes.data || []);

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
          const { data: apps } = await (supabase as any)
            .from("applications")
            .select("id,status,funding_type,application_date,move_in_date,moved_in,residence_id")
            .eq("user_id", contact.profile_user_id)
            .order("created_at", { ascending: false })
            .limit(1);
          application = apps?.[0] || null;
        }
      }
      setSelectedContact(contact);
      setSelectedApplication(application);

      if ((thread?.unread_count || 0) > 0) {
        await (supabase as any).from("adminos_whatsapp_threads").update({ unread_count: 0, updated_at: new Date().toISOString() }).eq("id", threadId);
      }
    } catch (error: any) {
      toast.error(error?.message || "Could not load conversation");
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => { void loadDesk(); }, [loadDesk]);
  useEffect(() => {
    if (selectedThreadId) void loadThread(selectedThreadId);
    else { setMessages([]); setNotes([]); setSelectedContact(null); setSelectedApplication(null); }
  }, [selectedThreadId, loadThread]);

  useEffect(() => {
    const channel = (supabase as any)
      .channel("adminos-whatsapp-desk-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "adminos_whatsapp_threads" }, () => { void loadDesk(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "adminos_whatsapp_messages" }, (payload: any) => {
        void loadDesk();
        const threadId = payload?.new?.thread_id || payload?.old?.thread_id;
        if (threadId && threadId === selectedThreadId) void loadThread(threadId);
      })
      .subscribe((status: string) => setRealtimeConnected(status === "SUBSCRIBED"));
    return () => { void (supabase as any).removeChannel(channel); };
  }, [loadDesk, loadThread, selectedThreadId]);

  const selectedThread = useMemo(() => threads.find((row) => row.id === selectedThreadId) || null, [threads, selectedThreadId]);
  const filteredThreads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return threads.filter((thread) => {
      const mode = thread.mode || "ai_auto";
      if (filter === "unread" && !thread.unread_count) return false;
      if (filter === "ai" && mode !== "ai_auto") return false;
      if (filter === "human" && !["human", "assist"].includes(mode)) return false;
      if (filter === "escalated" && mode !== "escalated" && thread.status !== "escalated") return false;
      if (!needle) return true;
      const haystack = [displayName(thread), thread.channel_address, thread.contact?.email, thread.contact?.student_number, thread.lastMessage?.body_text].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [threads, filter, search]);

  const unreadTotal = threads.reduce((sum, row) => sum + Number(row.unread_count || 0), 0);
  const aiActive = threads.filter((row) => (row.mode || "ai_auto") === "ai_auto").length;
  const escalated = threads.filter((row) => row.status === "escalated" || row.mode === "escalated").length;
  const aiReplies = recentMessages.filter((row) => row.direction === "outbound" && row.metadata?.author_type === "ai").length;
  const delivered = recentMessages.filter((row) => ["delivered", "read"].includes(String(row.status))).length;

  return (
    <div className={cn("space-y-5", embedded && "space-y-4")}>
      {!embedded && (
        <section className="relative overflow-hidden rounded-[32px] border bg-gradient-to-br from-background via-background to-muted/45 p-5 shadow-sm sm:p-7">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <SenderAvatar className="h-14 w-14 rounded-[18px] shadow-lg ring-1 ring-black/5" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp Desk</Badge>
                  <Badge variant="outline" className="rounded-full">Phase 1/5 + 2/5 complete</Badge>
                  <Badge variant={integration?.status === "connected" ? "default" : "outline"} className="rounded-full">{integration?.status === "connected" ? "Sender live" : "Provider attention"}</Badge>
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">ResKonnect Messages</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">A premium, real-time operating inbox for WhatsApp conversations, customer context and AI visibility. Twilio remains the transport layer; AdminOS is the workspace.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border bg-background/80 px-3 py-2 text-xs font-medium shadow-sm backdrop-blur-xl">
                <span className={cn("h-2 w-2 rounded-full", realtimeConnected ? "bg-emerald-500" : "bg-amber-500")} />
                {realtimeConnected ? "Live sync" : "Connecting"}
              </div>
              <Button variant="outline" className="rounded-full bg-background/80 backdrop-blur-xl" onClick={() => void loadDesk()} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
              </Button>
            </div>
          </div>
        </section>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-2xl border bg-muted/40 p-1.5 shadow-sm backdrop-blur-xl">
        {sections.map((item) => (
          <button key={item.value} type="button" onClick={() => setSection(item.value)} className={cn("flex min-w-max items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all", section === item.value ? "bg-background text-foreground shadow-sm ring-1 ring-black/5" : "text-muted-foreground hover:text-foreground")}>
            <item.icon className="h-4 w-4" /> {item.label}
          </button>
        ))}
      </div>

      {section === "inbox" && (
        <div className="grid min-h-[730px] overflow-hidden rounded-[30px] border bg-background shadow-[0_22px_70px_-42px_rgba(0,0,0,0.35)] md:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)_330px]">
          <aside className={cn("min-w-0 flex-col border-r bg-muted/20 md:flex", mobileChatOpen ? "hidden" : "flex")}>
            <div className="border-b bg-background/80 p-4 backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-lg font-black tracking-tight">Messages</p><p className="text-xs text-muted-foreground">{threads.length} conversations · {unreadTotal} unread</p></div>
                <div className="grid h-9 w-9 place-items-center rounded-full border bg-background shadow-sm"><MessageCircle className="h-4 w-4" /></div>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="h-11 rounded-2xl border-0 bg-muted/70 pl-9 shadow-none focus-visible:ring-1" />
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                {filters.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", filter === item.value ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}>{item.label}</button>)}
              </div>
            </div>
            <ScrollArea className="h-[620px] flex-1">
              {loading ? <LoadingInbox /> : filteredThreads.length ? (
                <div className="p-2">
                  {filteredThreads.map((thread) => (
                    <ConversationRow key={thread.id} thread={thread} selected={thread.id === selectedThreadId} onClick={() => { setSelectedThreadId(thread.id); setMobileChatOpen(true); }} />
                  ))}
                </div>
              ) : <EmptyInbox />}
            </ScrollArea>
          </aside>

          <main className={cn("min-w-0 flex-col bg-gradient-to-b from-muted/15 to-background md:flex", mobileChatOpen ? "flex" : "hidden")}>
            {selectedThread ? (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/80 px-3 py-3 backdrop-blur-2xl sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Button variant="ghost" size="icon" className="rounded-full md:hidden" onClick={() => setMobileChatOpen(false)}><ArrowLeft className="h-5 w-5" /></Button>
                    <ContactAvatar thread={selectedThread} className="h-10 w-10" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><p className="truncate font-bold">{displayName(selectedThread)}</p><ModeDot mode={(selectedThread.mode || "ai_auto") as ThreadMode} /></div>
                      <p className="truncate text-xs text-muted-foreground">{formatPhone(selectedThread.channel_address)} · {modeLabel(selectedThread.mode || "ai_auto")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ModeBadge mode={(selectedThread.mode || "ai_auto") as ThreadMode} />
                    <Sheet>
                      <SheetTrigger asChild><Button variant="outline" size="icon" className="rounded-full xl:hidden"><Info className="h-4 w-4" /></Button></SheetTrigger>
                      <SheetContent className="w-[92vw] max-w-md overflow-y-auto"><SheetHeader><SheetTitle>Conversation context</SheetTitle></SheetHeader><ContextPanel thread={selectedThread} contact={selectedContact} application={selectedApplication} notes={notes} /></SheetContent>
                    </Sheet>
                  </div>
                </div>

                <ScrollArea className="h-[570px] flex-1">
                  <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-end px-4 py-6 sm:px-6">
                    <div className="mb-6 flex justify-center"><span className="rounded-full border bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">End-to-end business messaging via ResKonnect AdminOS</span></div>
                    {threadLoading && !messages.length ? <div className="py-20 text-center text-sm text-muted-foreground">Loading conversation…</div> : messages.length ? messages.map((message) => <MessageBubble key={message.id} message={message} />) : <div className="py-24 text-center"><MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 font-semibold">No messages in this thread yet</p></div>}
                  </div>
                </ScrollArea>

                <div className="border-t bg-background/85 p-3 backdrop-blur-2xl sm:p-4">
                  <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-[24px] border bg-muted/35 p-2 shadow-sm">
                    <div className="min-w-0 flex-1 px-3 py-2">
                      <p className="text-sm font-medium text-muted-foreground">Manual reply composer activates in Phase 3</p>
                      <p className="text-[11px] text-muted-foreground/80">Phase 1–2 is live reading, context, realtime sync and AI visibility.</p>
                    </div>
                    <Button disabled className="h-10 rounded-full px-4"><MessageCircle className="h-4 w-4" /> Reply</Button>
                  </div>
                </div>
              </>
            ) : <NoConversation />}
          </main>

          <aside className="hidden min-w-0 border-l bg-muted/15 xl:block">
            <ScrollArea className="h-[730px]"><ContextPanel thread={selectedThread} contact={selectedContact} application={selectedApplication} notes={notes} /></ScrollArea>
          </aside>
        </div>
      )}

      {section === "setup" && <SetupPanel integration={integration} realtimeConnected={realtimeConnected} />}
      {section === "templates" && <TemplatesPanel templates={templates} />}
      {section === "automation" && <AutomationPanel threads={threads} />}
      {section === "analytics" && <AnalyticsPanel threads={threads} messages={recentMessages} aiReplies={aiReplies} delivered={delivered} escalated={escalated} />}
    </div>
  );
}

function ConversationRow({ thread, selected, onClick }: { thread: Thread; selected: boolean; onClick: () => void }) {
  const unread = Number(thread.unread_count || 0);
  return (
    <button type="button" onClick={onClick} className={cn("group mb-1 flex w-full items-center gap-3 rounded-[20px] p-3 text-left transition-all", selected ? "bg-background shadow-sm ring-1 ring-black/5" : "hover:bg-background/75")}>
      <ContactAvatar thread={thread} className="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("truncate text-sm", unread ? "font-extrabold" : "font-semibold")}>{displayName(thread)}</p>
          <span className={cn("shrink-0 text-[10px]", unread ? "font-bold text-foreground" : "text-muted-foreground")}>{relativeTime(thread.last_message_at)}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <p className={cn("min-w-0 flex-1 truncate text-xs", unread ? "font-semibold text-foreground" : "text-muted-foreground")}>{thread.lastMessage?.direction === "outbound" ? "You: " : ""}{thread.lastMessage?.body_text || "New WhatsApp conversation"}</p>
          {unread > 0 && <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
        </div>
        <div className="mt-2 flex items-center gap-1.5"><ModeBadge mode={(thread.mode || "ai_auto") as ThreadMode} compact />{thread.priority && thread.priority !== "normal" && <Badge variant="outline" className="h-5 rounded-full px-2 text-[9px] uppercase">{thread.priority}</Badge>}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";
  const authorType = message.metadata?.author_type || (outbound && message.metadata?.source === "whatsapp_auto_reply" ? "ai" : outbound ? "human" : "contact");
  return (
    <div className={cn("mb-2 flex", outbound ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[84%] sm:max-w-[72%]")}>
        {outbound && authorType === "ai" && <div className="mb-1 flex justify-end"><span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300"><Sparkles className="h-2.5 w-2.5" /> Luna AI</span></div>}
        <div className={cn("rounded-[22px] px-4 py-2.5 shadow-sm", outbound ? "rounded-br-md bg-foreground text-background" : "rounded-bl-md border bg-background")}>
          {message.body_text && <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body_text}</p>}
          {Array.isArray(message.media) && message.media.length > 0 && <div className="mt-2 space-y-1">{message.media.map((item, index) => <div key={index} className="rounded-xl bg-black/5 px-3 py-2 text-xs">Attachment · {item?.content_type || "media"}</div>)}</div>}
          <div className={cn("mt-1.5 flex items-center justify-end gap-1 text-[9px]", outbound ? "text-background/65" : "text-muted-foreground")}>{clockTime(message.sent_at || message.received_at || message.created_at)}{outbound && <DeliveryIcon status={String(message.status || "sent")} />}</div>
        </div>
      </div>
    </div>
  );
}

function ContextPanel({ thread, contact, application, notes }: { thread: Thread | null; contact: Contact | null; application: any; notes: any[] }) {
  if (!thread) return <div className="p-6 text-sm text-muted-foreground">Select a conversation to see customer context.</div>;
  const serviceWindow = thread.customer_window_expires_at ? new Date(thread.customer_window_expires_at).getTime() > Date.now() : false;
  const tags = Array.isArray(thread.tags) ? thread.tags : [];
  return (
    <div className="space-y-5 p-5">
      <div className="text-center">
        <ContactAvatar thread={{ ...thread, contact }} className="mx-auto h-20 w-20 shadow-md ring-4 ring-background" />
        <p className="mt-3 text-lg font-black">{contact?.full_name || displayName(thread)}</p>
        <p className="text-xs text-muted-foreground">{formatPhone(thread.channel_address)}</p>
        <div className="mt-3 flex justify-center gap-2"><ModeBadge mode={(thread.mode || "ai_auto") as ThreadMode} /><Badge variant="outline" className="rounded-full">{thread.status}</Badge></div>
      </div>

      <ContextCard title="AI context" icon={Sparkles}>
        <p className="text-sm leading-6 text-muted-foreground">{thread.last_summary || "A live conversation summary will appear here as AdminOS learns more from this thread."}</p>
      </ContextCard>

      <ContextCard title="CRM profile" icon={UserRound}>
        <Detail label="Type" value={contact?.contact_type || "WhatsApp contact"} />
        <Detail label="Status" value={contact?.status || "Active"} />
        <Detail label="Email" value={contact?.email || "—"} />
        <Detail label="Student no." value={contact?.student_number || "—"} />
        <Detail label="Campus" value={contact?.campus || "—"} />
        <Detail label="Source" value={contact?.primary_source || "WhatsApp"} />
      </ContextCard>

      <ContextCard title="Application" icon={FileText}>
        {application ? <><Detail label="Status" value={application.status || "—"} /><Detail label="Funding" value={application.funding_type || "—"} /><Detail label="Move-in" value={application.move_in_date || "—"} /></> : <p className="text-xs text-muted-foreground">No linked accommodation application found.</p>}
      </ContextCard>

      <ContextCard title="Messaging window" icon={Clock3}>
        <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">24-hour service window</span><Badge variant={serviceWindow ? "default" : "outline"} className="rounded-full">{serviceWindow ? "Open" : "Template required"}</Badge></div>
        {thread.customer_window_expires_at && <p className="mt-2 text-[11px] text-muted-foreground">{serviceWindow ? "Closes" : "Closed"} {new Date(thread.customer_window_expires_at).toLocaleString("en-ZA")}</p>}
      </ContextCard>

      <ContextCard title="Tags" icon={UsersRound}>
        <div className="flex flex-wrap gap-1.5">{tags.length ? tags.map((tag, index) => <Badge key={index} variant="secondary" className="rounded-full">{String(tag)}</Badge>) : <span className="text-xs text-muted-foreground">No tags yet.</span>}</div>
      </ContextCard>

      <ContextCard title="Internal notes" icon={Info}>
        {notes.length ? <div className="space-y-2">{notes.slice(0, 4).map((note) => <div key={note.id} className="rounded-xl bg-muted/60 p-2.5"><p className="text-xs leading-5">{note.body}</p><p className="mt-1 text-[9px] text-muted-foreground">{relativeTime(note.created_at)}</p></div>)}</div> : <p className="text-xs text-muted-foreground">No internal notes yet. Note creation activates in Phase 3.</p>}
      </ContextCard>
    </div>
  );
}

function SetupPanel({ integration, realtimeConnected }: { integration: any; realtimeConnected: boolean }) {
  const connected = integration?.status === "connected";
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <div className="relative overflow-hidden rounded-[30px] border bg-gradient-to-br from-background to-emerald-500/5 p-6 shadow-sm">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4"><SenderAvatar className="h-20 w-20 rounded-[24px] shadow-xl ring-1 ring-black/5" /><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">WhatsApp Business</p><h3 className="mt-1 text-2xl font-black">ResKonnect Pty Ltd</h3><p className="mt-1 text-sm text-muted-foreground">Connecting Residents. Advancing Futures.</p></div></div>
          <Badge variant={connected ? "default" : "outline"} className="w-fit rounded-full px-4 py-2">{connected ? "Connected · 3/3" : "Needs attention"}</Badge>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <StatusTile icon={ShieldCheck} title="Provider" value={connected ? "Authenticated" : "Check setup"} good={connected} />
          <StatusTile icon={Wifi} title="Realtime" value={realtimeConnected ? "Live" : "Connecting"} good={realtimeConnected} />
          <StatusTile icon={Bot} title="Auto reply" value="Luna active" good />
        </div>
        <div className="relative mt-5 rounded-2xl border bg-background/70 p-4 backdrop-blur-xl"><p className="text-xs font-semibold">Sender account</p><p className="mt-1 text-sm text-muted-foreground">{integration?.external_account_label || "ResKonnect WhatsApp sender"}</p><p className="mt-3 text-xs font-semibold">Profile picture</p><p className="mt-1 text-sm text-muted-foreground">ResKonnect brand icon has been submitted to the WhatsApp sender profile. Meta/Twilio may briefly show the sender as updating while the profile refresh propagates.</p></div>
      </div>
      <div className="rounded-[30px] border bg-background p-6 shadow-sm">
        <p className="text-lg font-black">Production path</p>
        <div className="mt-5 space-y-4">
          <FlowStep n="1" title="WhatsApp receives" text="Messages arrive on the verified ResKonnect business number." />
          <FlowStep n="2" title="Twilio transports" text="The production webhook sends inbound events to Supabase." />
          <FlowStep n="3" title="AdminOS operates" text="CRM resolution, realtime inbox, Luna responses and escalations happen here." />
        </div>
      </div>
    </div>
  );
}

function TemplatesPanel({ templates }: { templates: any[] }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.length ? templates.map((template) => <div key={template.id} className="rounded-[26px] border bg-background p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10"><FileText className="h-5 w-5" /></div><TemplateStatus value={template.status} /></div><p className="mt-4 font-black">{template.display_name}</p><p className="mt-1 text-xs text-muted-foreground">{template.template_key}</p><p className="mt-4 text-sm leading-6 text-muted-foreground">{template.preview_text}</p>{template.content_sid && <p className="mt-4 truncate rounded-xl bg-muted/50 px-3 py-2 font-mono text-[10px] text-muted-foreground">{template.content_sid}</p>}</div>) : <div className="col-span-full rounded-[28px] border p-10 text-center text-sm text-muted-foreground">No WhatsApp templates configured.</div>}</div>;
}

function AutomationPanel({ threads }: { threads: Thread[] }) {
  const modes: Array<{ mode: ThreadMode; title: string; text: string }> = [
    { mode: "ai_auto", title: "AI Auto", text: "Luna handles safe green-risk conversations automatically." },
    { mode: "assist", title: "Assist", text: "AI prepares the next action while a human remains in control." },
    { mode: "human", title: "Human", text: "Automation pauses and the assigned staff member owns the thread." },
    { mode: "escalated", title: "Escalated", text: "The conversation requires staff attention before continuing." },
  ];
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{modes.map((item) => { const count = threads.filter((thread) => (thread.mode || "ai_auto") === item.mode).length; return <div key={item.mode} className="rounded-[26px] border bg-background p-5 shadow-sm"><div className="flex items-center justify-between"><ModeBadge mode={item.mode} /><span className="text-3xl font-black">{count}</span></div><p className="mt-5 font-black">{item.title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p><p className="mt-4 text-[11px] text-muted-foreground">Mode switching and human takeover controls activate in Phase 4.</p></div>; })}</div>;
}

function AnalyticsPanel({ threads, messages, aiReplies, delivered, escalated }: { threads: Thread[]; messages: Message[]; aiReplies: number; delivered: number; escalated: number }) {
  const inbound = messages.filter((row) => row.direction === "inbound").length;
  const read = messages.filter((row) => row.status === "read").length;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard title="Conversations" value={threads.length} sub="Live threads" icon={MessageCircle} /><MetricCard title="Inbound" value={inbound} sub="Recent messages" icon={Inbox} /><MetricCard title="AI replies" value={aiReplies} sub="Luna-authored" icon={Sparkles} /><MetricCard title="Delivered / read" value={delivered + read} sub="Recent outbound state" icon={CheckCheck} /><MetricCard title="Escalated" value={escalated} sub="Needs staff attention" icon={CircleAlert} /></div>;
}

function SenderAvatar({ className }: { className?: string }) {
  return <Avatar className={cn("bg-white", className)}><AvatarImage src="/icon-512.png" alt="ResKonnect" className="object-cover" /><AvatarFallback className="bg-background font-black">RK</AvatarFallback></Avatar>;
}

function ContactAvatar({ thread, className }: { thread: Thread; className?: string }) {
  const avatar = thread.contact?.metadata?.avatar_url || thread.contact?.metadata?.profile_picture_url || null;
  const name = displayName(thread);
  return <Avatar className={cn("bg-muted ring-1 ring-black/5", className)}>{avatar && <AvatarImage src={avatar} alt={name} className="object-cover" />}<AvatarFallback className="bg-gradient-to-br from-muted to-muted/60 text-xs font-black">{initials(name)}</AvatarFallback></Avatar>;
}

function ModeBadge({ mode, compact = false }: { mode: ThreadMode; compact?: boolean }) {
  const styles: Record<ThreadMode, string> = {
    ai_auto: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    assist: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    human: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    escalated: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
    closed: "border-muted bg-muted/60 text-muted-foreground",
  };
  return <Badge variant="outline" className={cn("rounded-full font-bold", compact ? "h-5 px-2 text-[9px]" : "px-2.5 py-1 text-[10px]", styles[mode])}>{mode === "ai_auto" && <Sparkles className="mr-1 h-2.5 w-2.5" />}{modeLabel(mode)}</Badge>;
}

function ModeDot({ mode }: { mode: ThreadMode }) {
  return <span className={cn("h-2 w-2 rounded-full", mode === "ai_auto" ? "bg-violet-500" : mode === "assist" ? "bg-sky-500" : mode === "human" ? "bg-amber-500" : mode === "escalated" ? "bg-red-500" : "bg-muted-foreground")} />;
}

function DeliveryIcon({ status }: { status: string }) {
  if (["delivered", "read"].includes(status)) return <CheckCheck className={cn("h-3 w-3", status === "read" && "text-sky-300")} />;
  if (["sent", "queued", "sending"].includes(status)) return <Check className="h-3 w-3" />;
  if (["failed", "undelivered"].includes(status)) return <CircleAlert className="h-3 w-3" />;
  return null;
}

function TemplateStatus({ value }: { value?: string }) {
  const approved = value === "approved";
  const rejected = value === "rejected" || value === "provider_error";
  return <Badge variant={approved ? "default" : rejected ? "destructive" : "outline"} className="rounded-full">{String(value || "unknown").replaceAll("_", " ")}</Badge>;
}

function ContextCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return <div className="rounded-[20px] border bg-background/75 p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-xl bg-muted"><Icon className="h-3.5 w-3.5" /></div><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{title}</p></div>{children}</div>;
}

function Detail({ label, value }: { label: string; value: any }) {
  return <div className="flex items-start justify-between gap-3 border-b py-2 last:border-0"><span className="text-xs text-muted-foreground">{label}</span><span className="max-w-[58%] break-words text-right text-xs font-semibold">{String(value || "—")}</span></div>;
}

function StatusTile({ icon: Icon, title, value, good }: { icon: any; title: string; value: string; good?: boolean }) {
  return <div className="rounded-2xl border bg-background/75 p-4 backdrop-blur"><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><span className="text-xs font-semibold text-muted-foreground">{title}</span></div><div className="mt-3 flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", good ? "bg-emerald-500" : "bg-amber-500")} /><span className="text-sm font-black">{value}</span></div></div>;
}

function FlowStep({ n, title, text }: { n: string; title: string; text: string }) {
  return <div className="flex gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-xs font-black text-background">{n}</div><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></div>;
}

function MetricCard({ title, value, sub, icon: Icon }: { title: string; value: number; sub: string; icon: any }) {
  return <div className="rounded-[26px] border bg-background p-5 shadow-sm"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted"><Icon className="h-4 w-4" /></div><span className="text-3xl font-black">{value}</span></div><p className="mt-5 font-black">{title}</p><p className="mt-1 text-xs text-muted-foreground">{sub}</p></div>;
}

function LoadingInbox() {
  return <div className="space-y-2 p-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex animate-pulse items-center gap-3 rounded-2xl p-3"><div className="h-12 w-12 rounded-full bg-muted" /><div className="flex-1"><div className="h-3 w-2/3 rounded bg-muted" /><div className="mt-2 h-2.5 w-full rounded bg-muted" /></div></div>)}</div>;
}

function EmptyInbox() {
  return <div className="px-6 py-20 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-muted"><MessageCircle className="h-6 w-6 text-muted-foreground" /></div><p className="mt-4 font-black">Nothing here yet</p><p className="mt-1 text-xs leading-5 text-muted-foreground">New inbound WhatsApp conversations will appear here automatically.</p></div>;
}

function NoConversation() {
  return <div className="grid min-h-[730px] place-items-center p-8"><div className="max-w-sm text-center"><SenderAvatar className="mx-auto h-20 w-20 rounded-[24px] shadow-xl" /><h3 className="mt-5 text-xl font-black">ResKonnect WhatsApp is ready</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Select a conversation to open the live message history, AI state and CRM context.</p></div></div>;
}

function displayName(thread: Thread) {
  return thread.contact?.full_name || thread.lastMessage?.metadata?.profile_name || thread.metadata?.profile_name || formatPhone(thread.channel_address) || "WhatsApp contact";
}

function initials(value: string) {
  const words = String(value || "RK").trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join("") || "RK").toUpperCase();
}

function formatPhone(value?: string | null) {
  const raw = String(value || "").replace(/^whatsapp:/i, "");
  if (raw.startsWith("+27") && raw.length === 12) return `+27 ${raw.slice(3, 5)} ${raw.slice(5, 8)} ${raw.slice(8)}`;
  return raw || "Unknown number";
}

function modeLabel(mode: ThreadMode | string) {
  return mode === "ai_auto" ? "AI Auto" : mode === "assist" ? "Assist" : mode === "human" ? "Human" : mode === "escalated" ? "Escalated" : "Closed";
}

function relativeTime(value?: string | null) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  if (ms < 60_000) return "now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d`;
  return new Date(value).toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });
}

function clockTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}
