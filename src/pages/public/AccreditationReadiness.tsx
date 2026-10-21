import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import SEOJsonLd from "@/components/SEOJsonLd";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COMPLIANCE_REQUIREMENTS,
  GOVERNANCE_NOTICES,
  INSPECTION_REFERENCES,
  READINESS_STAGES,
} from "@/lib/compliance/nsfasStandards";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  RefreshCw,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

const process = [
  { icon: FileSearch, title: "1. Provider & property intake", text: "Capture ownership, property, capacity, campus, funding and existing accreditation facts before making any claim." },
  { icon: FileCheck2, title: "2. Document-readiness audit", text: "Review the 13 primary property-compliance categories, validity dates, issuer details and missing evidence." },
  { icon: ClipboardCheck, title: "3. Property pre-inspection", text: "Review rooms, ablutions, kitchens, power, study areas, laundry, security, emergency readiness, hygiene and building condition." },
  { icon: ShieldCheck, title: "4. Remediation & submission support", text: "Issue a controlled next-step plan, collect corrected evidence and prepare the provider for the applicable external process." },
  { icon: RefreshCw, title: "5. Outcome, appeal & renewal control", text: "Keep official status, grade, validity, directives, renewals and any appeal deadlines separate from ResKonnect internal readiness." },
];

const AccreditationReadiness = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Student Accommodation Accreditation Readiness Support",
    provider: { "@type": "Organization", name: "ResKonnect", url: "https://www.reskonnect.org" },
    areaServed: { "@type": "Country", name: "South Africa" },
    serviceType: "Student accommodation compliance readiness, document review and pre-inspection support",
    description: "ResKonnect helps accommodation providers prepare evidence, conduct readiness reviews and manage next steps while official accreditation and grading remain with the authorised body.",
  };

  return (
    <PublicLayout>
      <SEO
        title="NSFAS Accommodation Accreditation Readiness | ResKonnect"
        description="Prepare student accommodation for the NSFAS/DHET accreditation process with structured document-readiness reviews, pre-inspection support, remediation tracking and renewal control."
        keywords="NSFAS accommodation accreditation requirements, student accommodation compliance, NSFAS landlord requirements, property inspection student accommodation, accreditation readiness South Africa"
      />
      <SEOJsonLd schema={structuredData} />

      <section className="border-b bg-gradient-to-br from-[#071326] via-[#0b1d37] to-[#12365f] text-white">
        <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
            <div>
              <Badge className="mb-5 border-white/20 bg-white/10 text-white hover:bg-white/10">Accommodation & Property · Compliance Readiness</Badge>
              <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Prepare your property for the official accommodation process.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/75">
                ResKonnect turns a folder of certificates and property information into a controlled readiness case: documents, site preparation, remediation, external status and renewals all tracked separately.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-[#F5B32F] font-black text-[#071326] hover:bg-[#F5B32F]/90">
                  <Link to="/get-started?persona=landlord&need=accreditation_readiness">Start a readiness review <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/35 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Link to="/residence/login">Open Landlord Portal</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <Scale className="h-6 w-6 text-[#F5B32F]" />
                <p className="font-black">Authority boundary</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/75">{GOVERNANCE_NOTICES.authority}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="rounded-2xl bg-black/20 p-4"><p className="text-2xl font-black">13</p><p className="mt-1 text-xs text-white/65">primary document categories controlled in the readiness file</p></div>
                <div className="rounded-2xl bg-black/20 p-4"><p className="text-2xl font-black">3 days</p><p className="mt-1 text-xs text-white/65">ResKonnect target for an initial audit after a complete upload set</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-7xl space-y-16 px-4 py-14 sm:px-6 lg:px-8">
        <Alert className="border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          <BadgeCheck className="h-4 w-4" />
          <AlertTitle>Funding acceptance, accreditation and grading are different facts</AlertTitle>
          <AlertDescription className="leading-6">
            {GOVERNANCE_NOTICES.funding} {GOVERNANCE_NOTICES.grade}
          </AlertDescription>
        </Alert>

        <section>
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Controlled service journey</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">From first documents to ongoing compliance</h2>
            <p className="mt-3 text-muted-foreground">The website now mirrors the ResKonnect operating model instead of treating accreditation as a single checkbox.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {process.map((step) => (
              <Card key={step.title} className="h-full border-border/80">
                <CardContent className="p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><step.icon className="h-5 w-5" /></div>
                  <h3 className="mt-4 font-black leading-5">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Document readiness</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">The 13 primary property evidence categories</h2>
              <p className="mt-3 text-muted-foreground">The first seven categories are identified in the supplied NSFAS required-documents specification as the core set used to progress to the accreditation-fee stage. A complete readiness file still tracks all required categories.</p>
            </div>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {COMPLIANCE_REQUIREMENTS.map((item) => (
              <Card key={item.code} className="border-border/80">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">{item.code === "zoning" ? "01" : String(COMPLIANCE_REQUIREMENTS.indexOf(item) + 1).padStart(2, "0")}</div>
                    {item.coreGate && <Badge variant="secondary" className="shrink-0">Core progress set</Badge>}
                  </div>
                  <h3 className="mt-4 font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border bg-muted/30 p-6 md:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Property inspection reference</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">What physical readiness covers</h2>
            <p className="mt-3 text-muted-foreground">These are public-safe references from the supplied inspection criteria. ResKonnect keeps its detailed internal scoring, fraud indicators and case strategy out of the public site.</p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {INSPECTION_REFERENCES.map((group) => (
              <Card key={group.category} className="bg-background">
                <CardHeader className="pb-2"><CardTitle className="text-lg">{group.category}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {group.checks.map((check) => <div key={check} className="flex gap-2 text-sm leading-6 text-muted-foreground"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" /><span>{check}</span></div>)}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Readiness control</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">A status that tells you the next action</h2>
              <p className="mt-3 leading-7 text-muted-foreground">ResKonnect readiness is intentionally separated from the official authority status. It tells the provider what to do next without pretending to issue an accreditation decision.</p>
              <Alert className="mt-6 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
                <Building2 className="h-4 w-4" />
                <AlertTitle>Official process remains official</AlertTitle>
                <AlertDescription>External states such as submitted, inspection pending, approved, declined, graded, accredited active, suspended, revoked or expired are recorded only when supported by the relevant authority evidence.</AlertDescription>
              </Alert>
            </div>
            <div className="space-y-3">
              {READINESS_STAGES.map((stage, index) => (
                <div key={stage.key} className="flex gap-4 rounded-2xl border bg-card p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">{index + 1}</div>
                  <div><p className="font-black">{stage.label}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{stage.description}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-[#071326] p-7 text-white md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-3xl font-black">Ready to turn your property file into a managed case?</h2>
              <p className="mt-3 max-w-3xl leading-7 text-white/70">Start with the evidence you already have. ResKonnect will identify the next guided step rather than sending every internal control document at once.</p>
            </div>
            <Button asChild size="lg" className="bg-[#F5B32F] font-black text-[#071326] hover:bg-[#F5B32F]/90">
              <Link to="/get-started?persona=landlord&need=accreditation_readiness">Request readiness support <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
};

export default AccreditationReadiness;
