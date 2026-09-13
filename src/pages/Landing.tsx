import SEO from "@/components/SEO";
import SeoInternalLinks from "@/components/seo/SeoInternalLinks";
import SEOJsonLd from "@/components/SEOJsonLd";
import { BrainCircuit, Shield, MapPin, DollarSign, FileCheck, Users, Building2, Award, BadgeCheck, Rotate3D } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import HeroCarousel from "@/components/HeroCarousel";
import FloatingShapes from "@/components/FloatingShapes";
import { AudienceSelector } from "@/components/findmyres/AudienceSelector";
import InteractiveNeedSection from "@/components/onboarding/InteractiveNeedSection";
import { BRAND } from "@/constants/brand";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
const footerLogo = BRAND.logos.full;
const iconLogo = BRAND.logos.icon;
import inclusivePathwaysHero from "@/assets/hero-inclusive-pathways.jpg";
import applicationsFundingHero from "@/assets/hero-applications-funding.jpg";

const TrustedResidencesGrid = lazy(() => import("@/components/TrustedResidencesGrid"));
const LandlordApplicationTabs = lazy(() => import("@/components/LandlordApplicationTabs"));
const AutomationAdvantageSection = lazy(() => import("@/components/AutomationAdvantageSection"));
const LandingResMap3DPreview = lazy(() => import("@/components/resmap/LandingResMap3DPreview"));
const CategoryHeroSelector = lazy(() => import("@/components/findmyres/CategoryHeroSelector").then((module) => ({ default: module.CategoryHeroSelector })));
const AccreditationCTA = lazy(() => import("@/components/findmyres/AccreditationCTA").then((module) => ({ default: module.AccreditationCTA })));

