import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, ClipboardCheck, FileCheck2, LayoutDashboard, Megaphone, ShieldCheck, TrendingUp } from "lucide-react";
import { GOVERNANCE_NOTICES } from "@/lib/compliance/nsfasStandards";

export const PartnersLandlords: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Landlord & Accommodation Provider Services | ResKonnect"
        description="List and operate student accommodation with ResKonnect: recruitment, application dashboards, compliance-readiness support, pre-inspection preparation and student lifecycle support."
        keywords="student accommodation landlord, NSFAS accreditation readiness, student residence marketing, landlord portal, student accommodation applications South Africa"
      />

      <section className="border-b bg-gradient-to-br from-[#071326] via-[#102844] to-[#12365f] text-white">
        <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#F5B32F]">Accommodation & Property</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">From an empty bed to a controlled student-housing operation.</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">
                ResKonnect combines recruitment, applications, residence dashboards, compliance-readiness support, property media and ongoing student care so providers can grow occupancy without losing control of service quality.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-[#F5B32F] font-black text-[#071326] hover:bg-[#F5B32F]/90"><Link to="/get-started?persona=landlord&need=property_listing">Partner with ResKonnect <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="border-white/35 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link to="/residence/login">Landlord Portal</Link></Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [LayoutDashboard, "Provider dashboard", "Applications, reservations, inventory, leads and performance in one property workspace."],
                [Megaphone, "Recruitment & media", "Targeted campus marketing, creator content, walkthroughs and conversion-focused listing support."],
                [FileCheck2, "Compliance readiness", "Controlled document preparation, property pre-inspection and next-step action plans."],
                [TrendingUp, "Occupancy intelligence", "Demand, conversion and listing-performance signals to guide recruitment decisions."],
              ].map(([Icon, title, text]) => {
                const C = Icon as typeof Building2;
                return <Card key={String(title)} className="border-white/10 bg-white/10 text-white"><CardContent className="p-5"><C className="h-6 w-6 text-[#F5B32F]" /><h3 className="mt-3 font-black">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-white/65">{String(text)}</p></CardContent></Card>;
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-7xl space-y-16 px-4 py-14 sm:px-6 lg:px-8">
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Accreditation support with a strict authority boundary</AlertTitle>
          <AlertDescription>{GOVERNANCE_NOTICES.authority}</AlertDescription>
        </Alert>

        <section>
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Operating model</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">What a provider gets after engagement</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["1", "Supply & verification", "We capture the property, room inventory, pricing, funding routes, service facts and the evidence supporting public claims."],
              ["2", "Demand & recruitment", "Listings, campus targeting, social content and recruitment activity are aligned to the intake and available beds."],
              ["3", "Application control", "Applications arrive in the residence dashboard so the property can review, contact and confirm students through a traceable workflow."],
              ["4", "Stay & renewal support", "Move-in, student support, disputes, property quality, feedback and renewal/compliance actions remain visible after placement."],
            ].map(([number, title, text]) => <Card key={number}><CardContent className="p-5"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">{number}</div><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card>)}
          </div>
        </section>

        <section className="grid gap-8 rounded-3xl border bg-muted/30 p-6 md:p-8 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <ClipboardCheck className="h-8 w-8 text-primary" />
            <h2 className="mt-4 text-3xl font-black">Accreditation-readiness support</h2>
            <p className="mt-3 leading-7 text-muted-foreground">We use a staged service instead of handing you an oversized generic checklist and leaving you to interpret it alone.</p>
            <Button asChild className="mt-6"><Link to="/accreditation-readiness">See requirements & process <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "13-category property compliance evidence file",
              "Supporting provider information and funding-route facts",
              "Detailed property pre-inspection preparation",
              "Remediation and evidence-return action plan",
              "Official status, grade and validity recorded separately",
              "Appeal, renewal and expiry control where applicable",
            ].map((item) => <div key={item} className="flex gap-3 rounded-xl bg-background p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><span className="text-sm font-semibold leading-5">{item}</span></div>)}
          </div>
        </section>

        <section>
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Commercial principle</p>
            <h2 className="mt-2 text-3xl font-black">We build around successful outcomes</h2>
            <p className="mt-3 leading-7 text-muted-foreground">Student accommodation placement is free to the student. Provider commercial terms are agreed in writing before recruitment starts, and the service model is designed around converted students, occupancy and long-term partner value rather than charging students to access housing.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Card><CardContent className="p-6"><h3 className="font-black">Contracts before action</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Scope, rates, attribution, payment triggers, content rights, service expectations and access responsibilities are agreed before execution.</p></CardContent></Card>
            <Card><CardContent className="p-6"><h3 className="font-black">Provider dashboard included</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Contracted providers receive access to their property workflow so applications and follow-ups do not depend on informal message threads.</p></CardContent></Card>
            <Card><CardContent className="p-6"><h3 className="font-black">Quality can stop recruitment</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Misleading claims, serious safety issues, mistreatment or material compliance problems can trigger corrective action or suspension from ResKonnect recruitment.</p></CardContent></Card>
          </div>
        </section>

        <section className="rounded-3xl bg-[#071326] p-7 text-white md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div><h2 className="text-3xl font-black">Bring us the property. We will structure the next step.</h2><p className="mt-3 max-w-3xl leading-7 text-white/70">Whether the immediate need is recruitment, an application pipeline, compliance readiness or a full managed-property relationship, the first engagement captures the facts before a solution is proposed.</p></div>
            <Button asChild size="lg" className="bg-[#F5B32F] font-black text-[#071326] hover:bg-[#F5B32F]/90"><Link to="/get-started?persona=landlord&need=property_listing">Start provider intake</Link></Button>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
};

export default PartnersLandlords;
