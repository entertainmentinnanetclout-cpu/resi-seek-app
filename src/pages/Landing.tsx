import SEO from "@/components/SEO";
import SEOJsonLd from "@/components/SEOJsonLd";
import { Shield, Users, Building2, Award, ArrowRight, Laptop, Briefcase, GraduationCap, Zap, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState, useRef } from "react";
import PublicLayout from "@/components/PublicLayout";

export type EnquiryType =
  | "need_accommodation"
  | "need_wil"
  | "list_property"
  | "represent_institution"
  | "become_recruiter"
  | "need_digital_portal"
  | "general";

const Landing = () => {
  const navigate = useNavigate();
  const contactRef = useRef<HTMLDivElement>(null);

  // Form State
  const [enquiryType, setEnquiryType] = useState<EnquiryType>("general");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  // Conditional Fields
  const [institution, setInstitution] = useState("");
  const [campus, setCampus] = useState("");
  const [accLocation, setAccLocation] = useState("");

  const [propertyName, setPropertyName] = useState("");
  const [propertyLocation, setPropertyLocation] = useState("");
  const [numBeds, setNumBeds] = useState("");

  const [deptRole, setDeptRole] = useState("");
  const [partnershipInterest, setPartnershipInterest] = useState("");

  const [recruitArea, setRecruitArea] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [portalType, setPortalType] = useState("");

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // TODO: Connect this enquiry form to Laravel/backend submission endpoint.
    console.log("Enquiry submitted:", {
      enquiryType,
      fullName,
      email,
      phone,
      message,
      institution,
      campus,
      accLocation,
      propertyName,
      propertyLocation,
      numBeds,
      deptRole,
      partnershipInterest,
      recruitArea,
      businessName,
      portalType
    });

    toast.success("Thank you. Your enquiry has been captured. A ResKonnect representative will contact you.");

    // Reset form
    setFullName("");
    setEmail("");
    setPhone("");
    setMessage("");
    setInstitution("");
    setCampus("");
    setAccLocation("");
    setPropertyName("");
    setPropertyLocation("");
    setNumBeds("");
    setDeptRole("");
    setPartnershipInterest("");
    setRecruitArea("");
    setBusinessName("");
    setPortalType("");
  };

  const scrollToSection = (hash: string) => {
    const element = document.querySelector(hash);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const selectEnquiryAndScroll = (type: EnquiryType) => {
    setEnquiryType(type);
    scrollToSection("#contact");
  };

  // Schema data
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ResKonnect",
    "url": "https://reskonnect.co.za",
    "logo": "https://reskonnect.co.za/logo.png",
    "description": "South Africa's leading student accommodation and student opportunities platform.",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+27-63-732-3192",
      "contactType": "customer service",
      "email": "Reskonnect@gmail.com"
    },
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "ResKonnect - Living, AI, Opportunity",
    "url": "https://reskonnect.co.za",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://reskonnect.co.za/find-my-res?search={search_term_string}",
      "query-input": "required name=search_term_string"
    },
  };

  return (
    <PublicLayout>
      <SEO
        title="Student Accommodation, AI & Opportunities | ResKonnect South Africa"
        description="ResKonnect connects South African students with trusted student accommodation, WIL opportunities, and digital services from Pretoria, Tshwane to nationwide."
        keywords="student accommodation South Africa, TUT accommodation Pretoria, NSFAS accredited residences, student opportunities WIL, landlord student listings, Recruiter program ResKonnect"
      />
      <SEOJsonLd schema={[organizationSchema, websiteSchema]} />

      {/* ── 1. HERO SECTION ──────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-rk-navy via-rk-navy to-rk-deep-navy text-white pt-20 pb-28 md:pt-28 md:pb-36">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(11,99,206,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,168,107,0.1),transparent)] pointer-events-none" />

        {/* Soft abstract graphic lines for premium look */}
        <div className="absolute top-1/4 right-10 w-96 h-96 rounded-full bg-rk-blue/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/3 w-80 h-80 rounded-full bg-rk-green/5 blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-rk-gold uppercase animate-pulse">
              <Sparkles className="w-3.5 h-3.5" /> Living • AI • Opportunity
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight sm:leading-none">
              Your Gateway to Student Living and <span className="text-rk-blue">Future Opportunities</span>.
            </h1>

            <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed font-normal">
              ResKonnect connects students with trusted accommodation, practical opportunities, and digital services designed to support their journey from campus to career.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Button
                onClick={() => navigate("/find-my-res")}
                className="w-full sm:w-auto h-13 px-8 text-base bg-rk-blue hover:bg-rk-blue/90 text-white font-semibold rounded-lg shadow-lg flex items-center justify-center gap-2"
              >
                Find Accommodation <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => scrollToSection("#opportunities")}
                className="w-full sm:w-auto h-13 px-8 text-base bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold rounded-lg"
              >
                Apply for Opportunities
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center items-center pt-6 text-sm text-white/60">
              <button onClick={() => selectEnquiryAndScroll("become_recruiter")} className="hover:text-rk-gold transition-colors">
                Become a Recruiter
              </button>
              <span className="hidden sm:inline">•</span>
              <button onClick={() => selectEnquiryAndScroll("list_property")} className="hover:text-rk-gold transition-colors">
                List Your Property
              </button>
              <span className="hidden sm:inline">•</span>
              <button onClick={() => selectEnquiryAndScroll("represent_institution")} className="hover:text-rk-gold transition-colors">
                Partner With Us
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. AUDIENCE QUICK ACCESS SECTION ────────────── */}
      <section id="student-services" className="py-16 md:py-24 bg-rk-light">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold text-rk-navy">What do you need today?</h2>
            <p className="text-muted-foreground text-base">Select your path to access tailored services, portals, and support channels.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Students Card */}
            <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group flex flex-col justify-between">
              <CardContent className="p-6 sm:p-8 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-rk-blue/10 flex items-center justify-center text-rk-blue">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-rk-navy">Students</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Find student accommodation, apply for growth opportunities, and access university or college support services.
                </p>
              </CardContent>
              <div className="p-6 pt-0">
                <Button onClick={() => scrollToSection("#opportunities")} variant="outline" className="w-full text-rk-blue border-rk-blue/20 hover:bg-rk-blue hover:text-white transition-all">
                  Explore Student Services
                </Button>
              </div>
            </Card>

            {/* Accommodation Card */}
            <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group flex flex-col justify-between">
              <CardContent className="p-6 sm:p-8 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-rk-blue/10 flex items-center justify-center text-rk-blue">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-rk-navy">Accommodation Seekers</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Browse verified student residences and submit applications online. Find secure rooms near your campus.
                </p>
              </CardContent>
              <div className="p-6 pt-0">
                <Button onClick={() => navigate("/find-my-res")} className="w-full bg-rk-navy hover:bg-rk-navy/90 text-white">
                  Find My Res
                </Button>
              </div>
            </Card>

            {/* Landlords Card */}
            <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group flex flex-col justify-between">
              <CardContent className="p-6 sm:p-8 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-rk-gold/10 flex items-center justify-center text-rk-gold">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-rk-navy">Landlords & Owners</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  List your properties, manage student applications, fill vacancies, and access streamlined property marketing.
                </p>
              </CardContent>
              <div className="p-6 pt-0">
                <Button onClick={() => selectEnquiryAndScroll("list_property")} variant="outline" className="w-full text-rk-gold border-rk-gold/20 hover:bg-rk-gold hover:text-rk-navy">
                  Partner With ResKonnect
                </Button>
              </div>
            </Card>

            {/* Institutions Card */}
            <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group flex flex-col justify-between">
              <CardContent className="p-6 sm:p-8 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-rk-blue/10 flex items-center justify-center text-rk-blue">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-rk-navy">Institutions & Colleges</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Collaborate on student housing allocations, off-campus placements, TVET lead programs, and wellness systems.
                </p>
              </CardContent>
              <div className="p-6 pt-0">
                <Button onClick={() => selectEnquiryAndScroll("represent_institution")} variant="outline" className="w-full text-rk-blue border-rk-blue/20 hover:bg-rk-blue hover:text-white">
                  Institution Partnerships
                </Button>
              </div>
            </Card>

            {/* Recruiters Card */}
            <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group flex flex-col justify-between">
              <CardContent className="p-6 sm:p-8 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-rk-orange/10 flex items-center justify-center text-rk-orange">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-rk-navy">Recruiters & Partners</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Refer students looking for accommodation and track cash rewards on student placement campaigns.
                </p>
              </CardContent>
              <div className="p-6 pt-0">
                <Button onClick={() => navigate("/recruit")} className="w-full bg-rk-orange hover:bg-rk-orange/90 text-white">
                  Become a Recruiter
                </Button>
              </div>
            </Card>

            {/* Businesses Card */}
            <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group flex flex-col justify-between">
              <CardContent className="p-6 sm:p-8 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-rk-green/10 flex items-center justify-center text-rk-green">
                  <Laptop className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-rk-navy">Businesses & Corporates</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Utilize custom portals, deploy systems, manage corporate student support, and directly engage the youth market.
                </p>
              </CardContent>
              <div className="p-6 pt-0">
                <Button onClick={() => selectEnquiryAndScroll("need_digital_portal")} variant="outline" className="w-full text-rk-green border-rk-green/20 hover:bg-rk-green hover:text-white">
                  Work With Us
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── 3. CORE PILLARS SECTION ──────────────────────── */}
      <section id="pillars" className="py-20 bg-white border-y border-border/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <p className="text-rk-blue font-bold tracking-wider text-xs uppercase">Corporate Foundation</p>
            <h2 className="text-3xl md:text-4xl font-bold text-rk-navy">Built Around Living, AI, and Opportunity</h2>
            <p className="text-muted-foreground">Integrating secure spaces, modern technology, and life-changing pathways under a single unified corporate gateway.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Living */}
            <div className="text-center space-y-4 p-4 border border-border/10 rounded-2xl hover:bg-rk-light/50 transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-rk-blue text-white flex items-center justify-center mx-auto shadow-md">
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-rk-navy">Living</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Student accommodation, residence visibility, property access, and trusted placement support. We help secure spaces where academic success can thrive.
              </p>
            </div>

            {/* AI */}
            <div className="text-center space-y-4 p-4 border border-border/10 rounded-2xl hover:bg-rk-light/50 transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-rk-green text-white flex items-center justify-center mx-auto shadow-md">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-rk-navy">AI</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Smart digital tools, administrative dashboards, automated application pipelines, and intelligent student support systems to remove friction from operations.
              </p>
            </div>

            {/* Opportunity */}
            <div className="text-center space-y-4 p-4 border border-border/10 rounded-2xl hover:bg-rk-light/50 transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-rk-gold text-rk-navy flex items-center justify-center mx-auto shadow-md">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-rk-navy">Opportunity</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Work-Integrated Learning (WIL) support, student placements, candidacy readiness resources, referral programmes, and structured economic access.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. ACCOMMODATION SECTION ─────────────────────── */}
      <section className="py-20 md:py-28 bg-rk-light">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-1 bg-rk-blue/10 text-rk-blue px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">
                ResKonnect Living
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-rk-navy leading-tight">
                Find Accommodation That Fits Your Journey.
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Browse trusted accommodation options, apply online, and connect with verified residences that support your academic path. We expand access to students nationwide.
              </p>

              <ul className="space-y-3 pt-2 text-sm text-rk-navy">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-rk-blue/15 text-rk-blue flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>Trusted and verified accommodation providers</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-rk-blue/15 text-rk-blue flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>Student-friendly locations near main campuses</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-rk-blue/15 text-rk-blue flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>NSFAS and university/TVET-funded support readiness</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-rk-blue/15 text-rk-blue flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>One-stop online application submissions</span>
                </li>
              </ul>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button onClick={() => navigate("/find-my-res")} className="bg-rk-blue hover:bg-rk-blue/90 text-white font-semibold shadow-sm h-12 px-6">
                  Find Accommodation
                </Button>
                <Button onClick={() => selectEnquiryAndScroll("list_property")} variant="outline" className="border-border text-rk-navy font-semibold h-12 px-6 bg-white hover:bg-rk-light">
                  List Your Property
                </Button>
              </div>
            </div>

            <div className="relative group rounded-2xl overflow-hidden shadow-premium bg-rk-navy/10 p-1">
              <div className="aspect-[4/3] bg-gradient-to-tr from-rk-navy to-rk-blue/50 rounded-2xl flex items-center justify-center relative p-8">
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative text-center space-y-4 max-w-sm z-10 text-white">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto backdrop-blur-sm">
                    <Shield className="w-8 h-8 text-rk-gold animate-float" />
                  </div>
                  <h3 className="text-xl font-bold">100% Verified Housing</h3>
                  <p className="text-xs text-white/80 leading-relaxed">
                    We strictly audit and list properties meeting safety, hygiene, and study standards to ensure complete peace of mind for parents and students.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. STUDENT OPPORTUNITIES / WIL SECTION ────────── */}
      <section id="opportunities" className="py-20 md:py-28 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="relative order-2 lg:order-1 rounded-2xl overflow-hidden shadow-premium bg-rk-navy/10 p-1">
              <div className="aspect-[4/3] bg-gradient-to-br from-rk-deep-navy to-rk-green/40 rounded-2xl flex items-center justify-center relative p-8">
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative text-center space-y-4 max-w-sm z-10 text-white">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto backdrop-blur-sm">
                    <Laptop className="w-8 h-8 text-rk-gold animate-float" />
                  </div>
                  <h3 className="text-xl font-bold">Bridging Campus to Career</h3>
                  <p className="text-xs text-white/80 leading-relaxed">
                    Access Work-Integrated Learning placement channels and candidate readiness guidance designed for modern South African youth.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 order-1 lg:order-2">
              <div className="inline-flex items-center gap-1 bg-rk-green/10 text-rk-green px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">
                ResKonnect Opportunities
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-rk-navy leading-tight">
                Connecting Students to Opportunity.
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                ResKonnect supports students with access to practical exposure, workplace readiness tools, referrals, and partnership-driven opportunity channels. We work alongside top corporates and TVET sectors to help prepare young candidates.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <h4 className="font-bold text-rk-navy text-sm">Work-Integrated Learning</h4>
                  <p className="text-xs text-muted-foreground">Coordinator channels for TVET and university student practical placement criteria.</p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-rk-navy text-sm">Student Placement Support</h4>
                  <p className="text-xs text-muted-foreground">Practical connections to corporate sectors looking for qualified entry talent.</p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-rk-navy text-sm">Candidate Readiness</h4>
                  <p className="text-xs text-muted-foreground">Coaching, resume frameworks, and corporate integration tips.</p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-rk-navy text-sm">Opportunity Campaigns</h4>
                  <p className="text-xs text-muted-foreground">Joint initiatives with strategic digital and economic access partners.</p>
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={() => selectEnquiryAndScroll("need_wil")} className="bg-rk-green hover:bg-rk-green/90 text-white font-semibold shadow-sm h-12 px-8">
                  Apply for Opportunities
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. PARTNER SOLUTIONS SECTION ─────────────────── */}
      <section id="partners" className="py-20 md:py-28 bg-rk-light border-t border-border/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <p className="text-rk-blue font-bold tracking-wider text-xs uppercase">B2B & Institutional</p>
            <h2 className="text-3xl md:text-4xl font-bold text-rk-navy">Built for Partners Who Serve Students</h2>
            <p className="text-muted-foreground">We design digital portals and service systems for partners who need structured access to student directories, accommodation, and operational workflows.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Landlords Solution */}
            <Card className="bg-white border border-border/30 rounded-2xl overflow-hidden p-6 hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-lg bg-rk-blue/10 text-rk-blue flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-rk-navy text-lg">Landlords</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enhance property visibility, gather secure digital applications, and manage high-occupancy cycles with confidence.
                </p>
              </div>
              <button onClick={() => selectEnquiryAndScroll("list_property")} className="text-xs font-semibold text-rk-blue hover:underline text-left pt-6">
                Learn More →
              </button>
            </Card>

            {/* Institutions Solution */}
            <Card className="bg-white border border-border/30 rounded-2xl overflow-hidden p-6 hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-lg bg-rk-blue/10 text-rk-blue flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-rk-navy text-lg">Institutions</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Deploy structured off-campus housing systems, student referral mechanisms, and placement tracking utilities.
                </p>
              </div>
              <button onClick={() => selectEnquiryAndScroll("represent_institution")} className="text-xs font-semibold text-rk-blue hover:underline text-left pt-6">
                Learn More →
              </button>
            </Card>

            {/* Businesses Solution */}
            <Card className="bg-white border border-border/30 rounded-2xl overflow-hidden p-6 hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-lg bg-rk-blue/10 text-rk-blue flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-rk-navy text-lg">Employers & Brands</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Engage verified student demographics, launch localized recruitment, and coordinate specialized development campaigns.
                </p>
              </div>
              <button onClick={() => selectEnquiryAndScroll("general")} className="text-xs font-semibold text-rk-blue hover:underline text-left pt-6">
                Learn More →
              </button>
            </Card>

            {/* Digital Portals Solution */}
            <Card className="bg-white border border-border/30 rounded-2xl overflow-hidden p-6 hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-lg bg-rk-blue/10 text-rk-blue flex items-center justify-center">
                  <Laptop className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-rk-navy text-lg">Digital Portals</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Utilize secure, customized white-label service portals, application engines, and operational progress dashboards.
                </p>
              </div>
              <button onClick={() => selectEnquiryAndScroll("need_digital_portal")} className="text-xs font-semibold text-rk-blue hover:underline text-left pt-6">
                Learn More →
              </button>
            </Card>
          </div>
        </div>
      </section>

      {/* ── 7. FEATURED CAMPAIGN / CURRENT FOCUS ──────────── */}
      <section className="py-20 bg-gradient-to-r from-rk-navy to-rk-deep-navy text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto bg-white/5 border border-white/10 rounded-3xl p-8 sm:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-rk-blue/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center relative z-10">
              <div className="md:col-span-2 space-y-4">
                <div className="inline-flex items-center gap-1.5 bg-rk-gold/15 text-rk-gold px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  Current Feature Campaign
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold">Berlin Student Living</h3>
                <p className="text-sm text-white/80 leading-relaxed max-w-xl">
                  Premium and affordable accommodation options welcoming Tshwane South College (TSC) Pretoria West and Atteridgeville students. Prepare your documents and book space immediately.
                </p>
                <p className="text-xs text-white/50 italic">
                  *Referral rewards are available for successful verified student placements. Terms apply.
                </p>
              </div>

              <div className="flex flex-col gap-3 justify-center">
                <Button
                  onClick={() => navigate("/find-my-res?search=Berlin")}
                  className="bg-rk-blue hover:bg-rk-blue/90 text-white font-bold h-12 w-full rounded-xl"
                >
                  Apply / Enquire
                </Button>
                <Button
                  onClick={() => selectEnquiryAndScroll("need_accommodation")}
                  variant="outline"
                  className="bg-transparent border-white/20 hover:bg-white/10 text-white font-bold h-12 w-full rounded-xl"
                >
                  Request Details
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. HOW IT WORKS SECTION ──────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <p className="text-rk-blue font-bold tracking-wider text-xs uppercase">Simple Operations</p>
            <h2 className="text-3xl md:text-4xl font-bold text-rk-navy">How ResKonnect Works</h2>
            <p className="text-muted-foreground">Three clear steps designed to route you directly to secure student resources.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="relative space-y-4 p-4 text-center">
              <div className="w-14 h-14 rounded-full bg-rk-blue/10 text-rk-blue font-extrabold text-xl flex items-center justify-center mx-auto">
                1
              </div>
              <h3 className="font-extrabold text-lg text-rk-navy">Choose Your Path</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Determine if you are seeking student housing, applying for WIL opportunities, listing a property, representing a college, or referring candidates as a recruiter.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative space-y-4 p-4 text-center">
              <div className="w-14 h-14 rounded-full bg-rk-blue/10 text-rk-blue font-extrabold text-xl flex items-center justify-center mx-auto">
                2
              </div>
              <h3 className="font-extrabold text-lg text-rk-navy">Submit Your Details</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Provide essential information using our dynamic public enquiry gateway or log directly into your secure portal structure.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative space-y-4 p-4 text-center">
              <div className="w-14 h-14 rounded-full bg-rk-blue/10 text-rk-blue font-extrabold text-xl flex items-center justify-center mx-auto">
                3
              </div>
              <h3 className="font-extrabold text-lg text-rk-navy">Get Connected</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Our technology routes you immediately to the right partner channel, verified residence, business portal system, or opportunity coordinator.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. TRUST SECTION ─────────────────────────────── */}
      <section className="py-16 bg-rk-light border-t border-border/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center max-w-5xl mx-auto">
            <div className="p-4 space-y-2">
              <h4 className="text-3xl font-extrabold text-rk-blue">100%</h4>
              <p className="text-xs font-semibold text-rk-navy uppercase tracking-wider">Verified Residences</p>
            </div>
            <div className="p-4 space-y-2">
              <h4 className="text-3xl font-extrabold text-rk-green">Secure</h4>
              <p className="text-xs font-semibold text-rk-navy uppercase tracking-wider">Online Submissions</p>
            </div>
            <div className="p-4 space-y-2">
              <h4 className="text-3xl font-extrabold text-rk-gold">National</h4>
              <p className="text-xs font-semibold text-rk-navy uppercase tracking-wider">Campus Coverage</p>
            </div>
            <div className="p-4 space-y-2">
              <h4 className="text-3xl font-extrabold text-rk-orange">Partner</h4>
              <p className="text-xs font-semibold text-rk-navy uppercase tracking-wider">Driven Systems</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 10. CONTACT / ENQUIRY SECTION ────────────────── */}
      <section ref={contactRef} id="contact" className="py-20 md:py-28 bg-white scroll-mt-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold text-rk-navy">Submit an Enquiry</h2>
              <p className="text-muted-foreground text-sm">Fill in the short form below and our coordinators will assist you quickly.</p>
            </div>

            <Card className="border border-border/50 shadow-premium rounded-3xl bg-rk-light/30 overflow-hidden">
              <CardContent className="p-6 sm:p-10">
                <form onSubmit={handleContactSubmit} className="space-y-6">
                  {/* Category select block */}
                  <div className="space-y-2">
                    <Label htmlFor="enquiry-type" className="text-sm font-bold text-rk-navy">How can we help you? *</Label>
                    <select
                      id="enquiry-type"
                      required
                      value={enquiryType}
                      onChange={(e) => setEnquiryType(e.target.value as EnquiryType)}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-rk-navy focus:border-rk-blue focus:outline-none"
                    >
                      <option value="need_accommodation">I need student accommodation</option>
                      <option value="need_wil">I need WIL / student opportunity support</option>
                      <option value="list_property">I want to list a student property / landlord enquiry</option>
                      <option value="represent_institution">I represent an institution / college / university</option>
                      <option value="become_recruiter">I want to become a student recruiter</option>
                      <option value="need_digital_portal">I need a digital portal / business solution</option>
                      <option value="general">General corporate enquiry</option>
                    </select>
                  </div>

                  {/* Standard Base Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-bold text-rk-navy">Full Name *</Label>
                      <Input
                        id="fullName"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="bg-white border-border py-2.5 text-sm text-rk-navy focus:border-rk-blue"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-bold text-rk-navy">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.co.za"
                        className="bg-white border-border py-2.5 text-sm text-rk-navy focus:border-rk-blue"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-bold text-rk-navy">Phone / WhatsApp Number *</Label>
                    <Input
                      id="phone"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +27 63 732 3192"
                      className="bg-white border-border py-2.5 text-sm text-rk-navy focus:border-rk-blue"
                    />
                  </div>

                  {/* ───────────────── CONDITIONAL FIELDS ───────────────── */}

                  {/* Category: Seeking Accommodation */}
                  {enquiryType === "need_accommodation" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-white rounded-xl border border-border/40 animate-fade-in">
                      <div className="space-y-2">
                        <Label htmlFor="institution" className="text-xs font-bold text-rk-navy">Institution / College Name</Label>
                        <Input id="institution" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. TUT, UP, Rosebank" className="bg-rk-light border-border text-xs text-rk-navy" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="campus" className="text-xs font-bold text-rk-navy">Campus Location</Label>
                        <Input id="campus" value={campus} onChange={(e) => setCampus(e.target.value)} placeholder="e.g. Pretoria West" className="bg-rk-light border-border text-xs text-rk-navy" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accLocation" className="text-xs font-bold text-rk-navy">Location Needed</Label>
                        <Input id="accLocation" value={accLocation} onChange={(e) => setAccLocation(e.target.value)} placeholder="e.g. Pretoria Central" className="bg-rk-light border-border text-xs text-rk-navy" />
                      </div>
                    </div>
                  )}

                  {/* Category: Landlord / List Property */}
                  {enquiryType === "list_property" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-white rounded-xl border border-border/40 animate-fade-in">
                      <div className="space-y-2">
                        <Label htmlFor="propertyName" className="text-xs font-bold text-rk-navy">Residence / Property Name</Label>
                        <Input id="propertyName" value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder="e.g. Berlin Student Living" className="bg-rk-light border-border text-xs text-rk-navy" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="propertyLocation" className="text-xs font-bold text-rk-navy">Property Location</Label>
                        <Input id="propertyLocation" value={propertyLocation} onChange={(e) => setPropertyLocation(e.target.value)} placeholder="e.g. Pretoria West" className="bg-rk-light border-border text-xs text-rk-navy" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="numBeds" className="text-xs font-bold text-rk-navy">Estimated Beds / Rooms</Label>
                        <Input id="numBeds" type="number" value={numBeds} onChange={(e) => setNumBeds(e.target.value)} placeholder="e.g. 50" className="bg-rk-light border-border text-xs text-rk-navy" />
                      </div>
                    </div>
                  )}

                  {/* Category: Represent Institution */}
                  {enquiryType === "represent_institution" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-white rounded-xl border border-border/40 animate-fade-in">
                      <div className="space-y-2 col-span-1">
                        <Label htmlFor="institution" className="text-xs font-bold text-rk-navy">College / University Name</Label>
                        <Input id="institution" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. Tshwane South College" className="bg-rk-light border-border text-xs text-rk-navy" />
                      </div>
                      <div className="space-y-2 col-span-1">
                        <Label htmlFor="deptRole" className="text-xs font-bold text-rk-navy">Your Department / Role</Label>
                        <Input id="deptRole" value={deptRole} onChange={(e) => setDeptRole(e.target.value)} placeholder="e.g. Student Housing Lead" className="bg-rk-light border-border text-xs text-rk-navy" />
                      </div>
                      <div className="space-y-2 col-span-1">
                        <Label htmlFor="partnershipInterest" className="text-xs font-bold text-rk-navy">Primary Interest</Label>
                        <Input id="partnershipInterest" value={partnershipInterest} onChange={(e) => setPartnershipInterest(e.target.value)} placeholder="e.g. Student Referral Channel" className="bg-rk-light border-border text-xs text-rk-navy" />
                      </div>
                    </div>
                  )}

                  {/* Category: Become Recruiter */}
                  {enquiryType === "become_recruiter" && (
                    <div className="p-4 bg-white rounded-xl border border-border/40 animate-fade-in space-y-2">
                      <Label htmlFor="recruitArea" className="text-xs font-bold text-rk-navy">Target Campus / Area to Recruit Around</Label>
                      <Input id="recruitArea" value={recruitArea} onChange={(e) => setRecruitArea(e.target.value)} placeholder="e.g. TUT Pretoria West Campus" className="bg-rk-light border-border text-xs text-rk-navy" />
                    </div>
                  )}

                  {/* Category: Digital Portals / Business Solutions */}
                  {enquiryType === "need_digital_portal" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white rounded-xl border border-border/40 animate-fade-in">
                      <div className="space-y-2">
                        <Label htmlFor="businessName" className="text-xs font-bold text-rk-navy">Company / Organization Name</Label>
                        <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Student Fund Corp" className="bg-rk-light border-border text-xs text-rk-navy" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="portalType" className="text-xs font-bold text-rk-navy">Type of Portal Needed</Label>
                        <Input id="portalType" value={portalType} onChange={(e) => setPortalType(e.target.value)} placeholder="e.g. White-label Student App Tracker" className="bg-rk-light border-border text-xs text-rk-navy" />
                      </div>
                    </div>
                  )}

                  {/* Standard Message Field */}
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm font-bold text-rk-navy">Message / Brief Description of Needs</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Please share any additional details about your request..."
                      rows={4}
                      className="bg-white border-border text-sm text-rk-navy focus:border-rk-blue"
                    />
                  </div>

                  <Button type="submit" className="w-full bg-rk-navy hover:bg-rk-navy/90 text-white font-bold h-12 rounded-xl text-base shadow-md transition-all">
                    Submit Enquiry
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default Landing;
