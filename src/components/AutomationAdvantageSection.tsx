import { ArrowRight, Bot, Building2, CheckCircle2, Clock3, FileCheck2, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const whatsappHref="https://wa.me/27637323192?text=Hi%20ResKonnect";

export default function AutomationAdvantageSection(){
  return <section className="relative overflow-hidden border-y bg-gradient-to-br from-emerald-500/[.05] via-background to-violet-500/[.05] py-12 md:py-18">
    <div className="pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl"/>
    <div className="pointer-events-none absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl"/>
    <div className="container relative mx-auto grid gap-9 px-4 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8">
      <div>
        <div className="flex flex-wrap gap-2"><Badge className="rounded-full gap-1.5 px-3 py-1"><Sparkles className="h-3.5 w-3.5"/> Automation-first support</Badge><Badge variant="outline" className="rounded-full px-3 py-1">Luna + WhatsApp + Human handoff</Badge></div>
        <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-[-.035em] md:text-5xl">Get help in seconds, not office hours.</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">ResKonnect now uses AI-assisted WhatsApp support to route accommodation, application and WIL enquiries immediately. Luna can guide routine steps, read current ResKonnect listing data and hand the full conversation to a human when judgement is required.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Feature icon={MessageCircle} title="Immediate WhatsApp assistance" text="Interactive menus and guided replies start as soon as you message us."/>
          <Feature icon={Building2} title="Live accommodation data" text="Current residence images, rent, location and availability feed Luna's responses."/>
          <Feature icon={FileCheck2} title="Application & WIL updates" text="Track routine status, missing-document guidance and next steps from WhatsApp."/>
          <Feature icon={ShieldCheck} title="Human when it matters" text="Protected decisions, partnerships and unusual cases are escalated with context attached."/>
        </div>
        <div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg" className="rounded-full"><a href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4"/>Chat to ResKonnect</a></Button><Button asChild size="lg" variant="outline" className="rounded-full"><Link to="/get-started">Explore ResKonnect <ArrowRight className="h-4 w-4"/></Link></Button></div>
        <p className="mt-4 text-xs text-muted-foreground">Built to set a higher service-speed standard for student and property services in Africa — without replacing human judgement where it is required.</p>
      </div>

      <div className="mx-auto w-full max-w-[440px] rounded-[38px] border-[6px] border-foreground/90 bg-background p-2 shadow-[0_38px_80px_-38px_rgba(0,0,0,.58)]">
        <div className="overflow-hidden rounded-[28px] border bg-muted/15"><div className="flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur-xl"><img src="/icon-512.png" alt="ResKonnect" className="h-10 w-10 rounded-full bg-white object-cover ring-1 ring-black/5"/><div className="min-w-0 flex-1"><p className="text-sm font-black">ResKonnect</p><p className="text-[10px] text-emerald-600">Business · Luna available</p></div><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"/></div><div className="space-y-3 bg-gradient-to-b from-emerald-500/[.04] to-background p-4">
          <Bubble>Hi 👋 Thanks for contacting ResKonnect. How can we help you today?</Bubble>
          <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">{["Accommodation","Applications","WIL & Opportunities","Our services"].map((label,i)=><div key={label} className="flex items-center gap-2 border-b px-3 py-3 last:border-0"><span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/10 text-[10px] font-black text-emerald-700">{i+1}</span><span className="flex-1 text-xs font-bold">{label}</span><ArrowRight className="h-3 w-3 text-muted-foreground"/></div>)}</div>
          <div className="ml-auto max-w-[84%] rounded-[18px] rounded-tr-md bg-emerald-500 px-4 py-2.5 text-sm text-white">I need TUT accommodation for 2027, NSFAS funded.</div>
          <Bubble><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-violet-500"/><strong>Luna</strong></div><p className="mt-2">Perfect. I’ll narrow the live ResKonnect listings and show the best matching options with current images and details.</p></Bubble>
          <div className="flex items-center justify-center gap-2 py-1 text-[10px] font-semibold text-muted-foreground"><Clock3 className="h-3 w-3"/>Automated routing · real listing data · human fallback</div>
        </div></div>
      </div>
    </div>
  </section>;
}

function Feature({icon:Icon,title,text}:{icon:any;title:string;text:string}){return <div className="rounded-[22px] border bg-background/75 p-4 shadow-sm backdrop-blur"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-muted"><Icon className="h-4 w-4"/></div><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></div></div>;}
function Bubble({children}:{children:any}){return <div className="max-w-[88%] rounded-[18px] rounded-tl-md border bg-background p-3 text-xs leading-5 shadow-sm">{children}</div>;}
