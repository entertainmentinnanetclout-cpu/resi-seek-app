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
import { useRef } from "react";
import HeroCarousel from "@/components/HeroCarousel";
import FloatingShapes from "@/components/FloatingShapes";
import TrustedResidencesGrid from "@/components/TrustedResidencesGrid";
import { CategoryHeroSelector } from "@/components/findmyres/CategoryHeroSelector";
import { AccreditationCTA } from "@/components/findmyres/AccreditationCTA";
import { AudienceSelector } from "@/components/findmyres/AudienceSelector";
import LandlordApplicationTabs from "@/components/LandlordApplicationTabs";
import InteractiveNeedSection from "@/components/onboarding/InteractiveNeedSection";
import AutomationAdvantageSection from "@/components/AutomationAdvantageSection";
import LandingResMap3DPreview from "@/components/resmap/LandingResMap3DPreview";
import { BRAND } from "@/constants/brand";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
const footerLogo = BRAND.logos.full;
const iconLogo = BRAND.logos.icon;
import inclusivePathwaysHero from "@/assets/hero-inclusive-pathways.jpg";
import applicationsFundingHero from "@/assets/hero-applications-funding.jpg";

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
      title: "Student accommodation discovery, rebuilt for the AI era.",
      description: "Ask Dimpho. Explore the real area in ResMap 3D. Navigate live. Move from search into the ResKonnect accommodation placement process — all in one connected platform built in Africa.",
      cta: { text: "Find My Res", action: () => navigate("/findmyres") }
    },
    {
      image: applicationsFundingHero,
      title: "From search to placement — with intelligence at every step.",
      description: "Verified accommodation discovery, photorealistic 3D exploration, live route guidance, application readiness and student opportunity intelligence through one ResKonnect journey.",
      cta: { text: "Explore ResMap 3D", action: () => navigate("/findmyres?view=map&mode=3d") }
    }
  ];

  const features = [
    { icon: Shield, title: "Verified Discovery", description: "Browse mapped student accommodation with verification and live listing context.", cta: { label: "Browse Residences", to: "/findmyres" } },
    { icon: Rotate3D, title: "ResMap 3D", description: "Explore photorealistic 3D areas and switch into live route and immersive Street View navigation.", cta: { label: "Explore in 3D", to: "/findmyres?view=map&mode=3d" } },
    { icon: BrainCircuit, title: "Dimpho AI", description: "Use ResKonnect intelligence to reshape accommodation discovery around what you actually need.", cta: { label: "Find My Res", to: "/findmyres" } },
    { icon: BadgeCheck, title: "Placement Guarantee", description: "Eligible placement clients who complete the required process and accept an available suitable match are covered by ResKonnect's accommodation placement guarantee.", cta: { label: "Start Placement", to: "/get-started" } },
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
    "description": "ResKonnect is an Africa-built student accommodation technology platform combining verified accommodation discovery, Dimpho AI, photorealistic ResMap 3D, live navigation, accommodation placement workflows, application readiness and student opportunity intelligence.",
    "parentOrganization": { "@type": "Organization", "name": "Start To Up", "url": "https://www.start-to-up.co.za/" },
    "email": "reskonnect@gmail.com",
    "telephone": "+27637323192",
    "areaServed": { "@type": "Country", "name": "South Africa" },
    "knowsAbout": ["student accommodation", "AI accommodation discovery", "3D student accommodation maps", "student accommodation placement", "student applications", "WIL opportunities"],
    "contactPoint": { "@type": "ContactPoint", "telephone": "+27-63-732-3192", "contactType": "customer service", "email": "reskonnect@gmail.com" },
  };
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://www.reskonnect.org/#website",
    "name": "ResKonnect",
    "url": "https://www.reskonnect.org",
    "publisher": { "@id": "https://www.reskonnect.org/#organization" },
    "potentialAction": { "@type": "SearchAction", "target": "https://www.reskonnect.org/findmyres?q={search_term_string}", "query-input": "required name=search_term_string" },
  };
  const applicationSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "ResKonnect Find My Res",
    "url": "https://www.reskonnect.org/findmyres",
    "applicationCategory": "LifestyleApplication",
    "operatingSystem": "Web",
    "description": "AI-assisted student accommodation discovery with Dimpho, ResMap 3D, live location navigation, immersive Street View and accommodation placement workflows.",
    "featureList": ["Dimpho AI accommodation discovery", "ResMap photorealistic 3D", "live route navigation", "immersive Street View", "verified residence discovery", "accommodation placement workflow"],
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
        "name": "Who is Dimpho?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Dimpho is ResKonnect's AI service and intelligence layer for accommodation discovery and student journey guidance. In ResMap, Dimpho can interpret a student's needs and reshape map discovery around relevant accommodation criteria."
        }
      }
    ]
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SEO
        title="ResKonnect | Dimpho AI Student Accommodation & ResMap 3D"
        description="Africa-built student accommodation technology combining Dimpho AI, verified accommodation discovery, ResMap 3D, live navigation and guaranteed accommodation placement for eligible placement clients."
        keywords="ResKonnect, student accommodation Africa, Dimpho AI, ResMap 3D, AI student accommodation, photorealistic accommodation map, guaranteed student accommodation placement, student housing technology Africa"
        canonicalPath="/"
      />
      <SEOJsonLd schema={[organizationSchema, websiteSchema, applicationSchema, faqSchema]} />

      <SiteHeader />

      <main>
        <section>
          <HeroCarousel slides={fallbackSlides} autoPlay interval={6000} useDatabase={true} location="landing" />
        </section>

        <section className="border-b bg-background py-7 md:py-10">
          <div className="container mx-auto px-4 text-center">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-primary">Africa-built student accommodation technology</p>
            <h1 className="mx-auto max-w-5xl text-2xl font-black leading-tight md:text-4xl lg:text-5xl">
              ResKonnect is building a new category of <span className="text-primary">AI-powered student accommodation discovery and placement.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Dimpho AI, ResMap 3D, immersive navigation, verified accommodation and a defined accommodation placement guarantee now operate as one connected student journey — built in Africa with the ambition to transform how accommodation is found across the continent.
            </p>
          </div>
        </section>

        <AutomationAdvantageSection />

        <LandingResMap3DPreview />

        <section className="border-b bg-gradient-to-b from-primary/5 to-background py-10 md:py-14">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">The ResKonnect difference</p>
              <h2 className="mt-2 text-3xl font-black md:text-4xl">More than a listing marketplace.</h2>
              <p className="mx-auto mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">ResKonnect connects discovery, intelligence, exploration, navigation and placement into a single accommodation operating layer for students and partners.</p>
            </div>
            <div className="mx-auto mt-7 grid max-w-6xl gap-4 md:grid-cols-3">
              <Card className="border-primary/15 bg-card shadow-sm"><CardContent className="p-6"><BrainCircuit className="h-8 w-8 text-primary" /><h3 className="mt-4 text-xl font-black">Ask Dimpho</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Move beyond static filters. Dimpho interprets accommodation needs and helps students navigate ResKonnect's connected data and services.</p></CardContent></Card>
              <Card className="border-primary/15 bg-card shadow-sm"><CardContent className="p-6"><Rotate3D className="h-8 w-8 text-primary" /><h3 className="mt-4 text-xl font-black">Explore in ResMap 3D</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">See mapped areas in photorealistic 3D where imagery exists, then switch into live routes and immersive real-world Street View navigation.</p></CardContent></Card>
              <Card className="border-primary/15 bg-card shadow-sm"><CardContent className="p-6"><BadgeCheck className="h-8 w-8 text-primary" /><h3 className="mt-4 text-xl font-black">Accommodation placement guarantee</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Eligible placement clients who complete the required process, submit required documents and accept an available suitable match are covered by the ResKonnect accommodation placement guarantee.</p></CardContent></Card>
            </div>
          </div>
        </section>

        <InteractiveNeedSection />

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
            <TrustedResidencesGrid />
          </div>
        </section>

        <CategoryHeroSelector />

        <AccreditationCTA />

        <section className="py-12 md:py-20 bg-card/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-6xl mx-auto">
              <div className="order-2 md:order-1">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-primary">About ResKonnect</p>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">An African technology company rethinking the student accommodation journey.</h2>
                <p className="text-muted-foreground mb-4 leading-relaxed">ResKonnect combines accommodation discovery with AI intelligence, spatial exploration and real placement operations. Students can move from finding options to understanding the surrounding area, navigating to a property and entering a supported placement journey without stitching together unrelated tools.</p>
                <p className="text-muted-foreground mb-6 leading-relaxed">South Africa is the current live operating base for accommodation inventory. The product and technology are being built for a broader African student-housing future rather than being positioned as a Pretoria-only directory.</p>
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
                <img src={iconLogo} alt="ResKonnect African student accommodation technology platform" className="w-32 md:w-48 h-auto opacity-70 group-hover:scale-110 transition-transform duration-500" />
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
            <LandlordApplicationTabs />
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
