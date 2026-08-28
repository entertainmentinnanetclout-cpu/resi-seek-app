import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, HelpCircle, ShieldCheck, Sparkles, Target } from "lucide-react";
import { BRAND } from "@/constants/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function SpecialistUserManual({ title, roleLabel, basePath }: { title: string; roleLabel: string; basePath: string }) {
  const [open, setOpen] = useState(false);
  const guide = useMemo(() => {
    if (basePath.includes("tvet")) return {
      purpose: "Operate TVET applicant intake, recruiter attribution and application readiness without duplicating student records.",
      steps: ["Start with the application queue and filter by status or recruiter.", "Verify the applicant's identity/contact details before changing a workflow outcome.", "Use the same canonical application record instead of recreating an applicant.", "Keep recruiter attribution intact so conversion reporting remains accurate."],
      examples: [["Queue", "Applicant → Ready"], ["Identity", "Student # / SA ID"], ["Attribution", "Recruiter → Outcome"]],
      rules: ["Do not invent missing applicant details", "Do not create duplicate applications", "Protect private student information", "Escalate integrity conflicts to GOD MODE"],
    };
    if (basePath.includes("media")) return {
      purpose: "Publish clear, current ResKonnect content while protecting brand quality and conversion routes.",
      steps: ["Review the active hero, banners, news, events and bursary content before publishing.", "Use high-contrast copy and current destination links.", "Keep campaign imagery consistent with ResKonnect branding and mobile-safe crops.", "Remove or disable expired content instead of leaving broken calls to action live."],
      examples: [["Creative", "Preview → Publish"], ["CTA", "One clear action"], ["Quality", "Mobile + Desktop"]],
      rules: ["No fake dates or claims", "Do not publish blurry assets", "Keep CTA links current", "Use approved ResKonnect identity"],
    };
    if (basePath.includes("commerce")) return {
      purpose: "Operate commercial content, offers and order surfaces with accurate pricing and controlled status changes.",
      steps: ["Check active products/offers and their live pricing.", "Review pending commercial actions and fulfilment states.", "Use verified promotion dates and clear terms.", "Resolve exceptions instead of manually bypassing system status controls."],
      examples: [["Offer", "Price → Terms"], ["Order", "Open → Complete"], ["Audit", "Every change tracked"]],
      rules: ["Never publish a guessed price", "Keep promotions date-bound", "Do not bypass order state checks", "Escalate payment discrepancies"],
    };
    return {
      purpose: "Use your scoped ResKonnect workspace to complete specialist work without crossing role boundaries.",
      steps: ["Open the queue or module requiring action.", "Work the source record rather than creating parallel data.", "Use system statuses and notes so other teams stay synchronized.", "Finish or escalate the exception before moving to the next item."],
      examples: [["Work", "Queue → Done"], ["Sync", "One source record"], ["Access", "Role scoped"]],
      rules: ["Keep data factual", "Do not share credentials", "Use assigned role permissions", "Escalate exceptions"],
    };
  }, [basePath]);

  return <>
    <Button variant="premium" size="sm" onClick={() => setOpen(true)} className="gap-2"><HelpCircle />User Manual</Button>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent side="right" className="w-[min(96vw,720px)] max-w-none overflow-y-auto p-0">
      <div className="bg-[#071326] p-6 text-white sm:p-8"><SheetHeader className="text-left"><div className="flex items-center gap-3"><img src={BRAND.logos.icon} alt="" className="h-11 w-11 rounded-xl bg-white p-1.5"/><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#F5B32F]">ResKonnect · Role Manual</p><SheetTitle className="mt-1 text-2xl font-black text-white">{title}</SheetTitle></div></div><SheetDescription className="mt-3 text-white/70">{roleLabel} · {guide.purpose}</SheetDescription></SheetHeader></div>
      <div className="space-y-7 p-6 sm:p-8">
        <section><div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary"/><h3 className="font-black">Operating workflow</h3></div><div className="mt-3 space-y-2">{guide.steps.map((step,index)=><div key={step} className="flex gap-3 rounded-xl border p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5B32F] text-xs font-black text-[#071326]">{index+1}</span><p className="text-sm leading-5">{step}</p></div>)}</div></section>
        <section><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/><h3 className="font-black">Visual example</h3></div><div className="mt-3 overflow-hidden rounded-2xl border"><div className="flex items-center justify-between bg-[#071326] px-4 py-3 text-white"><span className="font-black">{roleLabel}</span><Badge className="bg-[#F5B32F] text-[#071326]">GUIDED OS</Badge></div><div className="grid gap-3 bg-muted/20 p-4 sm:grid-cols-3">{guide.examples.map(([label,value])=><div key={label} className="rounded-xl border bg-background p-4"><p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>)}</div></div></section>
        <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[.05] p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-700"/><h3 className="font-black">Role rules</h3></div><div className="mt-3 space-y-2">{guide.rules.map(rule=><div key={rule} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/><span>{rule}</span></div>)}</div></section>
        <div className="rounded-2xl bg-[#071326] p-5 text-white"><div className="flex items-center gap-2"><Target className="h-5 w-5 text-[#F5B32F]"/><p className="font-black">Automation principle</p></div><p className="mt-2 text-sm leading-6 text-white/70">Work the exceptions surfaced by ResKonnect. Do not rebuild automation manually outside the system; keeping activity inside the dashboard preserves attribution, audit trails and conversion intelligence.</p></div>
      </div>
    </SheetContent></Sheet>
  </>;
}
