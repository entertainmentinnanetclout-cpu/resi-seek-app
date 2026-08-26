import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import SeoInternalLinks from "@/components/seo/SeoInternalLinks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowUpRight, Award, Briefcase, Compass, FileCheck2, GraduationCap, Milestone, Sparkles, UsersRound } from "lucide-react";

const opportunityCards = [
  {
    title: "WIL Placements",
    eyebrow: "Work-integrated learning",
    description: "Prepare for practical-semester and workplace-learning requirements with structured readiness and placement support.",
    to: "/opportunities/wil",
    cta: "Explore WIL support",
    icon: Milestone,
    motif: <><div className="absolute left-7 top-8 h-16 w-16 rounded-full border-8 border-white/20"/><div className="absolute bottom-7 right-8 h-12 w-24 rounded-2xl bg-white/15 rotate-6"/><GraduationCap className="absolute bottom-8 left-8 h-10 w-10 text-white/90"/></>,
    gradient: "from-sky-500 via-blue-600 to-indigo-700",
  },
  {
    title: "Internship Readiness",
    eyebrow: "Career launch",
    description: "Build your CV, interview confidence and workplace-readiness before applying for internships and graduate opportunities.",
    to: "/get-started?persona=wil_applicant&need=wil_support",
    cta: "Get guided help",
    icon: Briefcase,
    motif: <><div className="absolute right-7 top-7 h-20 w-20 rounded-3xl bg-white/10 rotate-12"/><Briefcase className="absolute bottom-7 right-10 h-12 w-12 text-white/90"/><div className="absolute bottom-9 left-7 flex gap-1">{[1,2,3,4].map(i=><span key={i} className="h-8 w-2 rounded-full bg-white/20" style={{transform:`translateY(${(4-i)*4}px)`}}/>)}</div></>,
    gradient: "from-violet-500 via-purple-600 to-fuchsia-700",
  },
  {
    title: "Student Referrals",
    eyebrow: "Earn through referrals",
    description: "Join published referral campaigns and see the current reward terms before sharing a campaign with other students.",
    to: "/recruit",
    cta: "View referral campaigns",
    icon: Award,
    motif: <><UsersRound className="absolute bottom-7 left-8 h-12 w-12 text-white/90"/><div className="absolute right-7 top-8 h-16 w-16 rounded-full bg-white/15"/><Award className="absolute right-10 top-11 h-10 w-10 text-white"/></>,
    gradient: "from-amber-400 via-orange-500 to-rose-600",
  },
  {
    title: "Career Guidance",
    eyebrow: "Direction & planning",
    description: "Understand how your qualification, interests and next steps connect to realistic study and career pathways.",
    to: "/get-started?persona=unsure&need=general_guidance",
    cta: "Start career guidance",
    icon: Compass,
    motif: <><Compass className="absolute bottom-7 right-8 h-14 w-14 text-white/90"/><div className="absolute left-8 top-8 h-20 w-20 rounded-full border border-white/20"/><div className="absolute left-12 top-12 h-12 w-12 rounded-full border border-white/30"/></>,
    gradient: "from-emerald-500 via-teal-600 to-cyan-700",
  },
];

export const Opportunities: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="ResKonnect Opportunities | WIL, Internships & Student Support"
        description="Discover WIL readiness support, internship guidance, student referral campaigns and career pathway support through ResKonnect."
        keywords="WIL placement, work integrated learning, internship support, student opportunities"
        canonicalPath="/opportunities"
      />

      <div className="bg-gradient-to-b from-primary/5 via-background to-background py-16 md:py-24">
        <div className="container mx-auto space-y-16 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <Badge variant="outline" className="rounded-full px-4 py-1">Living · Applications · Opportunities</Badge>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Opportunities & Placements Hub</h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">Step from study into industry with clear pathways for WIL readiness, internships, career guidance and published student campaigns.</p>
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {opportunityCards.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="group overflow-hidden border-border/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div className={`relative h-40 overflow-hidden bg-gradient-to-br ${item.gradient}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,.28),transparent_35%)]" />
                    {item.motif}
                    <div className="absolute left-4 top-4 rounded-full border border-white/25 bg-black/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur">{item.eyebrow}</div>
                  </div>
                  <CardContent className="flex min-h-[230px] flex-col p-5">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                    <h2 className="text-lg font-bold">{item.title}</h2>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                    <Button asChild variant="link" className="mt-auto justify-start p-0 pt-5 text-primary">
                      <Link to={item.to}>{item.cta}<ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
            <div className="rounded-3xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><FileCheck2 className="h-5 w-5 text-primary" /></div><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Before you apply</p><h3 className="font-bold">Get opportunity-ready</h3></div></div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Use ResKonnect to prepare your documents, understand requirements and organise your next step before following an official employer or programme application route.</p>
            </div>
            <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-wider text-primary">For employers & institutions</p><h3 className="font-bold">Publish and collaborate</h3></div></div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Work with ResKonnect to source talent, support WIL pathways and publish verified opportunities with clear requirements and closing dates.</p>
              <Button asChild className="mt-4"><Link to="/get-started?persona=institution_business&need=partner_solution">Partner with us</Link></Button>
            </div>
          </div>

          <div className="mx-auto max-w-5xl">
            <SeoInternalLinks
              heading="Opportunity pathways"
              links={[
                { label: "WIL placement support", to: "/opportunities/wil-placement-support", description: "Get placement-ready for your WIL component." },
                { label: "Internships", to: "/opportunities/internships", description: "Browse internship and graduate opportunity pathways." },
                { label: "SETA opportunities", to: "/opportunities/seta", description: "Explore SETA-linked workplace experience opportunities." },
                { label: "Application readiness", to: "/applications/application-readiness", description: "Prepare your next study or opportunity application." },
              ]}
            />
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default Opportunities;