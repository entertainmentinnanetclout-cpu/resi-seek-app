import SEO from "@/components/SEO";
import SEOJsonLd from "@/components/SEOJsonLd";
import { Shield, MapPin, DollarSign, FileCheck, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import HeroCarousel from "@/components/HeroCarousel";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import headerLogo from "@/assets/LIGHT THEME HOMESCREEN_APP ICON.png";
import footerLogo from "@/assets/FOOTER.png";
import iconLogo from "@/assets/LIGHT THEME HOMESCREEN_APP ICON.png";
import artsFestival from "@/assets/arts-festival.jpg";
import campusDinokeng from "@/assets/campus-dinokeng.jpg";
import studentStudying from "@/assets/student-studying.jpg";
import studentsCelebration from "@/assets/students-celebration.jpg";

const Landing = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setMenuOpen] = useState(false);

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success("Thank you! We'll get back to you soon.");
    e.currentTarget.reset();
  };

  const heroSlides = [
    { image: campusDinokeng, title: "Welcome to TUT Dinokeng Campus", description: "Find your perfect student accommodation near campus - 400+ verified options available", cta: { text: "Explore Residences", action: () => navigate("/find") } },
    { image: artsFestival, title: "Experience Campus Life", description: "Join vibrant campus activities and cultural celebrations throughout the year", cta: { text: "Get Started", action: () => navigate("/auth") } },
    { image: studentStudying, title: "Study in Comfort", description: "Access quality accommodation that supports your academic success", cta: { text: "Find Your Res", action: () => navigate("/find") } },
    { image: studentsCelebration, title: "Build Lifelong Connections", description: "Be part of a thriving student community in Pretoria & Tshwane", cta: { text: "Join Now", action: () => navigate("/auth") } }
  ];

  const features = [
    { icon: Shield, title: "Secure & Verified", description: "All residences are verified and meet safety standards for student living." },
    { icon: MapPin, title: "Close to Campus", description: "Find accommodation within walking distance of your university campus." },
    { icon: DollarSign, title: "Affordable Options", description: "Browse residences that fit your budget with transparent pricing." },
    { icon: FileCheck, title: "Easy Applications", description: "Apply to multiple residences with our simple step-by-step process." }
  ];

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ResKonnect",
    "url": "https://reskonnect.co.za",
    "logo": "https://reskonnect.co.za/logo.png",
    "description": "South Africa's leading student accommodation platform connecting students with verified residences in Pretoria, Tshwane, and across Gauteng.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Pretoria",
      "addressRegion": "Gauteng",
      "addressCountry": "ZA"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+27-63-732-3192",
      "contactType": "customer service",
      "email": "Reskonnect@gmail.com",
      "availableLanguage": ["English", "Afrikaans"]
    },
    "sameAs": [
      "https://www.instagram.com/reskonnect",
      "https://www.facebook.com/reskonnect"
    ]
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "ResKonnect Student Accommodation",
    "url": "https://reskonnect.co.za",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://reskonnect.co.za/find?query={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "ResKonnect",
    "@id": "https://reskonnect.co.za",
    "url": "https://reskonnect.co.za",
    "telephone": "+27-63-732-3192",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Pretoria",
      "addressRegion": "Gauteng",
      "addressCountry": "ZA"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -25.7479,
      "longitude": 28.2293
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "08:00",
      "closes": "17:00"
    },
    "priceRange": "R2000 - R6000",
    "areaServed": ["Pretoria", "Tshwane", "Gauteng", "South Africa"]
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Find Student Accommodation in Pretoria & Tshwane | ResKonnect South Africa"
        description="ResKonnect helps South African students find verified, affordable student accommodation near TUT, UP, and other universities in Pretoria, Tshwane & Gauteng. Apply online today!"
        keywords="Pretoria student accommodation, TUT residence, NSFAS approved accommodation, Tshwane student housing, affordable student res, university accommodation South Africa"
      />
      <SEOJsonLd schema={[organizationSchema, websiteSchema, localBusinessSchema]} />
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src={headerLogo} alt="ResKonnect" className="h-8 sm:h-10 w-auto" />
          </div>
          <div className="hidden md:flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/auth")}>Sign In</Button>
            <Button onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90">Get Started</Button>
          </div>
          <Sheet open={isMenuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon"><Menu className="h-6 w-6" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs sm:max-w-sm">
                <div className="p-6">
                    <div className="flex flex-col gap-4 mt-8">
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
      </header>

      <main>
        <section>
          <HeroCarousel slides={heroSlides} autoPlay interval={6000} />
        </section>

        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 md:mb-12">Why Choose ResKonnect?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="bg-card shadow-sm hover:shadow-lg transition-shadow text-center">
                  <CardContent className="p-6">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4 mx-auto">
                      <feature.icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 md:py-20 bg-card/50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center max-w-6xl mx-auto">
              <div className="order-2 md:order-1">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 md:mb-6">About ResKonnect</h2>
                <p className="text-muted-foreground mb-4 leading-relaxed">ResKonnect is your trusted partner in finding quality student accommodation. We connect students with verified residences in Pretoria and Tshwane, making the search process simple and stress-free.</p>
                <p className="text-muted-foreground mb-6 leading-relaxed">Our platform streamlines applications, ensures transparency, and puts students first. Whether you're looking for budget-friendly options or premium facilities, we've got you covered.</p>
                <Button onClick={() => navigate("/auth")} className="w-full sm:w-auto">Get Started</Button>
              </div>
              <div className="order-1 md:order-2 bg-primary/10 rounded-2xl p-8 h-64 md:h-80 flex items-center justify-center">
                <img src={iconLogo} alt="ResKonnect Illustration" className="w-32 md:w-48 h-auto opacity-60" />
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Get in Touch</h2>
              <p className="text-muted-foreground text-center mb-8">Have questions? We're here to help you find your perfect student residence.</p>
              <Card className="bg-card shadow-sm">
                <CardContent className="p-6 md:p-8">
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="space-y-2"><Label htmlFor="name">Full Name</Label><Input id="name" name="name" required placeholder="John Doe" /></div>
                    <div className="space-y-2"><Label htmlFor="email">Email Address</Label><Input id="email" name="email" type="email" required placeholder="john@student.ac.za" /></div>
                    <div className="space-y-2"><Label htmlFor="message">Message</Label><Textarea id="message" name="message" required placeholder="How can we help you?" rows={5} /></div>
                    <Button type="submit" className="w-full">Send Message</Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        
        <section className="py-12 md:py-20 bg-card/50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <Card>
                    <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-2">Connecting Students to their Homes</h3>
                        <p className="text-muted-foreground text-sm">
                        ResKonnect connects students with safe, trusted, and affordable accommodation options across South Africa. Our platform simplifies the process of finding, comparing, and booking residences near major universities and colleges. We are dedicated to making the student housing experience seamless and secure, ensuring that every student finds a place they can call home.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </section>
      </main>

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
                <li><Link to="/auth" className="hover:text-primary transition-colors">Sign Up</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
                <li><Link to="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
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
