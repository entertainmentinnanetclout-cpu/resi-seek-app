import SEO from "@/components/SEO";
import SEOJsonLd from "@/components/SEOJsonLd";
import { Shield, MapPin, DollarSign, FileCheck, Menu, Users, Building2, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import HeroCarousel from "@/components/HeroCarousel";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import FloatingShapes from "@/components/FloatingShapes";
import TrustedResidencesGrid from "@/components/TrustedResidencesGrid";
import { CategoryHeroSelector } from "@/components/findmyres/CategoryHeroSelector";
import { AccreditationCTA } from "@/components/findmyres/AccreditationCTA";
import { AudienceSelector } from "@/components/findmyres/AudienceSelector";
import LandlordApplicationTabs from "@/components/LandlordApplicationTabs";
import headerLogo from "@/assets/LIGHT THEME HOMESCREEN_APP ICON.png";
import footerLogo from "@/assets/FOOTER.png";
import iconLogo from "@/assets/LIGHT THEME HOMESCREEN_APP ICON.png";
import studentStudying from "@/assets/student-studying.jpg";
import studentsCelebration from "@/assets/students-celebration.jpg";
import inclusivePathwaysHero from "@/assets/hero-inclusive-pathways.jpg";
import applicationsFundingHero from "@/assets/hero-applications-funding.jpg";

/* ── Animated Counter ─────────────────────────────────── */
const AnimatedCounter = ({ target, suffix = "" }: { target: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1500;
          const steps = 40;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-4xl md:text-5xl font-bold text-primary">
      {count}
      {suffix}
    </div>
  );
};

/* ── Landing Page ──────────────────────────────────────── */
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
    { image: inclusivePathwaysHero, title: "Accommodation for University, TVET & Private", description: "Find verified residences that welcome TUT, other universities, TVET college students and private applicants.", cta: { text: "Find Accommodation", action: () => navigate("/find") } },
    { image: applicationsFundingHero, title: "Applications & NSFAS Ready", description: "Prepare one document pack for TUT, universities, TVET colleges and NSFAS funding applications.", cta: { text: "Open Applications Hub", action: () => navigate("/apply") } },
    { image: studentStudying, title: "Study in Comfort", description: "Access quality accommodation that supports your academic success no matter where you study.", cta: { text: "Find Your Res", action: () => navigate("/find") } },
    { image: studentsCelebration, title: "Build Lifelong Connections", description: "Be part of a thriving student community across Pretoria, Tshwane and beyond.", cta: { text: "Join Now", action: () => navigate("/auth") } },
  ];

  const features = [
    { icon: Shield, title: "Secure & Verified", description: "All residences are verified and meet safety standards.", cta: { label: "Browse Residences", to: "/find" } },
    { icon: MapPin, title: "Close to Campus", description: "Find accommodation within walking distance of your university.", cta: { label: "Find Near You", to: "/find" } },
    { icon: DollarSign, title: "Affordable Options", description: "Browse residences that fit your budget with transparent pricing.", cta: { label: "See Prices", to: "/find" } },
    { icon: FileCheck, title: "Easy Applications", description: "Apply to multiple residences with our simple process.", cta: { label: "Apply Now", to: "/auth" } },
  ];

  const stats = [
    { value: 500, suffix: "+", label: "Students Housed" },
    { value: 30, suffix: "+", label: "Verified Residences" },
    { value: 7, suffix: "", label: "Campuses Covered" },
    { value: 9, suffix: "", label: "Provinces Reached" },
  ];

  const navLinks = [
    { label: "Find Accommodation", to: "/find" },
    { label: "Apply (TUT / NSFAS)", to: "/apply" },
    { label: "Bursaries", to: "/bursaries" },
    { label: "Campus News", to: "/campus-news" },
  ];

  // Schema data
  const organizationSchema = {
    "@context": "https://schema.org", "@type": "Organization", "name": "ResKonnect",
    "url": "https://reskonnect.co.za", "logo": "https://reskonnect.co.za/logo.png",
    "description": "South Africa's leading student accommodation platform.",
    "contactPoint": { "@type": "ContactPoint", "telephone": "+27-63-732-3192", "contactType": "customer service", "email": "Reskonnect@gmail.com" },
  };
  const websiteSchema = {
    "@context": "https://schema.org", "@type": "WebSite", "name": "ResKonnect Student Accommodation",
    "url": "https://reskonnect.co.za",
    "potentialAction": { "@type": "SearchAction", "target": "https://reskonnect.co.za/find?query={search_term_string}", "query-input": "required name=search_term_string" },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Find Student Accommodation in Pretoria & Tshwane | ResKonnect South Africa"
        description="ResKonnect helps South African students find verified, affordable student accommodation near TUT, UP, and other universities in Pretoria, Tshwane & Gauteng. Apply online today!"
        keywords="Pretoria student accommodation, TUT residence, NSFAS approved accommodation, Tshwane student housing, affordable student res, university accommodation South Africa"
      />
      <SEOJsonLd schema={[organizationSchema, websiteSchema]} />

      {/* ── Header ──────────────────────────────────────── */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src={headerLogo} alt="ResKonnect" className="h-8 sm:h-10 w-auto" />
          </div>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <Button key={l.to} variant="ghost" size="sm" onClick={() => navigate(l.to)}>{l.label}</Button>
            ))}
            <Button variant="ghost" size="sm" onClick={scrollToLandlord}>List Property</Button>
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate("/auth")}>Sign In</Button>
            <Button onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90">Get Started</Button>
          </div>
          {/* Mobile */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Sheet open={isMenuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon"><Menu className="h-6 w-6" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-xs">
                <div className="p-6 flex flex-col gap-3 mt-8">
                  {navLinks.map((l) => (
                    <SheetClose key={l.to} asChild>
                      <Button variant="ghost" className="w-full justify-start" onClick={() => navigate(l.to)}>{l.label}</Button>
                    </SheetClose>
                  ))}
                  <SheetClose asChild>
                    <Button variant="ghost" className="w-full justify-start" onClick={scrollToLandlord}>List Property</Button>
                  </SheetClose>
                  <div className="border-t pt-3 mt-2 space-y-2">
                    <SheetClose asChild>
                      <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/auth")}>Sign In</Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button className="w-full" onClick={() => navigate("/auth")}>Get Started</Button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────── */}
        <section>
          <HeroCarousel slides={fallbackSlides} autoPlay interval={6000} useDatabase={true} location="landing" />
        </section>

        {/* ── Audience Selector — University / TVET / Private ── */}
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

        {/* ── Stats Counter ─────────────────────────────── */}
        <section className="py-10 md:py-14 bg-primary/5">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {stats.map((s) => (
                <div key={s.label}>
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                  <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trusted Residences ────────────────────────── */}
        <section className="py-12 md:py-20 bg-card/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <TrustedResidencesGrid />
          </div>
        </section>

        {/* ── Find Your Next Home (category-first discovery) ── */}
        <CategoryHeroSelector />

        {/* ── Become Accredited (landlord CTA) ───────────── */}
        <AccreditationCTA />

        {/* ── About + Dual CTA ──────────────────────────── */}
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

        {/* ── Landlord Application Portal ───────────────── */}
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

        {/* ── Why Choose ────────────────────────────────── */}
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

        {/* ── Contact ───────────────────────────────────── */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Get in Touch</h2>
              <p className="text-muted-foreground text-center mb-6 text-sm">Have questions? We're here to help.</p>
              <Card className="bg-card shadow-sm">
                <CardContent className="p-6">
                  <form onSubmit={handleContactSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1"><Label htmlFor="name">Full Name</Label><Input id="name" name="name" required placeholder="John Doe" /></div>
                      <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required placeholder="john@student.ac.za" /></div>
                    </div>
                    <div className="space-y-1"><Label htmlFor="message">Message</Label><Textarea id="message" name="message" required placeholder="How can we help you?" rows={3} /></div>
                    <Button type="submit" className="w-full">Send Message</Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="bg-card/50 border-t">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4"><img src={footerLogo} alt="ResKonnect" className="h-7 w-auto" /></div>
              <p className="text-sm text-muted-foreground">Your trusted student accommodation finder in Pretoria & Tshwane.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/find" className="hover:text-primary transition-colors">Find My Res</Link></li>
                <li><Link to="/apply" className="hover:text-primary transition-colors">Applications</Link></li>
                <li><Link to="/bursaries" className="hover:text-primary transition-colors">Bursaries</Link></li>
                <li><Link to="/recruit" className="hover:text-primary transition-colors">Become a Recruiter</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">Sign Up / Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Email: Reskonnect@gmail.com</li>
                <li>Phone: 063 732 3192</li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-6 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} ResKonnect. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
