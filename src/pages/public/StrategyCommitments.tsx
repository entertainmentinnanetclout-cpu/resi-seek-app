import { ArrowRight, CheckCircle2, HeartHandshake, ShieldCheck, Sparkles, Target, Users, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const principles = [
  {
    icon: HeartHandshake,
    title: "Quality over quantity",
    text: "Student wellbeing comes first. Growth, commissions or strong provider ratings never justify ignoring a student’s lived experience.",
  },
  {
    icon: ShieldCheck,
    title: "Safety and dignity",
    text: "We assess access control, lighting, exits, living conditions, treatment, privacy and how reported risks are handled.",
  },
  {
    icon: CheckCircle2,
    title: "Verified information",
    text: "Accreditation, grades, funding eligibility, prices, deadlines and availability must be checked independently against the relevant source.",
  },
  {
    icon: Workflow,
    title: "Support beyond the transaction",
    text: "Our responsibility continues after a referral, application or placement through follow-up, case ownership and clear escalation routes.",
  },
];

const roadmap = [
  {
    period: "2026–2027",
    title: "Establish consistent student care",
    points: [
      "Adopt the charter and assign care and quality roles.",
      "Introduce arrival check-ins, monthly follow-ups and year-end feedback.",
      "Review current accommodation partners against safety, service and student-experience standards.",
      "Standardise application assistance, WIL checks and service baselines.",
    ],
  },
  {
    period: "2028–2030",
    title: "Strengthen support and institutional engagement",
    points: [
      "Use student feedback to improve partner agreements and accommodation selection.",
      "Build clearer working routes with participating institutions.",
      "Expand support for accessibility, financial and digital barriers.",
      "Develop ResKonnect AI and portals while keeping sensitive decisions accountable to people.",
    ],
  },
  {
    period: "2031–2035",
    title: "Extend services that earn student trust",
    points: [
      "Expand only where quality evidence and support capacity are strong.",
      "Assess local requirements and credible partners before entering new areas.",
      "Publish an annual account of student experience, improvements and unresolved issues.",
      "Use evidence from student care to shape the next ResKonnect strategy.",
    ],
  },
];

const standards = [
  ["Arrival check-in", "Contact every placed student within seven days and record responses and follow-up."],
  ["Ongoing care", "Monthly check-in attempts and a fuller review each term or semester."],
  ["Open concerns", "Every case has an owner, next action and update date."],
  ["Provider quality", "Every active provider has current evidence and a review of safety and service concerns."],
  ["Complaint response", "Target 95% acknowledgement within two business days and 90% with an outcome or plan within ten."],
  ["Year-end feedback", "Invite every supported student, follow up non-response and report actual participation."],
];

export default function StrategyCommitments(){
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SEO
        title="ResKonnect Strategy & Student Care Commitments 2026–2035"
        description="Read ResKonnect’s Student Care and Quality Commitment Charter, strategic direction for 2026–2035, quality standards, student-support commitments and accountability targets."
        canonicalPath="/about/strategy-commitments"
      />
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.16),transparent_32%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.35))]">
          <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
            <div className="max-w-4xl">
              <Badge className="rounded-full px-3 py-1">Strategy & Commitments</Badge>
              <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Student Care and Quality Commitment Charter
              </h1>
              <p className="mt-3 text-lg font-bold text-primary">Strategic vision 2026 to 2035</p>
              <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
                We care about our students more than the services we provide. ResKonnect’s strategy connects Living, AI and Opportunity through sustained student care, verified information, accountable support and quality over quantity.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg"><Link to="/student-care">Get student support <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/about">About ResKonnect</Link></Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="border-primary/20">
                <CardContent className="p-7 sm:p-9">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Vision</p>
                  <h2 className="mt-3 text-2xl font-black sm:text-3xl">Africa’s most trusted connection between quality living, useful technology and meaningful opportunity.</h2>
                  <p className="mt-4 leading-7 text-muted-foreground">Student safety, dignity and long-term wellbeing remain at the centre of our work.</p>
                </CardContent>
              </Card>
              <Card className="border-primary/20">
                <CardContent className="p-7 sm:p-9">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Mission</p>
                  <h2 className="mt-3 text-2xl font-black sm:text-3xl">Help students navigate living, education, work opportunities and reliable digital support.</h2>
                  <p className="mt-4 leading-7 text-muted-foreground">We stay involved throughout the journey, listen to student experiences and work with responsible partners and institutions to address concerns.</p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-12">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">How we operate</p>
                <h2 className="mt-2 text-3xl font-black">Quality is the lived experience.</h2>
                <p className="mt-3 leading-7 text-muted-foreground">A provider’s accreditation or rating matters, but it does not override unsafe conditions, mistreatment or unresolved service failures.</p>
              </div>
              <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {principles.map((item)=>{
                  const Icon=item.icon;
                  return <Card key={item.title} className="h-full"><CardContent className="p-6"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5"/></div><h3 className="mt-4 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p></CardContent></Card>;
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/35 py-14 md:py-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Strategic roadmap</p>
              <h2 className="mt-2 text-3xl font-black">2026–2035 strategic direction</h2>
              <p className="mt-3 leading-7 text-muted-foreground">Growth must follow ResKonnect’s capacity to support students well.</p>
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {roadmap.map((phase)=><Card key={phase.period}><CardContent className="p-6"><Badge variant="outline">{phase.period}</Badge><h3 className="mt-4 text-xl font-black">{phase.title}</h3><ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">{phase.points.map((point)=><li key={point} className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary"/><span>{point}</span></li>)}</ul></CardContent></Card>)}
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Target className="h-6 w-6"/></div>
                <h2 className="mt-4 text-3xl font-black">How we measure our care</h2>
                <p className="mt-4 leading-7 text-muted-foreground">These are delivery targets from adoption, not claims of existing performance. We separate attempted contact, student response and resolved concerns so results are reported honestly.</p>
              </div>
              <div className="overflow-hidden rounded-2xl border">
                {standards.map(([label,text],index)=><div key={label} className={"grid gap-2 p-5 sm:grid-cols-[180px_1fr] "+(index<standards.length-1?"border-b":"")}><p className="font-bold">{label}</p><p className="text-sm leading-6 text-muted-foreground">{text}</p></div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-primary/5 py-14 md:py-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card><CardContent className="p-6"><Users className="h-6 w-6 text-primary"/><h3 className="mt-4 text-xl font-black">Student feedback</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Year-end feedback is part of the ResKonnect support journey. Non-response is recorded honestly and never treated as satisfaction.</p></CardContent></Card>
              <Card><CardContent className="p-6"><ShieldCheck className="h-6 w-6 text-primary"/><h3 className="mt-4 text-xl font-black">Safety concerns</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Serious safety concerns receive priority. We support escalation to the appropriate residence, institution, protection or emergency route without waiting for an annual review.</p></CardContent></Card>
              <Card><CardContent className="p-6"><Sparkles className="h-6 w-6 text-primary"/><h3 className="mt-4 text-xl font-black">Responsible AI</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">AI must use reliable information, make uncertainty clear, keep human support available and never invent accreditation, grades, application status or placement outcomes.</p></CardContent></Card>
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="container mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <Badge variant="outline">Our pledge</Badge>
            <h2 className="mt-4 text-3xl font-black sm:text-4xl">Our promise is quality over quantity. Our priority is the student.</h2>
            <p className="mx-auto mt-5 max-w-3xl leading-7 text-muted-foreground">Across accommodation, applications, work opportunities and technology, ResKonnect commits to honest guidance, suitable support, privacy, accountability and continuous improvement.</p>
            <Button asChild size="lg" className="mt-7"><Link to="/student-care">Access student care <ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
