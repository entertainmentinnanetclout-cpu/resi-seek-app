import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Bot, BrainCircuit, BriefcaseBusiness, Building2, CheckCircle2, FileSearch, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PublicQuickSearch from "@/components/PublicQuickSearch";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { EXTERNAL_SUPABASE_ANON_KEY, externalFunctionUrl, supabase } from "@/integrations/supabase/client";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const suggestions = [
  "Find accommodation near my campus within my budget",
  "What should I do next on ResKonnect?",
  "Help me understand my application readiness",
  "Show me bursaries, WIL or opportunities relevant to me",
];

const capabilities = [
  {
    icon: Building2,
    title: "Living intelligence",
    text: "Find and compare accommodation using verified ResKonnect listings, your preferences and live platform context.",
    to: "/living",
  },
  {
    icon: FileSearch,
    title: "Study & application guidance",
    text: "Use course, APS, application-readiness and document context without pretending to make institutional decisions.",
    to: "/apply",
  },
  {
    icon: BriefcaseBusiness,
    title: "Opportunity intelligence",
    text: "Discover verified bursaries, WIL pathways and published opportunities, with official routes when available.",
    to: "/opportunities",
  },
];

const ResKonnectAI = () => {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [input, setInput] = useState(params.get("q") || "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  const signedInLabel = useMemo(
    () => user ? "Signed in · account-aware answers enabled" : "Public mode · sign in for account-specific answers",
    [user],
  );

  const send = async (prompt?: string) => {
    const text = (prompt ?? input).trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const signedIn = Boolean(user && token);
      const response = await fetch(externalFunctionUrl(signedIn ? "adminos-enquiry" : "luna-agent"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EXTERNAL_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${signedIn ? token : EXTERNAL_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(
          signedIn
            ? { message: text, thread_id: threadId, metadata: { surface: "reskonnect_ai" } }
            : { action: "public_enquiry", message: text, context: { surface: "reskonnect_ai" } },
        ),
      });
      const data = await response.json().catch(() => ({}));
      const answer = String(data.response || data.answer || "").trim();
      if (!response.ok || !answer) {
        throw new Error(data.error || "ResKonnect AI could not complete this request.");
      }
      if (data.thread_id) setThreadId(String(data.thread_id));
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: answer }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ResKonnect AI is temporarily unavailable.";
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: `${message} You can still use Search ResKonnect or open the relevant Living, Applications or Opportunities service below.`,
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicLayout>
      <SEO
        title="ResKonnect AI | Grounded Student Guidance & Service Intelligence"
        description="Use ResKonnect AI across Living, applications and opportunities. Ask grounded questions, search ResKonnect services and get account-aware next-step guidance when signed in."
        keywords="ResKonnect AI, student AI South Africa, student accommodation AI, application guidance, opportunity matching"
        canonicalPath="/ai"
      />

      <main className="min-h-screen bg-background">
        <section className="relative overflow-hidden border-b bg-[radial-gradient(circle_at_80%_10%,hsl(var(--primary)/0.22),transparent_34%),linear-gradient(135deg,hsl(var(--brand-navy)),hsl(var(--command-navy)))] text-white">
          <div className="container mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.08fr_.92fr] lg:px-8">
            <div className="self-center">
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">RESKONNECT AI</Badge>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">Ask once. Move forward faster.</h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/75 sm:text-lg">
                Grounded guidance across Living, applications and opportunities — connected to ResKonnect data and your own account context when you are signed in.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <PublicQuickSearch label="Search ResKonnect" className="rounded-full" />
                {!user && <Button asChild size="lg" className="rounded-full bg-white text-slate-950 hover:bg-white/90"><Link to="/auth?returnTo=/ai">Sign in for personalised help</Link></Button>}
              </div>
              <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/70">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">Luna · website agent</span>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">Dimpho · WhatsApp agent</span>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">One ResKonnect AI layer</span>
              </div>
            </div>

            <Card className="border-white/15 bg-background/95 text-foreground shadow-2xl backdrop-blur-xl">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3 border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" /></div>
                    <div><p className="font-black">ResKonnect AI</p><p className="text-xs text-muted-foreground">{signedInLabel}</p></div>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>

                <div className="max-h-[360px] min-h-[230px] space-y-3 overflow-y-auto py-4">
                  {messages.length === 0 && (
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <p className="font-bold">What do you need?</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Ask naturally. ResKonnect AI will use verified platform context where available and will not invent protected decisions, prices, availability or outcomes.</p>
                    </div>
                  )}
                  {messages.map((message) => (
                    <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground" : "max-w-[92%] rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-sm leading-6"}>
                      {message.content}
                    </div>
                  ))}
                  {sending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking verified ResKonnect context…</div>}
                  <div ref={bottomRef} />
                </div>

                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void send(); } }}
                    placeholder="Ask about living, applications, opportunities or your next step…"
                    className="h-12"
                    disabled={sending}
                  />
                  <Button size="icon" className="h-12 w-12 shrink-0" onClick={() => void send()} disabled={!input.trim() || sending} aria-label="Send question">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void send(suggestion)} disabled={sending} className="rounded-full border px-3 py-1.5 text-left text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50">{suggestion}</button>)}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="container mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">One intelligence layer</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">Built around the full ResKonnect journey.</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">AI is a ResKonnect capability across the platform. Luna and Dimpho are channel agents underneath that capability, not separate products you need to learn.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {capabilities.map((item) => <Card key={item.title} className="h-full"><CardContent className="flex h-full flex-col p-6"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><item.icon className="h-5 w-5" /></div><h3 className="mt-4 text-lg font-black">{item.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{item.text}</p><Button asChild variant="link" className="mt-4 justify-start p-0"><Link to={item.to}>Open service <ArrowRight className="ml-1 h-4 w-4" /></Link></Button></CardContent></Card>)}
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="container mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
            <div className="rounded-2xl border bg-background p-5"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h3 className="mt-3 font-black">Grounded when data exists</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Live ResKonnect records are preferred over generic generated claims.</p></div>
            <div className="rounded-2xl border bg-background p-5"><ShieldCheck className="h-5 w-5 text-primary" /><h3 className="mt-3 font-black">Private context stays scoped</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Account-specific guidance is only available after authentication and remains scoped to your own records.</p></div>
            <div className="rounded-2xl border bg-background p-5"><Bot className="h-5 w-5 text-violet-600" /><h3 className="mt-3 font-black">Humans keep protected decisions</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Admissions, funding decisions, legal issues and other protected outcomes are not delegated to AI.</p></div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
};

export default ResKonnectAI;
