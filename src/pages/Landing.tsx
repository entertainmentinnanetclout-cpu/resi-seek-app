import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import SEOJsonLd from "@/components/SEOJsonLd";
import { Shield, MapPin, DollarSign, FileCheck, Users, Building2, Award, ArrowRight, CheckCircle2, ChevronRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import FloatingShapes from "@/components/FloatingShapes";
import TrustedResidencesGrid from "@/components/TrustedResidencesGrid";
import { CategoryHeroSelector } from "@/components/findmyres/CategoryHeroSelector";
import { AccreditationCTA } from "@/components/findmyres/AccreditationCTA";
import { AudienceSelector } from "@/components/findmyres/AudienceSelector";
import LandlordApplicationTabs from "@/components/LandlordApplicationTabs";
import InteractiveNeedSection from "@/components/onboarding/InteractiveNeedSection";
import { RESKONNECT_BRAND } from "@/constants/brand";

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
    <div ref={ref} className="text-3xl md:text-5xl font-bold text-[#F5B32F]">
      {count}
      {suffix}
    </div>
  );
};

/* ── Landing Page ──────────────────────────────────────── */
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

  const stats = [
    { value: 500, suffix: "+", label: "Students Housed Successfully" },
    { value: 30, suffix: "+", label: "Verified Partner Residences" },
    { value: 7, suffix: "", label: "Major Campuses Covered" },
    { value: 9, suffix: "", label: "Provinces Reached Nationwide" },
  ];

  // FAQ mock data for premium FAQ block
  const faqs = [
    {
      question: "How does ResKonnect verify accommodation?",
      answer: "Every residence listed on our platform undergoes a rigorous manual verification process. We verify ownership, inspect property facilities, assess safety features (fencing, security cameras, access control), and cross-reference NSFAS-accreditation details where applicable."
    },
    {
      question: "Does ResKonnect provide direct NSFAS application services?",
      answer: "No. ResKonnect is an independent platform that helps students find accredited accommodations and offers general guidance. We strictly DO NOT replace or process official NSFAS applications or university portal submissions."
    },
    {
      question: "How can parents track their child's accommodation status?",
      answer: "Parents can use our 'Parents & Guardians' guide or submit queries through the guided onboarding wizard. We assist parents with deposit safety, lease reviews, and verified housing catalogs in Tshwane, Pretoria, and other Gauteng nodes."
    },
    {
      question: "What is the Work Integrated Learning (WIL) support programme?",
      answer: "ResKonnect helps final-year or TVET students build CVs, complete documentation readiness, and connect with potential corporate placement opportunities to complete their required training."
    }
  ];

  // Schema data
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ResKonnect",
    "url": "https://reskonnect.co.za",
    "logo": "https://reskonnect.co.za/favicon.png",
    "description": "South Africa's leading student accommodation and guidance portal.",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+27-63-732-3192",
      "contactType": "customer service",
      "email": "reskonnect@gmail.com"
    },
  };
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "ResKonnect Student Portal",
    "url": "https://reskonnect.co.za",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://reskonnect.co.za/find?query={search_term_string}",
      "query-input": "required name=search_term_string"
    },
  };

  return (
    <PublicLayout>
      <SEO
        title="Find Student Accommodation in Pretoria & Tshwane | ResKonnect South Africa"
        description="ResKonnect helps South African students find verified, affordable student accommodation near TUT, UP, and other universities in Pretoria, Tshwane & Gauteng. Apply online today!"
        keywords="Pretoria student accommodation, TUT residence, NSFAS approved accommodation, Tshwane student housing, affordable student res, university accommodation South Africa"
      />
      <SEOJsonLd schema={[organizationSchema, websiteSchema]} />

      <main className="overflow-x-hidden">
        {/* ── Premium Dark Hero ─────────────────────────────── */}
        <section className="relative bg-[#071326] text-white py-20 md:py-32 overflow-hidden border-b border-white/5">
          {/* Deep abstract lighting effects */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
          <FloatingShapes className="opacity-10" />

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              {/* Premium Floating Badge */}
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full backdrop-blur-md animate-fade-in">
                <span className="w-2 h-2 bg-[#F5B32F] rounded-full animate-pulse" />
                <span className="text-xs font-bold tracking-[0.15em] uppercase text-slate-200">
                  {RESKONNECT_BRAND.descriptor}
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6.5xl font-black tracking-tight leading-[1.1] text-white">
                Your Stay. Your Studies. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5B32F] to-[#F5B32F]">
                  Your Future. Connected.
                </span>
              </h1>

              {/* Subheadline / Copy */}
              <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                {RESKONNECT_BRAND.heroSubcopy}
              </p>

              {/* Call To Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Button
                  size="lg"
                  onClick={() => navigate("/get-started")}
                  className="w-full sm:w-auto bg-[#F5B32F] hover:bg-[#F5B32F]/90 text-[#071326] font-bold text-base px-8 h-14 shadow-lg shadow-[#F5B32F]/10 hover:scale-[1.02] transition-transform duration-200"
                >
                  Get Started <ArrowRight className="w-5 h-5 ml-2 shrink-0" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/findmyres")}
                  className="w-full sm:w-auto text-white border-white/20 hover:bg-white/10 bg-white/5 font-semibold text-base px-8 h-14 backdrop-blur-md"
                >
                  Find Accommodation
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={scrollToLandlord}
                  className="w-full sm:w-auto text-slate-300 hover:text-white hover:bg-white/5 font-semibold text-sm"
                >
                  Partner with Us
                </Button>
              </div>

              {/* Trust Indicators / Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-16 border-t border-white/10 text-center">
                {stats.map((s) => (
                  <div key={s.label} className="space-y-1">
                    <AnimatedCounter target={s.value} suffix={s.suffix} />
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Guided Request Finder (Interactive Cards) ───────────────── */}
        <InteractiveNeedSection />

        {/* ── Audience Selector Section ───────────────── */}
        <section className="py-14 md:py-20 bg-slate-50 border-y border-slate-200 relative overflow-hidden">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <Award className="w-8 h-8 text-[#2563EB] mx-auto mb-3" />
              <h2 className="text-3xl md:text-4xl font-black text-[#071326]">Tailored to Your Institution</h2>
              <p className="text-slate-600 mt-2 text-sm md:text-base leading-relaxed">
                Whether you are a University student, a TVET scholar, or exploring private pathways, we match you with accredited properties and custom guides designed for your academic roadmap.
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

        {/* ── Verified Featured Residences ────────────────────────── */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl font-black text-[#071326] tracking-tight">Verified Student Residences</h2>
              <p className="text-slate-500 mt-2">
                Discover accredited, high-trust housing options near Pretoria West, Pretoria Main, and Tshwane campuses.
              </p>
            </div>
            <TrustedResidencesGrid />
          </div>
        </section>

        {/* ── Category First Discovery ── */}
        <CategoryHeroSelector />

        {/* ── Dual CTA: Student vs Landlord ──────────────────────────── */}
        <section className="py-16 md:py-24 bg-[#071326] text-white relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#2563EB]/5 rounded-full blur-[160px] pointer-events-none" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <div className="space-y-6">
                <span className="text-xs font-bold tracking-widest text-[#F5B32F] uppercase">THE RESKONNECT ECOSYSTEM</span>
                <h2 className="text-3xl md:text-4xl font-black leading-tight">One Connected Platform.</h2>
                <p className="text-slate-300 leading-relaxed">
                  ResKonnect is South Africa's nationwide digital ecosystem bridging the gap between student housing, documentation readiness, work placement support, and enterprise landlord solutions.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#12A870] shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-200">
                      <span className="font-bold text-white">Living:</span> Safe, verified student accommodations and private rentals.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#12A870] shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-200">
                      <span className="font-bold text-white">Applications:</span> Transparent checklist checkers and tertiary portal checklists.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#12A870] shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-200">
                      <span className="font-bold text-white">Opportunities:</span> Career-readiness templates and Work Integrated Learning tools.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#12A870] shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-200">
                      <span className="font-bold text-white">Partners:</span> Portal suites for landlords, agents, and institutions.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-4">
                  <Button onClick={() => navigate("/get-started")} className="bg-[#2563EB] hover:bg-[#2F6EDB] text-white px-6 font-bold">
                    Join as a Student
                  </Button>
                  <Button variant="outline" onClick={scrollToLandlord} className="border-white/20 hover:bg-white/10 text-white px-6 font-semibold">
                    List Your Property
                  </Button>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-10 h-72 md:h-96 flex flex-col items-center justify-center relative group backdrop-blur-sm">
                <img
                  src={RESKONNECT_BRAND.iconOnly}
                  alt="ResKonnect Emblem"
                  className="w-32 h-32 object-contain brightness-110 drop-shadow-[0_0_40px_rgba(37,99,235,0.2)] group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute bottom-6 text-xs text-slate-400 font-bold tracking-[0.25em] uppercase">RESKONNECT EMBLEM</span>
                <div className="absolute inset-0 rounded-2xl border border-white/5 pointer-events-none" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Partner & Landlord Onboarding ───────────────── */}
        <section ref={landlordRef} id="landlord" className="py-16 md:py-24 bg-slate-50 relative overflow-hidden border-b border-slate-200">
          <FloatingShapes className="opacity-30" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-12 max-w-3xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-2 bg-slate-200 text-[#071326] px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase">
                Property Portals & Business
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-[#071326]">Fill Your Rooms. Streamline Admin.</h2>
              <p className="text-slate-600">
                Join South Africa's leading platform to reach prospective student tenants, handle applications, or apply for verified badges.
              </p>
            </div>
            <LandlordApplicationTabs />
          </div>
        </section>

        {/* ── FAQ Accordion Section ──────────────────────────── */}
        <section className="py-16 md:py-24 bg-white border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="text-center mb-12 space-y-2">
              <HelpCircle className="w-8 h-8 text-[#2563EB] mx-auto" />
              <h2 className="text-3xl font-black text-[#071326]">Frequently Asked Questions</h2>
              <p className="text-slate-500">Quick answers regarding ResKonnect, verification, and student portals.</p>
            </div>

            <Card className="border border-slate-200 shadow-sm overflow-hidden bg-[#F8FAFC]">
              <CardContent className="p-6 md:p-8">
                <Accordion type="single" collapsible className="space-y-4">
                  {faqs.map((faq, idx) => (
                    <AccordionItem key={idx} value={`faq-${idx}`} className="border-b border-slate-200 last:border-none pb-4 last:pb-0">
                      <AccordionTrigger className="text-left font-bold text-slate-800 hover:text-[#2563EB] text-base py-2">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-600 text-sm leading-relaxed pt-2">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Lead Contact Form ───────────────────────────────────── */}
        <section className="py-16 md:py-24 bg-[#F8FAFC]">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl md:text-3xl font-black text-[#071326]">Speak to our Support Desk</h2>
                <p className="text-slate-500 text-sm">Need help listing a property or finding accredited units? Drop us a query.</p>
              </div>
              <Card className="bg-white border border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-slate-700 font-semibold">Full Name</Label>
                        <Input id="name" name="name" required placeholder="John Doe" className="border-slate-200 focus:border-[#2563EB]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-slate-700 font-semibold">Email Address</Label>
                        <Input id="email" name="email" type="email" required placeholder="john@student.ac.za" className="border-slate-200 focus:border-[#2563EB]" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="message" className="text-slate-700 font-semibold">Query or Message</Label>
                      <Textarea id="message" name="message" required placeholder="Describe what you are looking for..." rows={4} className="border-slate-200 focus:border-[#2563EB]" />
                    </div>
                    <Button type="submit" className="w-full bg-[#2563EB] text-white hover:bg-[#2F6EDB] font-bold h-11">
                      Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
};

export default Landing;
