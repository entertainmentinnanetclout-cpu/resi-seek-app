import StudentCareLinks from "@/components/landing/StudentCareLinks";
import SEO from "@/components/SEO";
import SeoInternalLinks from "@/components/seo/SeoInternalLinks";
import SEOJsonLd from "@/components/SEOJsonLd";
import { BrainCircuit, Shield, MapPin, DollarSign, FileCheck, Users, Building2, Award, BadgeCheck, Rotate3D } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import HeroCarousel from "@/components/HeroCarousel";
import VisualPageBlock from "@/components/admin/VisualPageBlock";
import {useVisualPageSections} from "@/hooks/useVisualPageSections";
import PremiumResidenceShowcase from "@/components/findmyres/PremiumResidenceShowcase";
import LivingSearchDock from "@/components/findmyres/LivingSearchDock";
 import MonthlyTopThree from "@/components/findmyres/MonthlyTopThree";
 import {usePublicLivingSignals} from "@/hooks/usePublicLivingSignals";
import {useLandingSpotlightResidences} from "@/hooks/useLandingSpotlightResidences";
import FloatingShapes from "@/components/FloatingShapes";
import GoldTiltCard from "@/components/premium/GoldTiltCard";
import "@/styles/premium-gold-depth.css";
import { AudienceSelector } from "@/components/findmyres/AudienceSelector";
import InteractiveNeedSection from "@/components/onboarding/InteractiveNeedSection";
import { BRAND } from "@/constants/brand";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
const footerLogo = BRAND.logos.full;
const iconLogo = BRAND.logos.icon;
import inclusivePathwaysHero from "@/assets/hero-inclusive-pathways.jpg";
import applicationsFundingHero from "@/assets/hero-applications-funding.jpg";