function DeferredSection({ children, minHeight = 220 }: { children: React.ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const node = ref.current;
    if (!node || !("IntersectionObserver" in window)) {
      setMounted(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setMounted(true);
        observer.disconnect();
      }
    }, { rootMargin: "700px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <div ref={ref} style={!mounted ? { minHeight } : undefined}>
      {mounted ? <Suspense fallback={<div style={{ minHeight }} aria-hidden="true" />}>{children}</Suspense> : null}
    </div>
  );
}

const Landing = () => {
  const navigate = useNavigate();
  const landlordRef = useRef<HTMLDivElement>(null);

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success("Thank you! We'll get back to you soon.");
    e.currentTarget.reset();
  };

  const scrollToLandlord = () => {
    landlordRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fallbackSlides = [
    {
      image: inclusivePathwaysHero,
      title: "Everything students need to move forward. Connected.",
      description: "Living, intelligent guidance and real opportunities through one ResKonnect journey — from finding a place to understanding your next step and accessing what comes next.",
      cta: { text: "Explore ResKonnect", action: () => navigate("/get-started") }
    },
    {
      image: applicationsFundingHero,
      title: "One account. One journey. Smarter next steps.",
      description: "Find accommodation, prepare applications, ask ResKonnect AI and discover verified bursaries, WIL and student opportunities without stitching together unrelated services.",
      cta: { text: "Ask ResKonnect AI", action: () => navigate("/ai") }
    }
  ];

  const features = [
    { icon: Building2, title: "Living", description: "Find verified student accommodation, private-rental support and connected Living services in one place.", cta: { label: "Explore Living", to: "/living" } },
    { icon: BrainCircuit, title: "ResKonnect AI", description: "Ask grounded questions, understand your next action and use account-aware guidance when signed in.", cta: { label: "Ask ResKonnect AI", to: "/ai" } },
    { icon: Award, title: "Opportunity", description: "Move from study into applications, bursaries, WIL, career pathways and verified student opportunities.", cta: { label: "Explore Opportunity", to: "/opportunities" } },
    { icon: FileCheck, title: "Connected Service", description: "One profile, one journey and clear next actions across ResKonnect services instead of disconnected forms and channels.", cta: { label: "Get Started", to: "/get-started" } },
  ];

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://www.reskonnect.org/#organization",
    "name": "ResKonnect",
    "alternateName": ["RESKONNECT", "Res Konnect", "ResConnect"],
    "url": "https://www.reskonnect.org",
    "logo": "https://www.reskonnect.org/icon-512.png",
    "slogan": "Connecting Residents. Advancing Futures.",
    "description": "ResKonnect is an integrated Living, AI and Opportunity platform connecting student accommodation, intelligent guidance, applications, education pathways, bursaries, WIL and verified opportunities through one connected journey.",
    "parentOrganization": { "@type": "Organization", "name": "Start To Up", "url": "https://www.start-to-up.co.za/" },
    "email": "reskonnect@gmail.com",
    "telephone": "+27637323192",
    "areaServed": { "@type": "Country", "name": "South Africa" },
    "knowsAbout": ["student accommodation", "student living", "student artificial intelligence", "student applications", "course guidance", "bursaries", "WIL opportunities", "student opportunities"],
    "contactPoint": { "@type": "ContactPoint", "telephone": "+27-63-732-3192", "contactType": "customer service", "email": "reskonnect@gmail.com" },
  };
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://www.reskonnect.org/#website",
    "name": "ResKonnect",
    "url": "https://www.reskonnect.org",
    "publisher": { "@id": "https://www.reskonnect.org/#organization" },
    "potentialAction": { "@type": "SearchAction", "target": "https://www.reskonnect.org/ai?q={search_term_string}", "query-input": "required name=search_term_string" },
  };
  const applicationSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "ResKonnect",
    "url": "https://www.reskonnect.org",
    "applicationCategory": "LifestyleApplication",
    "operatingSystem": "Web",
    "description": "Integrated student platform for Living, grounded AI guidance, applications and opportunity discovery through one ResKonnect account.",
    "featureList": ["verified accommodation discovery", "ResKonnect AI", "application readiness", "course and APS guidance", "bursaries", "WIL and opportunity discovery", "student journey next actions"],
    "publisher": { "@id": "https://www.reskonnect.org/#organization" },
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Does ResKonnect guarantee student accommodation placement?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. ResKonnect guarantees accommodation placement for eligible placement clients who complete the required placement process, provide the required documents and accept an available suitable accommodation match. The guarantee applies to accommodation placement, not a specific room or third-party outcomes such as institution admission, NSFAS funding, WIL placement or employment."
        }
      },
      {
        "@type": "Question",
        "name": "What is ResMap 3D?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ResMap is ResKonnect's live accommodation map experience. It combines mapped residences, location filters, live routing, immersive Street View and photorealistic 3D exploration where Google Maps imagery coverage is available."
        }
      },
      {
        "@type": "Question",
        "name": "What is ResKonnect AI?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ResKonnect AI is the intelligence layer across Living, applications and opportunities. Luna is the website-facing agent and Dimpho is the WhatsApp-facing agent; both operate underneath ResKonnect AI and use verified ResKonnect context where available."
        }
      }
    ]
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SEO
        title="ResKonnect | Living • AI • Opportunity"
        description="ResKonnect connects Living, AI and Opportunity in one integrated student platform for accommodation, intelligent guidance, applications, bursaries, WIL and verified opportunities."
        keywords="ResKonnect, Living AI Opportunity, student platform South Africa, student accommodation, student AI, applications, bursaries, WIL, student opportunities"
        canonicalPath="/"
      />
      <SEOJsonLd schema={[organizationSchema, websiteSchema, applicationSchema, faqSchema]} />

      <SiteHeader />

      <main>
        <section>
          <HeroCarousel slides={fallbackSlides} autoPlay interval={6000} useDatabase={true} location="landing" />
        </section>

        <section className="border-b bg-background py-9 md:py-14">
          <div className="container mx-auto px-4 text-center">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-primary">LIVING • AI • OPPORTUNITY</p>
            <h1 className="mx-auto max-w-5xl text-3xl font-black leading-tight md:text-5xl lg:text-6xl">
              Everything students need to <span className="text-primary">move forward. Connected.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-lg">
              ResKonnect connects where students live, the intelligence they need to make decisions and the opportunities that move them forward — through one account, one profile and one connected journey.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={() => navigate("/get-started")}>Explore ResKonnect</Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/ai")}>Ask ResKonnect AI</Button>
            </div>
          </div>
        </section>

        <section className="border-b bg-gradient-to-b from-primary/5 to-background py-10 md:py-14">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">One ResKonnect journey</p>
              <h2 className="mt-2 text-3xl font-black md:text-4xl">Three pillars. One platform.</h2>
              <p className="mx-auto mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">Specialised capabilities such as ResMap, Luna and Dimpho strengthen the journey underneath these three master ResKonnect pillars.</p>
            </div>
            <div className="mx-auto mt-7 grid max-w-6xl gap-4 md:grid-cols-3">
              <Card className="border-emerald-500/15 bg-card shadow-sm"><CardContent className="p-6"><Building2 className="h-8 w-8 text-emerald-600" /><h3 className="mt-4 text-xl font-black">Living</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Find verified student accommodation, private-rental support, roommates and connected housing services.</p><Button variant="link" className="mt-3 p-0" onClick={() => navigate("/living")}>Explore Living →</Button></CardContent></Card>
              <Card className="border-violet-500/15 bg-card shadow-sm"><CardContent className="p-6"><BrainCircuit className="h-8 w-8 text-violet-600" /><h3 className="mt-4 text-xl font-black">AI</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Ask grounded questions, understand your next action and use account-aware ResKonnect guidance.</p><Button variant="link" className="mt-3 p-0" onClick={() => navigate("/ai")}>Ask ResKonnect AI →</Button></CardContent></Card>
              <Card className="border-amber-500/15 bg-card shadow-sm"><CardContent className="p-6"><Award className="h-8 w-8 text-amber-600" /><h3 className="mt-4 text-xl font-black">Opportunity</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Move into applications, education pathways, bursaries, WIL, careers and verified student opportunities.</p><Button variant="link" className="mt-3 p-0" onClick={() => navigate("/opportunities")}>Explore Opportunity →</Button></CardContent></Card>
            </div>
          </div>
        </section>

        <InteractiveNeedSection />

        <DeferredSection minHeight={420}><AutomationAdvantageSection /></DeferredSection>

        <DeferredSection minHeight={520}><LandingResMap3DPreview /></DeferredSection>

        <section className="py-8 md:py-10 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-5">
              <h2 className="text-2xl md:text-3xl font-bold">Who are you looking for?</h2>
              <p className="text-muted-foreground text-sm md:text-base mt-1">
                University, TVET college, or private — explore accommodation through one intelligent discovery platform.
              </p>
            </div>
            <div className="max-w-4xl mx-auto">
              <AudienceSelector
                audience="all"
                onChange={(v) => navigate(v === "all" ? "/findmyres" : `/findmyres?audience=${v}`)}
                onInstitutionChange={(t) =>
                  t ? navigate(`/findmyres?institution=${encodeURIComponent(t)}`) : undefined
                }
              />
            </div>
          </div>
        </section>

        <section className="py-12 md:py-20 bg-card/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <DeferredSection minHeight={520}><TrustedResidencesGrid /></DeferredSection>
          </div>
        </section>

        <DeferredSection minHeight={280}><CategoryHeroSelector /></DeferredSection>

        <DeferredSection minHeight={220}><AccreditationCTA /></DeferredSection>

        <section className="py-12 md:py-20 bg-card/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-6xl mx-auto">
              <div className="order-2 md:order-1">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-primary">About ResKonnect</p>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">An African technology company connecting student life, intelligence and opportunity.</h2>
                <p className="text-muted-foreground mb-4 leading-relaxed">ResKonnect connects Living, AI and Opportunity so students can move from finding a place to live, to understanding applications and next steps, to discovering bursaries, WIL and other opportunities without stitching together unrelated tools.</p>
                <p className="text-muted-foreground mb-6 leading-relaxed">South Africa is the current live operating base. The platform is being built as connected student infrastructure that can expand across institutions and African markets while keeping verified local service delivery at the centre.</p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => navigate("/findmyres")} className="gap-2">
                    <Users className="w-4 h-4" /> Find My Res
                  </Button>
                  <Button variant="outline" onClick={scrollToLandlord} className="gap-2">
                    <Building2 className="w-4 h-4" /> Partner as a Landlord
                  </Button>
                </div>
              </div>
              <div className="order-1 md:order-2 bg-primary/10 rounded-2xl p-8 h-64 md:h-80 flex items-center justify-center relative group">
                <img src={iconLogo} alt="ResKonnect Living AI Opportunity platform" className="w-32 md:w-48 h-auto opacity-70 group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 rounded-2xl border border-primary/20 group-hover:border-primary/40 transition-colors" />
              </div>
            </div>
          </div>
        </section>

        <section ref={landlordRef} id="landlord" className="py-12 md:py-20 relative overflow-hidden">
          <FloatingShapes className="opacity-50" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                <Award className="w-4 h-4" /> For Property Owners
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">List Your Property or Get Accredited</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Join an AI-enabled student accommodation platform. Apply to list your property, get NSFAS accreditation support, or both — while ResKonnect connects discovery, student demand and placement operations.
              </p>
            </div>
            <DeferredSection minHeight={420}><LandlordApplicationTabs /></DeferredSection>
          </div>
        </section>

        <section className="py-12 md:py-20 relative overflow-hidden">
          <FloatingShapes />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">Why Choose ResKonnect?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f, i) => (
                <Card key={i} className="bg-card shadow-sm hover:shadow-lg transition-all text-center">
                  <CardContent className="p-6 flex flex-col items-center">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4 animate-float" style={{ animationDelay: `${i * 0.2}s` }}>
                      <f.icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                    <p className="text-muted-foreground mb-3 text-sm">{f.description}</p>
                    <Button variant="link" size="sm" onClick={() => navigate(f.cta.to)} className="text-primary p-0">{f.cta.label} →</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-card/50 py-12 md:py-16">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center"><h2 className="text-3xl font-black">ResKonnect, answered clearly</h2><p className="mt-2 text-sm text-muted-foreground">Canonical facts for students, partners, search engines and AI answer systems.</p></div>
            <div className="mt-7 space-y-4">
              <div className="rounded-2xl border bg-background p-5"><h3 className="font-black">Does ResKonnect guarantee accommodation placement?</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Yes. ResKonnect guarantees accommodation placement for eligible placement clients who complete the required placement process, provide the required documents and accept an available suitable accommodation match. This guarantee is specifically for accommodation placement and does not promise a specific building or room when live inventory changes.</p></div>
              <div className="rounded-2xl border bg-background p-5"><h3 className="font-black">What makes ResMap different?</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">ResMap connects mapped residence discovery with photorealistic 3D exploration, live GPS routing, arrival states and immersive Street View navigation instead of treating the map as a static pin directory.</p></div>
              <div className="rounded-2xl border bg-background p-5"><h3 className="font-black">Is ResKonnect only for South Africa?</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">ResKonnect's current live accommodation inventory is concentrated in South Africa, while the technology and growth strategy are built around transforming student accommodation discovery and placement across African markets.</p></div>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Get in Touch</h2>
              <p className="text-muted-foreground text-center mb-6 text-sm">Have questions? We're here to help.</p>
              <Card className="bg-card shadow-sm">
                <CardContent className="p-6">
                  <form onSubmit={handleContactSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1"><Label htmlFor="name">Full Name</Label><Input id="name" name="name" required placeholder="Your name" /></div>
                      <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required placeholder="you@example.com" /></div>
                    </div>
                    <div className="space-y-1"><Label htmlFor="message">Message</Label><Textarea id="message" name="message" required placeholder="How can we help you?" rows={3} /></div>
                    <Button type="submit" className="w-full">Send Message</Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="container mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
          <SeoInternalLinks
            heading="Explore ResKonnect"
            links={[
              { label: "Find My Res", to: "/findmyres", description: "AI-assisted student accommodation discovery with ResMap." },
              { label: "Student accommodation", to: "/student-accommodation", description: "Student housing discovery and placement support." },
              { label: "Pretoria West accommodation", to: "/student-accommodation/pretoria-west", description: "Rooms in one of the busiest student areas." },
              { label: "Accommodation near TUT", to: "/student-accommodation/near-tut", description: "Mapped options around TUT campuses." },
              { label: "Application readiness", to: "/applications/application-readiness", description: "Get your documents and choices in order." },
              { label: "APS checker", to: "/applications/aps-checker", description: "Understand your admission point score." },
              { label: "WIL placement support", to: "/opportunities/wil-placement-support", description: "Prepare for workplace integrated learning." },
              { label: "Landlord partners", to: "/partners/landlords", description: "List your property and reach students." },
            ]}
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Landing;
