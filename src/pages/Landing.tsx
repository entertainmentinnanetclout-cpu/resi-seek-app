import { Shield, MapPin, DollarSign, FileCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import HeroCarousel from "@/components/HeroCarousel";
import headerLogo from "@/assets/Main header Desktop.png";
import footerLogo from "@/assets/FOOTER.png";
import iconLogo from "@/assets/ICON NO TEXT.png";
import artsFestival from "@/assets/arts-festival.jpg";
import campusDinokeng from "@/assets/campus-dinokeng.jpg";
import studentStudying from "@/assets/student-studying.jpg";
import studentsCelebration from "@/assets/students-celebration.jpg";

const Landing = () => {
  const navigate = useNavigate();

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name");
    const email = formData.get("email");
    const message = formData.get("message");
    
    // TODO: Send to backend/email service
    toast.success("Thank you! We'll get back to you soon.");
    e.currentTarget.reset();
  };

  const heroSlides = [
    {
      image: campusDinokeng,
      title: "Welcome to TUT Main Campus",
      description: "Find your perfect student accommodation near campus - 400+ verified options available",
      cta: {
        text: "Explore Residences",
        action: () => navigate("/auth")
      }
    },
    {
      image: artsFestival,
      title: "Experience Campus Life",
      description: "Join vibrant campus activities and cultural celebrations throughout the year",
      cta: {
        text: "Get Started",
        action: () => navigate("/auth")
      }
    },
    {
      image: studentStudying,
      title: "Study in Comfort",
      description: "Access quality accommodation that supports your academic success",
      cta: {
        text: "Find Your Res",
        action: () => navigate("/auth")
      }
    },
    {
      image: studentsCelebration,
      title: "Build Lifelong Connections",
      description: "Be part of a thriving student community in Pretoria & Tshwane",
      cta: {
        text: "Join Now",
        action: () => navigate("/auth")
      }
    }
  ];

  const features = [
    {
      icon: Shield,
      title: "Secure & Verified",
      description: "All residences are verified and meet safety standards for student living."
    },
    {
      icon: MapPin,
      title: "Close to Campus",
      description: "Find accommodation within walking distance of your university campus."
    },
    {
      icon: DollarSign,
      title: "Affordable Options",
      description: "Browse residences that fit your budget with transparent pricing."
    },
    {
      icon: FileCheck,
      title: "Easy Applications",
      description: "Apply to multiple residences with our simple step-by-step process."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={headerLogo} alt="ResKonnect" className="h-10 w-auto" />
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button variant="default" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Carousel */}
      <section>
        <HeroCarousel slides={heroSlides} autoPlay interval={6000} />
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-8 md:mb-12">Why Choose ResKonnect?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="shadow-card hover:shadow-premium transition-smooth group">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-gradient-accent rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-smooth">
                    <feature.icon className="w-8 h-8 text-accent-foreground" />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm md:text-base text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-12 md:py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center max-w-6xl mx-auto">
            <div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-6">About ResKonnect</h2>
              <p className="text-sm md:text-base text-muted-foreground mb-4 leading-relaxed">
                ResKonnect is your trusted partner in finding quality student accommodation. We connect students with verified residences in Pretoria and Tshwane, making the search process simple and stress-free.
              </p>
              <p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed">
                Our platform streamlines applications, ensures transparency, and puts students first. Whether you're looking for budget-friendly options or premium facilities, we've got you covered.
              </p>
              <Button variant="default" onClick={() => navigate("/auth")} className="w-full sm:w-auto">
                Get Started
              </Button>
            </div>
            <div className="bg-accent/10 rounded-2xl p-8 h-64 md:h-80 flex items-center justify-center">
              <img src={iconLogo} alt="ResKonnect Illustration" className="w-32 md:w-48 h-auto opacity-60" />
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-4">Get in Touch</h2>
            <p className="text-sm md:text-base text-muted-foreground text-center mb-8">
              Have questions? We're here to help you find your perfect student residence.
            </p>
            <Card className="shadow-card">
              <CardContent className="p-4 md:p-6">
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="name" className="text-sm font-medium mb-2 block">
                      Full Name
                    </label>
                    <Input id="name" name="name" required placeholder="John Doe" />
                  </div>
                  <div>
                    <label htmlFor="email" className="text-sm font-medium mb-2 block">
                      Email Address
                    </label>
                    <Input id="email" name="email" type="email" required placeholder="john@student.ac.za" />
                  </div>
                  <div>
                    <label htmlFor="message" className="text-sm font-medium mb-2 block">
                      Message
                    </label>
                    <Textarea 
                      id="message" 
                      name="message" 
                      required 
                      placeholder="How can we help you?"
                      rows={5}
                    />
                  </div>
                  <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={footerLogo} alt="ResKonnect" className="h-6 md:h-8 w-auto" />
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                Your trusted student accommodation finder in Pretoria & Tshwane.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm md:text-base">Quick Links</h4>
              <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
                <li><button onClick={() => navigate("/auth")} className="hover:text-accent transition-colors">Get Started</button></li>
                <li><button onClick={() => navigate("/auth")} className="hover:text-accent transition-colors">Sign Up</button></li>
                <li><button onClick={() => navigate("/auth")} className="hover:text-accent transition-colors">Login</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm md:text-base">Contact</h4>
              <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
                <li>Email: ResKonnect@gmail.com</li>
                <li>Phone: +27 63 732 3192</li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-4 md:pt-6 text-center text-xs md:text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} ResKonnect. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
