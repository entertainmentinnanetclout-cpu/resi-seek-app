import { ArrowRight, BrainCircuit, BriefcaseBusiness, Building2, GraduationCap, Lightbulb, Mail, MapPin, Network, Phone, ShieldCheck, Sparkles, Users, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BRAND } from "@/constants/brand";

const values = [
  {
    icon: BrainCircuit,
    title: "Intellectual empowerment",
    text: "We want technology to strengthen how young people think, decide, create and lead — not simply give them another app to use.",
  },
  {
    icon: Lightbulb,
    title: "Youth-led innovation",
    text: "We build from the realities young people experience and turn those problems into practical digital products, services and pathways.",
  },
  {
    icon: Workflow,
    title: "Practical digital infrastructure",
    text: "The strongest tool is the one that helps someone complete a real task: find a place to live, understand a course, prepare an application or reach an opportunity.",
  },
  {
    icon: Network,
    title: "Fourth Industrial Revolution readiness",
    text: "Digital fluency, responsible AI use, data literacy and adaptable problem-solving should become normal capabilities for the next generation.",
  },
  {
    icon: ShieldCheck,
    title: "Credibility and responsible access",
    text: "Where official institutions make the final decision, we say so. Our role is to make credible information easier to understand and act on.",
  },
  {
    icon: Users,
    title: "Human-centred progress",
    text: "Technology should reduce friction without removing the value of people, guidance, community and accountable support.",
  },
];

const audiences = [
  { icon: GraduationCap, title: "Students & young people", text: "Tools for living, tertiary applications, opportunity discovery, readiness, employability and digital confidence." },
  { icon: Users, title: "Lecturers & educators", text: "A platform that can complement student support by making important information, services and pathways easier to navigate." },
  { icon: Building2, title: "Institutions & government", text: "Digital systems that can improve access, communication, service delivery and the visibility of opportunities for young citizens." },
  { icon: BriefcaseBusiness, title: "Businesses & partners", text: "Practical ways to connect accommodation, work-integrated learning, recruitment, services and innovation to the student market." },
];

