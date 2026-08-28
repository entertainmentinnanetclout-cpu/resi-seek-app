import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  BookOpen, Building2, CheckCircle2, FileText, GraduationCap, HelpCircle,
  Home, Megaphone, Search, ShieldCheck, Sparkles, Target, Upload, Users, WalletCards,
} from "lucide-react";
import { BRAND } from "@/constants/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export type ManualRole = "student" | "admin" | "landlord" | "creator" | "tumelo" | "recruiter" | "partner";

interface Props {
  role?: ManualRole;
  residenceName?: string | null;
  inline?: boolean;
}

type ManualSpec = {
  title: string;
  subtitle: string;
  daily: string[];
  steps: Array<{ title: string; detail: string; icon: any }>;
  examples: Array<{ label: string; value: string; hint: string }>;
  rules: string[];
};

const specs: Record<ManualRole, ManualSpec> = {
  student: {
    title: "Student Portal User Manual",
    subtitle: "From account setup to accommodation, applications, documents and opportunities.",
    daily: ["Complete your profile and contact details", "Check notifications and application status", "Keep your documents current", "Reserve or apply only from verified residence pages"],
    steps: [
      { title: "Complete your profile", detail: "Add your legal name, phone/WhatsApp, campus and student number or SA ID. The system uses this information to prevent broken applications.", icon: Users },
      { title: "Find accommodation", detail: "Use Find My Res, compare private and NSFAS rates, open the map, review photos and reserve for 2027 where available.", icon: Search },
      { title: "Apply & upload", detail: "Start an application, upload required documents and follow the status from My Applications. Never submit the same residence twice.", icon: Upload },
      { title: "Act on updates", detail: "Notification cards tell you when documents, funding details or another action is required. Completing these keeps your application handover-ready.", icon: CheckCircle2 },
    ],
    examples: [{ label: "Journey", value: "Profile → Search → Apply", hint: "One connected student record" }, { label: "2027", value: "Reserve early", hint: "Where the residence has opened intake" }, { label: "Documents", value: "Private & secure", hint: "Only approved workflows can access them" }],
    rules: ["Use your real contact details", "Use SA ID if you are a matriculant/TVET applicant without a student number", "Do not create duplicate applications", "Check pricing type before applying"],
  },
  admin: {
    title: "Admin GOD MODE User Manual",
    subtitle: "Operate ResKonnect through integrity gates, automation queues and conversion command centres.",
    daily: ["Review alerts and automation exceptions", "Work only records needing human verification", "Resolve GOD MODE integrity blockers", "Monitor conversions, partnerships and residence data quality"],
    steps: [
      { title: "Start with command centres", detail: "Use Growth, Partnerships and Accommodation Hub metrics to identify exceptions rather than manually checking every record.", icon: Target },
      { title: "Protect data integrity", detail: "Use the Handover GOD MODE queue. Safe Auto-Repair handles deterministic fixes; humans verify identity/funding conflicts. Never bypass the release gate.", icon: ShieldCheck },
      { title: "Manage property quality", detail: "Use residence quality scores to complete images, room-level pricing, coordinates, availability and 2027 settings before promoting a listing.", icon: Building2 },
      { title: "Manage conversions", detail: "Automation creates follow-up work from applications and reservations. Admin handles exceptions, escalations and final verification.", icon: Sparkles },
    ],
    examples: [{ label: "Automation", value: "Auto-first", hint: "Humans work exception queues" }, { label: "Handover", value: "0 blockers", hint: "Required before verified export" }, { label: "Growth", value: "Visitor → Placement", hint: "Track full funnel" }],
    rules: ["Never invent missing student data", "Do not release a handover with blockers", "Verify pricing before marking it verified", "Use role permissions instead of sharing admin access"],
  },
  landlord: {
    title: "Residence Property OS Manual",
    subtitle: "Operate your listing, 2027 demand, pricing, inventory, CRM and recruiter channel.",
    daily: ["Check new 2027 reservations and applications", "Update bed availability", "Work CRM follow-ups", "Keep listing photos and prices current"],
    steps: [
      { title: "Build a 100% listing", detail: "Listing & Brand controls address, place, cover image, gallery/studio image and public presentation. Complete the data-quality checklist.", icon: Building2 },
      { title: "Manage inventory & pricing", detail: "Set room capacities and separate private/NSFAS prices. Confirm fees and academic year; ResKonnect verification remains platform-controlled.", icon: WalletCards },
      { title: "Work demand", detail: "2027 Reservations, Applications and CRM show the students requiring action without exposing private student contact details in the residence portal.", icon: Users },
      { title: "Grow recruitment", detail: "Opt into the recruitment channel, set recruiter instructions and use residence-specific tracked campaigns to measure placements.", icon: Megaphone },
    ],
    examples: [{ label: "Listing health", value: "Target 100%", hint: "Images + price + location + inventory" }, { label: "Lead flow", value: "New → Placed", hint: "Keep CRM stages current" }, { label: "Marketing", value: "4K poster", hint: "Download from public residence card" }],
    rules: ["Student contact data stays inside ResKonnect-controlled communication", "Update availability immediately after placements", "Never use one generic price when room types differ", "Use verified images of the actual property"],
  },
  creator: {
    title: "Creator Partner OS Manual",
    subtitle: "Turn audience reach into tracked accommodation and application outcomes.",
    daily: ["Review attributed leads and assistance cases", "Share tracked campaign links", "Work only consented application cases", "Move assistance statuses as work is completed"],
    steps: [
      { title: "Share your tracked journey", detail: "Use your creator URL so clicks, accounts, reservations and application outcomes remain attributed to your campaign.", icon: Megaphone },
      { title: "Assist applications", detail: "Students explicitly grant access to an assistance case. Review their pack, documents and targets from the Creator Assistance Workspace.", icon: GraduationCap },
      { title: "Protect consent", detail: "Only access documents inside consented cases. If consent is revoked, access ends. Do not copy private files into personal storage.", icon: ShieldCheck },
      { title: "Measure conversion", detail: "Use your dashboard funnel to improve campaigns based on completed outcomes instead of follower count alone.", icon: Target },
    ],
    examples: [{ label: "Attribution", value: "Click → Outcome", hint: "Tracked automatically" }, { label: "Applications", value: "Consent first", hint: "Secure assistance workspace" }, { label: "Content", value: "Campaign assets", hint: "Use ResKonnect branding" }],
    rules: ["Never request passwords from applicants", "Only use documents for the consented assistance purpose", "Keep referral links intact", "Mark case status truthfully"],
  },
  tumelo: {
    title: "Tumelo Intelligence OS Manual",
    subtitle: "Operate the Career & Education partnership with content, resources and conversion intelligence.",
    daily: ["Review partnership conversion intelligence", "Publish or update learner resources", "Check content performance", "Use insights to plan the next guidance topic"],
    steps: [
      { title: "Read the intelligence", detail: "Use views, attributed users and conversions to see which guidance content produces real student actions.", icon: Target },
      { title: "Publish resources", detail: "Upload guides, checklists and application/career documents from the Resource Library. Published resources become downloadable from the public Tumelo section.", icon: Upload },
      { title: "Guide users", detail: "Keep resources educational and current, then direct users into ResKonnect applications, accommodation or opportunity journeys where appropriate.", icon: GraduationCap },
      { title: "Protect access", detail: "Tumelo partnership access does not provide general ResKonnect admin access. Use only the Intelligence OS permissions assigned to the account.", icon: ShieldCheck },
    ],
    examples: [{ label: "Resources", value: "Upload → Publish", hint: "Public downloads" }, { label: "Insights", value: "Content → Conversion", hint: "Partner attribution" }, { label: "Scope", value: "Career & Education", hint: "Focused partner workspace" }],
    rules: ["Publish only resources you are authorized to distribute", "Remove outdated application information", "Never upload student private documents to the public resource library", "Use public resources for guidance, not personal case files"],
  },
  recruiter: {
    title: "Recruiter OS Manual",
    subtitle: "Recruit students for opted-in residences with tracked residence-specific campaigns.",
    daily: ["Choose eligible residences", "Share the correct residence campaign link", "Check attributed applications and placements", "Focus on properties with current availability"],
    steps: [
      { title: "Choose a residence", detail: "Search only residences that opted into recruiter campaigns. Review price, location and recruiter instructions before promoting.", icon: Building2 },
      { title: "Use the dedicated link", detail: "Copy the residence-specific tracked URL. Do not replace it with a generic homepage link if you want attribution.", icon: Megaphone },
      { title: "Set accurate expectations", detail: "Use current public listing information and the generated 4K poster. Do not invent pricing, accreditation or available beds.", icon: FileText },
      { title: "Track outcomes", detail: "Your dashboard follows referrals through application and placement so performance can be measured on real conversions.", icon: Target },
    ],
    examples: [{ label: "Campaign", value: "1 residence = 1 link", hint: "Accurate attribution" }, { label: "Creative", value: "4K poster", hint: "Generated from live listing data" }, { label: "Success", value: "Placement", hint: "Outcome-based tracking" }],
    rules: ["Recruit only for opted-in residences", "Use current live listing details", "Do not collect private student documents outside approved workflows", "Never promise placement before confirmation"],
  },
  partner: {
    title: "Partner Dashboard Manual",
    subtitle: "Use tracked partnership journeys, content and conversion intelligence responsibly.",
    daily: ["Review attributed engagement", "Keep partnership content current", "Use tracked calls to action", "Escalate exceptions rather than duplicating workflows"],
    steps: [
      { title: "Use your partner pathway", detail: "Campaign URLs preserve attribution from first visit through supported conversion events.", icon: Target },
      { title: "Publish approved content", detail: "Keep partner-facing information factual, current and aligned to the scope of the partnership.", icon: FileText },
      { title: "Review outcomes", detail: "Use conversion data to improve campaigns and student journeys without exposing private user data unnecessarily.", icon: Sparkles },
      { title: "Follow role boundaries", detail: "Partner access is scoped. General admin and residence controls remain separate.", icon: ShieldCheck },
    ],
    examples: [{ label: "Traffic", value: "Tracked", hint: "Partner attribution" }, { label: "Conversion", value: "Measured", hint: "Applications/reservations/outcomes" }, { label: "Access", value: "Role scoped", hint: "Least privilege" }],
    rules: ["Use only approved data", "Keep shared resources current", "Respect POPIA and user consent", "Do not share dashboard credentials"],
  },
};

