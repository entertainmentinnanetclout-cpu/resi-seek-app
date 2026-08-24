import SEO from "@/components/SEO";
import SeoInternalLinks from "@/components/seo/SeoInternalLinks";
import SEOJsonLd from "@/components/SEOJsonLd";
import { Shield, MapPin, DollarSign, FileCheck, Menu, Users, Building2, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState, useRef } from "react";
import HeroCarousel from "@/components/HeroCarousel";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import FloatingShapes from "@/components/FloatingShapes";
import TrustedResidencesGrid from "@/components/TrustedResidencesGrid";
import { CategoryHeroSelector } from "@/components/findmyres/CategoryHeroSelector";
import { AccreditationCTA } from "@/components/findmyres/AccreditationCTA";
import { AudienceSelector } from "@/components/findmyres/AudienceSelector";
import LandlordApplicationTabs from "@/components/LandlordApplicationTabs";
import InteractiveNeedSection from "@/components/onboarding/InteractiveNeedSection";
import { BRAND } from "@/constants/brand";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
const headerLogo = BRAND.logos.full;
const footerLogo = BRAND.logos.full;
const iconLogo = BRAND.logos.icon;
import studentStudying from "@/assets/student-studying.jpg";
import studentsCelebration from "@/assets/students-celebration.jpg";
import inclusivePathwaysHero from "@/assets/hero-inclusive-pathways.jpg";
import applicationsFundingHero from "@/assets/hero-applications-funding.jpg";

const Landing = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setMenuOpen] = useState(false);
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
      title: "One connected platform for Living, Applications, Opportunities, and Partner Solutions.",
      description: "Find verified student accommodations, college & university application checkers, WIL/internship support, and enterprise property portals all in one place.",
      cta: { text: "Get Started", action: () => navigate("/get-started") }
    },
    {
      image: applicationsFundingHero,
      title: "Guidance, Readiness Checks & Placement Assistance",
      description: "Prepare your tertiary documents, match room types near your campus, and prepare for career opportunities seamlessly.",
      cta: { text: "Get Started Now", action: () => navigate("/get-started") }
    }
  ];

  const features = [
    { icon: Shield, title: "Secure & Verified", description: "All residences are verified and meet safety standards.", cta: { label: "Browse Residences", to: "/find" } },
    { icon: MapPin, title: "Close to Campus", description: "Find accommodation within walking distance of your university.", cta: { label: "Find Near You", to: "/find" } },
    { icon: DollarSign, title: "Affordable Options", description: "Browse residences that fit your budget with transparent pricing.", cta: { label: "See Prices", to: "/find" } },
    { icon: FileCheck, title: "Easy Applications", description: "Apply to multiple residences with our simple process.", cta: { label: "Apply Now", to: "/auth" } },
  ];

  const organizationSchema = {
    "@context": "https://schema.org", "@type": "Organization", "name": "ResKonnect",
    "alternateName": "RESKONNECT",
    "url": "https://www.reskonnect.org", "logo": "https://www.reskonnect.org/icon-512.png",
    "description": "ResKonnect is a student journey platform for accommodation, application readiness, WIL support, and partner solutions.",
    "email": "reskonnect@gmail.com",
    "telephone": "+27637323192",
    "contactPoint": { "@type": "ContactPoint", "telephone": "+27-63-732-3192", "contactType": "customer service", "email": "Reskonnect@gmail.com" },
  };
  const websiteSchema = {
    "@context": "https://schema.org", "@type": "WebSite", "name": "ResKonnect",
    "url": "https://www.reskonnect.org",
    "potentialAction": { "@type": "SearchAction", "target": "https://www.reskonnect.org/find?query={search_term_string}", "query-input": "required name=search_term_string" },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SEO
        title="ResKonnect | Student Accommodation, Application Readiness & WIL Support"
        description="Find verified student accommodation, prepare your application documents, check your APS, request private rental support, and access WIL opportunities with ResKonnect."
        keywords="Pretoria student accommodation, TUT residence, NSFAS accredited accommodation, application readiness, APS checker, WIL placement support"
        canonicalPath="/"
      />
      <SEOJsonLd schema={[organizationSchema, websiteSchema]} />

      <SiteHeader />

      <main>
        <section>
          <HeroCarousel slides={fallbackSlides} autoPlay interval={6000} useDatabase={true} location="landing" />
        </section>

        <section className="border-b bg-background py-6 md:py-8">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-xl font-bold leading-snug md:text-3xl">
              <span className="text-primary">ResKonnect:</span> Your stay. Your studies. Your future. Connected.
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              {BRAND.hero.subcopy}
            </p>
          </div>
        </section>

        <InteractiveNeedSection />

        <section className="py-8 md:py-10 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-5">
              <h2 className="text-2xl md:text-3xl font-bold">Who are you looking for?</h2>
              <p className="text-muted-foreground text-sm md:text-base mt-1">
                University, TVET college, or private — we've got accommodation for every student.
              </p>
            </div>
            <div className="max-w-4xl mx-auto">
              <AudienceSelector
                audience="all"
                onChange={(v) => navigate(v === "all" ? "/find" : `/find?audience=${v}`)}
                onInstitutionChange={(t) =>
                  t ? navigate(`/find?institution=${encodeURIComponent(t)}`) : undefined
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
                <h2 className="text-3xl md:text-4xl font-bold mb-4">About ResKonnect</h2>
                <p className="text-muted-foreground mb-4 leading-relaxed">ResKonnect is your trusted partner in finding quality student accommodation. We connect students with verified residences in Pretoria and Tshwane, making the search process simple and stress-free.</p>
                <p className="text-muted-foreground mb-6 leading-relaxed">Our platform streamlines applications, ensures transparency, and puts students first. Whether you're looking for budget-friendly options or premium facilities, we've got you covered.</p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => navigate("/find")} className="gap-2">
                    <Users className="w-4 h-4" /> I'm a Student
                  </Button>
                  <Button variant="outline" onClick={scrollToLandlord} className="gap-2">
                    <Building2 className="w-4 h-4" /> I'm a Landlord
                  </Button>
                </div>
              </div>
              <div className="order-1 md:order-2 bg-primary/10 rounded-2xl p-8 h-64 md:h-80 flex items-center justify-center relative group">
                <img src={iconLogo} alt="ResKonnect Illustration" className="w-32 md:w-48 h-auto opacity-60 group-hover:scale-110 transition-transform duration-500" />
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
                Join South Africa's fastest-growing student accommodation platform. Apply to list your property, get NSFAS accreditation, or both — all in one application.
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

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Get in Touch</h2>
              <p className="text-muted-foreground text-center mb-6 text-sm">Have questions? We're here to help.</p>
              <Card className="bg-card shadow-sm">
                <CardContent className="p-6">
                  <form onSubmit={handleContactSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1"><Label htmlFor="name">Full Name</Label><Input id="name" name="name" required placeholder="Lawrence Dube" /></div>
                      <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required placeholder="reskonnect@gmail.com" /></div>
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
            heading="Popular on ResKonnect"
            links={[
              { label: "Student accommodation", to: "/student-accommodation", description: "Verified residences for university and TVET students." },
              { label: "Pretoria West accommodation", to: "/student-accommodation/pretoria-west", description: "Rooms in one of the busiest student areas." },
              { label: "Accommodation near TUT", to: "/student-accommodation/near-tut", description: "Walking-distance options around TUT campuses." },
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