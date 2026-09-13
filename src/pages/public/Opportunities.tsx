import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import SeoInternalLinks from "@/components/seo/SeoInternalLinks";
import OpportunityEngine from "@/components/opportunities/OpportunityEngine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowUpRight, BriefcaseBusiness, Compass, FileCheck2, GraduationCap, Milestone, Sparkles } from "lucide-react";

const pathways = [
  {
    title: "WIL readiness & placement support",
    eyebrow: "Work-integrated learning",
    description: "Prepare your WIL information, documents and workplace-readiness, then follow verified placement pathways when live partner capacity exists.",
    to: "/opportunities/wil",
    cta: "Explore WIL support",
    icon: Milestone,
  },
  {
    title: "Bursaries & funding",
    eyebrow: "Verified current supply",
    description: "Browse active bursaries with closing dates, provider context and official application routes rather than expired listings.",
    to: "/bursaries",
    cta: "Browse bursaries",
    icon: GraduationCap,
  },
  {
    title: "Career & study direction",
    eyebrow: "Planning",
    description: "Connect your course, study decisions and next steps to realistic education and career pathways through ResKonnect.",
    to: "/career-education",
    cta: "Explore career guidance",
    icon: Compass,
  },
];

export const Opportunities = () => {
  return (
    <PublicLayout>
      <SEO
        title="Student Opportunities, Bursaries & WIL | ResKonnect Opportunity"
        description="Explore verified current bursaries, graduate programmes, WIL and student opportunities through the ResKonnect Opportunity Engine, with signed-in relevance guidance and official application routes."
        keywords="student opportunities South Africa, bursaries 2027, WIL placements, graduate programmes, internships, ResKonnect Opportunity"
        canonicalPath="/opportunities"
      />

      <main className="bg-gradient-to-b from-primary/5 via-background to-background">
        <section className="border-b py-14 md:py-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <Badge variant="outline" className="rounded-full px-4 py-1">RESKONNECT OPPORTUNITY · RG3</Badge>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-6xl">Verified opportunities. Better next steps.</h1>
              <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-muted-foreground md:text-xl">
                Search current bursaries, graduate programmes, WIL pathways and student opportunities. ResKonnect shows verification context and, when you sign in, relevance guidance based on your saved profile—not a claim that you are eligible or selected.
              </p>
            </div>

            <div className="mx-auto mt-10 max-w-7xl">
              <OpportunityEngine />
            </div>
          </div>
        </section>

        <section className="py-14 md:py-18">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">PATHWAYS & SUPPORT</p>
              <h2 className="mt-2 text-3xl font-black">Opportunity is more than a listing.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Use ResKonnect to become ready, understand requirements and keep your opportunity journey connected to your account.</p>
            </div>
            <div className="mx-auto mt-8 grid max-w-6xl gap-5 md:grid-cols-3">
              {pathways.map((item) => {
                const Icon=item.icon;
                return <Card key={item.title} className="h-full">
                  <CardContent className="flex h-full flex-col p-6">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5"/></div>
                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-primary">{item.eyebrow}</p>
                    <h3 className="mt-1 text-lg font-black">{item.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    <Button asChild variant="link" className="mt-4 justify-start p-0"><Link to={item.to}>{item.cta}<ArrowUpRight className="ml-1.5 h-3.5 w-3.5"/></Link></Button>
                  </CardContent>
                </Card>;
              })}
            </div>

            <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
              <div className="rounded-3xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><FileCheck2 className="h-5 w-5 text-primary"/></div><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Before you apply</p><h3 className="font-bold">Get opportunity-ready</h3></div></div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Use your ResKonnect profile and documents to understand what is missing, save opportunities and record when you have applied. Official providers still control eligibility, selection and funding decisions.</p>
              </div>
              <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
                <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5"/></div><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Employers & institutions</p><h3 className="font-bold">Publish verified opportunities</h3></div></div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Work with ResKonnect to publish current opportunity information with source provenance, requirements and closing dates.</p>
                <Button asChild className="mt-4"><Link to="/get-started?persona=institution_business&need=partner_solution">Partner with ResKonnect</Link></Button>
              </div>
            </div>

            <div className="mx-auto mt-10 max-w-5xl">
              <SeoInternalLinks
                heading="Opportunity pathways"
                links={[
                  { label: "WIL placement support", to: "/opportunities/wil-placement-support", description: "Prepare for workplace integrated learning and verified placement pathways." },
                  { label: "Internships", to: "/opportunities/internships", description: "Explore internship and graduate opportunity pathways." },
                  { label: "SETA opportunities", to: "/opportunities/seta", description: "Explore SETA-linked workplace experience pathways." },
                  { label: "Application readiness", to: "/applications/application-readiness", description: "Prepare your next study or opportunity application." },
                ]}
              />
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
};

export default Opportunities;