const About = () => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <SEO
      title="Our Story | ResKonnect | Inspired by a Real Student Experience"
      description="ResKonnect began when a TUT student lost NSFAS funding and stable accommodation in their final year. Discover the real experience that inspired a lasting practical solution for students."
      canonicalPath="/about"
    />
    <SiteHeader />

    <main className="flex-1">
      <section className="relative overflow-hidden border-b bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.45))]">
        <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="max-w-4xl">
            <Badge className="rounded-full px-3 py-1">About ResKonnect</Badge>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Built from a student’s hardest chapter. Made for brighter futures.
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
              ResKonnect did not begin with a boardroom idea. It grew from the real experience of losing financial support and a safe place to stay while trying to finish university, far from home. Today, that experience drives practical support for students navigating accommodation, applications and opportunity.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/get-started">Explore ResKonnect <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline"><a href={`mailto:${BRAND.contact.email}`}>Contact us</a></Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="overflow-hidden border-primary/20">
              <CardContent className="p-7 sm:p-9">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Our mission</p>
                <h2 className="mt-3 text-2xl font-black sm:text-3xl">Put useful digital capability within reach.</h2>
                <p className="mt-4 leading-7 text-muted-foreground">
                  Our mission is to equip students and communities with accessible digital tools, reliable information and practical pathways that strengthen independence, learning, employability, leadership and participation in a rapidly changing digital economy.
                </p>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-primary/20">
              <CardContent className="p-7 sm:p-9">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Our vision</p>
                <h2 className="mt-3 text-2xl font-black sm:text-3xl">A generation prepared to shape the digital future.</h2>
                <p className="mt-4 leading-7 text-muted-foreground">
                  We envision a South Africa where young people have the intellectual confidence, digital fluency and practical access needed to flourish in the Fourth Industrial Revolution, not as passive users of technology, but as informed participants, builders, leaders and innovators.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">What we stand for</p>
              <h2 className="mt-2 text-3xl font-black">Technology should expand human potential.</h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                ResKonnect is designed around the idea that innovation matters most when it improves a real decision, removes a real barrier or gives someone a stronger foundation for the future.
              </p>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {values.map((value) => {
                const Icon = value.icon;
                return (
                  <Card key={value.title} className="h-full">
                    <CardContent className="p-6">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                      <h3 className="mt-4 text-lg font-bold">{value.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{value.text}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/35 py-14 md:py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Built for society, starting with youth</p>
              <h2 className="mt-2 text-3xl font-black">Students come first. Our vision goes further.</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Students are at the centre of many ResKonnect products, but the wider objective is national digital enablement. Better tools can also help educators, institutions, public-sector teams, families, citizens and businesses connect to the same journey more effectively.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {audiences.map((audience) => {
                const Icon = audience.icon;
                return (
                  <Card key={audience.title}>
                    <CardContent className="p-5">
                      <Icon className="h-5 w-5 text-primary" />
                      <h3 className="mt-3 font-bold">{audience.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{audience.text}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="our-origin-heading" className="relative isolate overflow-hidden py-16 md:py-24">
        <div className="pointer-events-none absolute -right-32 top-0 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="rounded-[32px] border border-primary/20 bg-gradient-to-br from-[#061633] via-[#123f82] to-[#0b274a] p-8 text-white shadow-2xl sm:p-10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">The story behind ResKonnect</p>
              <h2 id="our-origin-heading" className="mt-5 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                Born from a struggle. Built so another student doesn’t have to face it alone.
              </h2>
              <div className="mt-8 h-1.5 w-20 rounded-full bg-amber-400" aria-hidden="true" />
              <p className="mt-7 text-lg leading-8 text-white/90">
                Some ideas are born from opportunity. Others are born from the moment you realise how difficult life can become when support disappears.
              </p>
              <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4">
                <GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" aria-hidden="true" />
                <p className="text-sm leading-6 text-white/90">
                  Founded and led by a <strong>Tshwane University of Technology marketing graduate.</strong> Built from lived student experience, with a lasting commitment to making the journey easier for others.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">A real problem. A reason to keep building.</p>
              <h3 className="text-2xl font-black leading-tight sm:text-3xl">
                In the final year, the funding was gone. Home was far away. A place to stay was no longer certain.
              </h3>
              <p className="text-base leading-8 text-muted-foreground">
                In the founder’s final year at university, NSFAS funding fell away. Far from home, without secure student accommodation or the financial support needed to carry on with peace of mind, the dream of completing an education became a daily struggle for stability.
              </p>
              <p className="text-base leading-8 text-muted-foreground">
                But that difficult chapter planted something lasting: a question about every other student caught between ambition and survival. How many young people are trying to stay in education while worrying about where they will sleep, how they will afford to live, and whether they will get the chance to finish?
              </p>
              <p className="text-base leading-8 text-muted-foreground">
                <strong className="text-foreground">That is where ResKonnect began.</strong> Not as a passing trend, but as a response to a problem experienced first-hand. The platform connects students to accommodation, clearer applications and opportunities, with a commitment to making those journeys simpler, more dignified and more human.
              </p>
              <p className="text-base leading-8 text-muted-foreground">
                The challenge did not disappear when one student’s final year ended. It continues to affect students across South Africa. That is the foundation of ResKonnect’s long-term purpose: as long as real barriers stand between a student and their future, there is a reason to keep building solutions.
              </p>
              <div className="flex flex-wrap gap-3 pt-3">
                <Button asChild size="lg" className="rounded-full"><Link to="/findmyres">Find student accommodation <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="rounded-full"><Link to="/get-started">Explore student services</Link></Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="border-t bg-primary/5 py-14 md:py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Contact ResKonnect</p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">Build, partner or get support.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                Contact us for student support, accommodation and application enquiries, institutional collaboration, digital-product partnerships, innovation projects or general information.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <a href={`tel:${BRAND.contact.phoneRaw}`} className="rounded-2xl border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm">
                  <Phone className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Phone / WhatsApp</p><p className="font-bold">{BRAND.contact.phone}</p>
                </a>
                <a href={`mailto:${BRAND.contact.email}`} className="rounded-2xl border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm">
                  <Mail className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Email</p><p className="font-bold">{BRAND.contact.email}</p>
                </a>
              </div>
            </div>
            <Card className="border-primary/20">
              <CardContent className="p-6 sm:p-7">
                <Sparkles className="h-7 w-7 text-primary" />
                <h3 className="mt-4 text-xl font-black">A platform designed for national relevance.</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  ResKonnect started by solving immediate student-life problems. The longer-term direction is broader: build dependable digital systems that help young people and communities access information, services and opportunity across South Africa.
                </p>
                <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/60 p-4">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">Digital-first support with products designed to scale beyond a single campus, residence or institution.</p>
                </div>
                <Button asChild className="mt-5 w-full"><a href={`https://wa.me/${BRAND.contact.whatsapp}`} target="_blank" rel="noreferrer">Start a WhatsApp conversation <ArrowRight className="ml-2 h-4 w-4" /></a></Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
);

export default About;