const TrustedLivingShowcase = lazy(() => import("@/components/landing/TrustedLivingShowcase"));
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
  const livingSignals=usePublicLivingSignals();
  const {byKey,isPreview}=useVisualPageSections("landing");
  const {residences:spotlightResidences,loading:spotlightLoading}=useLandingSpotlightResidences();
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
      title: "From your campus search to your next opportunity — ResKonnect.",
      description: "Find a place to live, navigate applications and discover work-integrated learning opportunities with ResKonnect Living, AI and Opportunity working together.",
      cta: { text: "Explore ResKonnect", action: () => navigate("/get-started") }
    },
    {
      image: applicationsFundingHero,
      title: "Your studies. Your accommodation. Your future. Konnected.",
      description: "Discover property listings, prepare student applications, check funding requirements and use ResKonnect AI to understand what comes next.",
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
    "slogan": "Building Africa's First AI/SI-Powered Student Platform",
    "description": "ResKonnect is a South African student accommodation, applications and opportunities platform combining artificial intelligence and service intelligence. Our ambition is to build an Africa-wide connected student journey.",
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
    "featureList": ["student accommodation search by city and budget", "AI and service intelligence guidance", "application readiness", "course and APS guidance", "student bursaries", "WIL placement support", "private rental and residence matching"],
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
    <div className="rk-motion rk-living-surface flex min-h-screen flex-col bg-background text-foreground">
      <SEO
        title="Student Accommodation, Applications & WIL | ResKonnect"
        description="Search student accommodation in Pretoria, Soshanguve, Ga-Rankuwa, Mbombela and Polokwane. Explore single rooms, NSFAS funding checks, applications, bursaries and WIL with ResKonnect AI/SI."
        keywords="ResKonnect, student accommodation Pretoria, student housing Soshanguve, student rooms Mbombela, Ga-Rankuwa accommodation, Polokwane accommodation, NSFAS, WIL placements, bursaries, private rentals"
        canonicalPath="/"
      />
      <SEOJsonLd schema={[organizationSchema, websiteSchema, applicationSchema, faqSchema]} />

      <SiteHeader />

      <main className="flex flex-col">
        
        <VisualPageBlock page="landing" sectionKey="hero" slot={byKey["hero"]} preview={isPreview}>
        <section>
          <HeroCarousel slides={fallbackSlides} autoPlay interval={6000} useDatabase={true} location="landing" />
        </section>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="search" slot={byKey["search"]} preview={isPreview}>
        <LivingSearchDock/>
        {/* Highest-visibility accommodation placement immediately after the homepage hero. */}
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="spotlight" slot={byKey["spotlight"]} preview={isPreview}>
        <PremiumResidenceShowcase residences={spotlightResidences} loading={spotlightLoading} surface="landing" headline={byKey.spotlight?.headline} subtitle={byKey.spotlight?.subtitle}/>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="top3" slot={byKey["top3"]} preview={isPreview}>
        <MonthlyTopThree signals={livingSignals} surface="landing" headline={byKey.top3?.headline} subtitle={byKey.top3?.subtitle}/>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="vision" slot={byKey["vision"]} preview={isPreview}>
        <section className="border-b bg-background py-9 md:py-14">
          <div className="container mx-auto px-4 text-center">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-primary">OUR VISION · AFRICA'S FIRST AI/SI-POWERED STUDENT PLATFORM</p>
            <h1 className="mx-auto max-w-5xl text-3xl font-black leading-tight md:text-5xl lg:text-6xl">
              {byKey.vision?.headline||<>ResKonnect — <span className="text-primary">Building Africa's First AI/SI-Powered Student Platform.</span></>}
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-lg">
              {byKey.vision?.subtitle||"From student accommodation and single-room searches to applications, NSFAS funding checks, bursaries and WIL placements — ResKonnect connects Artificial Intelligence (AI) with Service Intelligence (SI) to help students make informed next steps."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={() => navigate("/findmyres")}>Find Student Accommodation</Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/ai")}>Ask ResKonnect AI</Button>
            </div>
          </div>
        </section>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="cities" slot={byKey["cities"]} preview={isPreview}>
        <section aria-labelledby="discover-reskonnect" className="border-b bg-background py-11 md:py-14">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Student accommodation in South Africa</p>
              <h2 id="discover-reskonnect" className="mt-2 text-2xl font-black tracking-tight text-foreground md:text-4xl">{byKey.cities?.headline||"A campus nearby. A place that works for you. Found on ResKonnect."}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">{byKey.cities?.subtitle||"Explore the areas where ResKonnect has published residence records. Check property addresses, funding acceptance, room types and real provider prices when supplied. Missing prices are not advertised as budget offers."}</p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Pretoria", "/student-accommodation/pretoria"],
                ["Soshanguve", "/student-accommodation/soshanguve"],
                ["Ga-Rankuwa", "/student-accommodation/ga-rankuwa"],
                ["Mbombela", "/student-accommodation/mbombela"],
                ["Polokwane", "/student-accommodation/polokwane"]
              ].map(([city, url]) => (
                <Link key={url} to={url} className="group rk-neo-panel rk-motion-card px-4 py-5 transition hover:border-primary/60 hover:bg-primary/5">
                  <MapPin className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
                  <span className="block text-base font-bold">{city}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Student rooms & residences →</span>
                </Link>
              ))}
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Single student rooms", "/student-accommodation/single-rooms", "Single occupancy, privacy and room rules"],
                ["NSFAS no-top-up checklist", "/student-accommodation/nsfas-no-top-up", "Check full cost and current funding rules"],
                ["Rooms from a R1,500 budget", "/student-accommodation/r1500-to-budget", "Use a budget filter; availability not guaranteed"],
                ["Private-paying accommodation", "/student-accommodation/private-paying", "Compare private rentals and deposits"],
                ["All room and property types", "/student-accommodation/room-types", "Shared rooms, communes, residences and flats"],
                ["NSFAS funding acceptance", "/student-accommodation/nsfas-accredited", "Separate acceptance from official accreditation"]
              ].map(([label, to, desc]) => (
                <Link key={to} to={to} className="rk-neo-panel rk-motion-card p-4 transition hover:border-primary/60 hover:shadow-sm">
                  <span className="block text-sm font-bold text-foreground">{label} →</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{desc}</span>
                </Link>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-border/70 pt-6 text-sm">
              <Link className="font-semibold text-primary underline underline-offset-4" to="/applications">University & TVET applications</Link>
              <Link className="font-semibold text-primary underline underline-offset-4" to="/opportunities/wil">WIL placement support</Link>
              <Link className="font-semibold text-primary underline underline-offset-4" to="/bursaries">Bursaries & funding</Link>
              <Link className="font-semibold text-primary underline underline-offset-4" to="/properties">Student housing property intelligence</Link>
            </div>
          </div>
        </section>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="pillars" slot={byKey["pillars"]} preview={isPreview}>
        <section className="border-b bg-gradient-to-b from-[#fff9e7] via-background to-background py-10 md:py-14 dark:from-[#171b21]">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">One ResKonnect journey</p>
              <h2 className="mt-2 text-3xl font-black md:text-4xl">Three pillars. <span className="rk-gold-foil">One platform.</span></h2>
              <p className="mx-auto mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">Specialised capabilities such as ResMap, Luna and Dimpho strengthen the journey underneath these three master ResKonnect pillars.</p>
            </div>
            <div className="mx-auto mt-7 grid max-w-6xl gap-4 md:grid-cols-3">
              <GoldTiltCard><Card className="border-emerald-500/15 bg-card shadow-sm"><CardContent className="p-6"><Building2 className="h-8 w-8 text-emerald-600" /><h3 className="mt-4 text-xl font-black">Living</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Find verified student accommodation, private-rental support, roommates and connected housing services.</p><Button variant="link" className="mt-3 p-0" onClick={() => navigate("/living")}>Explore Living →</Button></CardContent></Card></GoldTiltCard>
              <GoldTiltCard><Card className="border-violet-500/15 bg-card shadow-sm"><CardContent className="p-6"><BrainCircuit className="h-8 w-8 text-violet-600" /><h3 className="mt-4 text-xl font-black">AI</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Ask grounded questions, understand your next action and use account-aware ResKonnect guidance.</p><Button variant="link" className="mt-3 p-0" onClick={() => navigate("/ai")}>Ask ResKonnect AI →</Button></CardContent></Card></GoldTiltCard>
              <GoldTiltCard><Card className="border-amber-500/15 bg-card shadow-sm"><CardContent className="p-6"><Award className="h-8 w-8 text-amber-600" /><h3 className="mt-4 text-xl font-black">Opportunity</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Move into applications, education pathways, bursaries, WIL, careers and verified student opportunities.</p><Button variant="link" className="mt-3 p-0" onClick={() => navigate("/opportunities")}>Explore Opportunity →</Button></CardContent></Card></GoldTiltCard>
            </div>
          </div>
        </section>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="gmail-privacy" slot={byKey["gmail-privacy"]} preview={isPreview}>
        <section aria-label="ResKonnect Gmail integration and privacy" className="border-y border-slate-200 bg-slate-50 py-8 text-slate-800">
          <div className="container mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 px-4 md:flex-row md:items-center">
            <div className="max-w-3xl">
              <h2 className="text-xl font-bold text-[#10213a]">Public information about ResKonnect and Google Gmail</h2>
              <p className="mt-2 text-sm leading-relaxed">
                ResKonnect connects students with accommodation, applications and opportunities. Approved residence owners,
                managers and administrators may choose to connect their own Gmail account to send accommodation case updates,
                document requests, reservation notices and move-in instructions. The optional <strong>Gmail send-only</strong>
                permission does not grant ResKonnect access to read, edit or delete a user's Gmail inbox.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                <a href="/privacy" className="text-[#164d9c] underline underline-offset-4">Privacy Policy & Google user data</a>
                <a href="/terms" className="text-[#164d9c] underline underline-offset-4">Terms of Service</a>
                <a href="/partners/landlords" className="text-[#164d9c] underline underline-offset-4">For accommodation providers</a>
              </div>
            </div>
            <a href="mailto:reskonnect@gmail.com" className="shrink-0 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-[#10213a] hover:bg-slate-100">
              Contact ResKonnect
            </a>
          </div>
        </section>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="student-care" slot={byKey["student-care"]} preview={isPreview}>
        <StudentCareLinks />
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="intake" slot={byKey["intake"]} preview={isPreview}>
        <InteractiveNeedSection />
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="automation" slot={byKey["automation"]} preview={isPreview}>
        <DeferredSection minHeight={420}><AutomationAdvantageSection /></DeferredSection>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="resmap" slot={byKey["resmap"]} preview={isPreview}>
        <DeferredSection minHeight={520}><LandingResMap3DPreview /></DeferredSection>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="audience" slot={byKey["audience"]} preview={isPreview}>
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
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="trusted" slot={byKey["trusted"]} preview={isPreview}>
        <section className="py-12 md:py-20 bg-card/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <DeferredSection minHeight={520}><TrustedLivingShowcase signals={livingSignals} headline={byKey.trusted?.headline} subtitle={byKey.trusted?.subtitle}/></DeferredSection>
          </div>
        </section>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="categories" slot={byKey["categories"]} preview={isPreview}>
        <DeferredSection minHeight={280}><CategoryHeroSelector /></DeferredSection>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="accreditation" slot={byKey["accreditation"]} preview={isPreview}>
        <DeferredSection minHeight={220}><AccreditationCTA /></DeferredSection>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="about" slot={byKey["about"]} preview={isPreview}>
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
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="landlord" slot={byKey["landlord"]} preview={isPreview}>
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
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="benefits" slot={byKey["benefits"]} preview={isPreview}>
        <section className="py-12 md:py-20 relative overflow-hidden">
          <FloatingShapes />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">{byKey.benefits?.headline||"Why Choose ResKonnect?"}</h2>
            {byKey.benefits?.subtitle&&<p className="mx-auto mb-3 max-w-2xl text-center text-sm text-muted-foreground">{byKey.benefits.subtitle}</p>}
            <div className="mb-10" aria-hidden="true"/>
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
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="faq" slot={byKey["faq"]} preview={isPreview}>
        <section className="border-y bg-card/50 py-12 md:py-16">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center"><h2 className="text-3xl font-black">{byKey.faq?.headline||"ResKonnect, answered clearly"}</h2><p className="mt-2 text-sm text-muted-foreground">{byKey.faq?.subtitle||"Canonical facts for students, partners, search engines and AI answer systems."}</p></div>
            <div className="mt-7 space-y-4">
              <div className="rounded-2xl border bg-background p-5"><h3 className="font-black">Does ResKonnect guarantee accommodation placement?</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Yes. ResKonnect guarantees accommodation placement for eligible placement clients who complete the required placement process, provide the required documents and accept an available suitable accommodation match. This guarantee is specifically for accommodation placement and does not promise a specific building or room when live inventory changes.</p></div>
              <div className="rounded-2xl border bg-background p-5"><h3 className="font-black">What makes ResMap different?</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">ResMap connects mapped residence discovery with photorealistic 3D exploration, live GPS routing, arrival states and immersive Street View navigation instead of treating the map as a static pin directory.</p></div>
              <div className="rounded-2xl border bg-background p-5"><h3 className="font-black">Is ResKonnect only for South Africa?</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">ResKonnect's current live accommodation inventory is concentrated in South Africa, while the technology and growth strategy are built around transforming student accommodation discovery and placement across African markets.</p></div>
            </div>
          </div>
        </section>
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="contact" slot={byKey["contact"]} preview={isPreview}>
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
        </VisualPageBlock>

        <VisualPageBlock page="landing" sectionKey="seo-links" slot={byKey["seo-links"]} preview={isPreview}>
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
        </VisualPageBlock>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Landing;
