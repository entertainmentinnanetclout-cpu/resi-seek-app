import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { FileText, School, GraduationCap, ClipboardCheck, Sparkles, ExternalLink, ListChecks } from "lucide-react";
import ComplianceDisclaimer from "@/components/onboarding/ComplianceDisclaimer";
import applicationsHero from "@/assets/hero-applications-funding.jpg";
import inclusivePathways from "@/assets/hero-inclusive-pathways.jpg";
import studentStudying from "@/assets/student-studying.jpg";
import studentsCelebration from "@/assets/students-celebration.jpg";

/**
 * TODO(content): official institution portal URLs are not stored in the codebase
 * or config yet. Cards link to internal readiness guidance only. Supply verified
 * official portal URLs (and licensed institution logos) before adding backlinks.
 */
const readinessCards = [
  {
    title: "TUT Application Readiness",
    initials: "TUT",
    body: "Prepare marks, APS and documents before you use the official university portal.",
    to: "/applications/university",
    image: applicationsHero,
    icon: GraduationCap,
  },
  {
    title: "Tshwane South TVET Readiness",
    initials: "TVET",
    body: "NATED and NC(V) pathway guidance, document checklists and intake preparation.",
    to: "/applications/tvet",
    image: inclusivePathways,
    icon: School,
  },
  {
    title: "Private College Readiness",
    initials: "PC",
    body: "Accredited private qualifications, technical diplomas and shorter course preparation.",
    to: "/applications/private-college",
    image: studentsCelebration,
    icon: FileText,
  },
  {
    title: "APS Checker & Document Checklist",
    initials: "APS",
    body: "Estimate your NSC Admission Point Score and confirm the documents you still need.",
    to: "/applications/checker",
    image: studentStudying,
    icon: ClipboardCheck,
  },
];

export const Applications: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Application Support & Readiness Portal"
        description="Comprehensive guidance, readiness calculators, documents prep, and institution guidance support portal."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Tertiary Application Support
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Prepare for your academic future with ResKonnect. Check your APS score, organise compliance documents, and learn about college admission pathways easily.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <ComplianceDisclaimer />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto pt-6">
            {readinessCards.map((card) => (
              <Card
                key={card.title}
                className="group overflow-hidden border-border/80 transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <Link to={card.to} className="block">
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    <img
                      src={card.image}
                      alt={card.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/90 via-brand-navy/35 to-transparent" />
                    <span className="absolute left-3 top-3 grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-xs font-bold tracking-wide text-white backdrop-blur-sm">
                      {card.initials}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4">
                      <card.icon className="h-4 w-4 text-brand-gold" />
                      <h2 className="text-sm font-bold text-white">{card.title}</h2>
                    </div>
                  </div>
                </Link>
                <CardContent className="p-5 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.body}</p>
                  <Button asChild variant="link" className="p-0 text-primary">
                    <Link to={card.to}>Official Portal Guidance &rarr;</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="max-w-4xl mx-auto grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <ListChecks className="h-4 w-4 text-primary" /> Document Checklist
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Certified ID, NSC or latest results, proof of residence and passport photos — prepared before you open any official portal.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <ExternalLink className="h-4 w-4 text-primary" /> Official Portal Guidance
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                We direct you to the institution's own application system. ResKonnect never applies on your behalf.
              </p>
            </div>
          </div>

          <div className="max-w-4xl mx-auto space-y-2 rounded-xl border border-border bg-muted/40 p-5 text-xs leading-relaxed text-muted-foreground">
            <p>
              ResKonnect does not replace official institution application systems. We help with readiness, documents, APS guidance, and official portal direction.
            </p>
            <p>
              ResKonnect does not provide NSFAS application services. NSFAS may only appear as funding or accommodation accreditation context where relevant.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-8 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Ready to find accommodation?
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                Once you know where you want to study, start matching with accredited student housing options adjacent to campus.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/get-started?persona=student&need=accommodation">Match Off-Campus Lodging</Link>
            </Button>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default Applications;