function inferRole(pathname: string): ManualRole {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/partner/tumelo")) return "tumelo";
  if (pathname.startsWith("/creator")) return "creator";
  if (pathname.startsWith("/recruit") || pathname.includes("recruiter-dashboard")) return "recruiter";
  if (pathname.startsWith("/partner")) return "partner";
  if (pathname.startsWith("/residence")) return "landlord";
  return "student";
}

export default function DashboardUserManual({ role, residenceName, inline = false }: Props) {
  const location = useLocation();
  const resolvedRole = role || inferRole(location.pathname);
  const manual = useMemo(() => specs[resolvedRole], [resolvedRole]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="premium"
        size={inline ? "sm" : "default"}
        onClick={() => setOpen(true)}
        className={inline ? "gap-2" : "fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-[80] gap-2 rounded-full border-[#F5B32F] bg-[#071326] px-4 text-white shadow-2xl hover:bg-[#10284A] md:right-6"}
      >
        <HelpCircle /> User Manual
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[min(96vw,760px)] max-w-none overflow-y-auto p-0">
          <div className="bg-[#071326] px-6 pb-7 pt-6 text-white sm:px-8">
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <img src={BRAND.logos.icon} alt="" className="h-12 w-12 rounded-xl bg-white p-1.5" />
                <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#F5B32F]">ResKonnect · Guided OS</p><SheetTitle className="mt-1 text-2xl font-black text-white">{manual.title}</SheetTitle></div>
              </div>
              <SheetDescription className="mt-3 max-w-xl text-sm leading-6 text-white/70">{manual.subtitle}{residenceName ? ` This guide is active inside ${residenceName}.` : ""}</SheetDescription>
            </SheetHeader>
          </div>

          <div className="space-y-8 p-6 sm:p-8">
            <section>
              <div className="mb-3 flex items-center gap-2"><Home className="h-5 w-5 text-primary" /><h3 className="font-black">Your daily operating rhythm</h3></div>
              <div className="grid gap-2 sm:grid-cols-2">{manual.daily.map((item, index) => <div key={item} className="flex gap-3 rounded-xl border bg-muted/25 p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5B32F] text-xs font-black text-[#071326]">{index + 1}</span><p className="text-sm font-semibold leading-5">{item}</p></div>)}</div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /><h3 className="font-black">How to use this dashboard</h3></div>
              <div className="space-y-3">{manual.steps.map((step, index) => { const Icon = step.icon; return <div key={step.title} className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-start gap-4"><div className="rounded-xl bg-[#071326] p-2.5 text-[#F5B32F]"><Icon className="h-5 w-5" /></div><div><div className="flex items-center gap-2"><Badge variant="outline">Step {index + 1}</Badge><h4 className="font-black">{step.title}</h4></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p></div></div></div>; })}</div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h3 className="font-black">Visual example · what good looks like</h3></div>
              <div className="overflow-hidden rounded-2xl border shadow-sm">
                <div className="flex items-center justify-between bg-[#071326] px-4 py-3 text-white"><div className="flex items-center gap-2"><img src={BRAND.logos.icon} alt="" className="h-7 w-7 rounded-md bg-white p-1" /><span className="font-black">ResKonnect OS</span></div><Badge className="bg-[#F5B32F] text-[#071326]">ROLE GUIDE</Badge></div>
                <div className="grid gap-3 bg-muted/20 p-4 sm:grid-cols-3">{manual.examples.map((example) => <div key={example.label} className="rounded-xl border bg-background p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{example.label}</p><p className="mt-1 text-xl font-black">{example.value}</p><p className="mt-1 text-xs text-muted-foreground">{example.hint}</p></div>)}</div>
              </div>
            </section>

            <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[.05] p-5">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-700" /><h3 className="font-black">Rules that protect the workflow</h3></div>
              <div className="mt-3 space-y-2">{manual.rules.map((rule) => <div key={rule} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{rule}</span></div>)}</div>
            </section>

            <div className="rounded-2xl bg-[#071326] p-5 text-white"><p className="font-black">Need to remember one thing?</p><p className="mt-1 text-sm leading-6 text-white/70">Follow the dashboard's next-action indicators and work exceptions rather than recreating processes manually. ResKonnect is designed to keep one synchronized source record from first visit through conversion.</p></div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
