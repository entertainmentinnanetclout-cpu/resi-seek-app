import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { RESKONNECT_BRAND } from "@/constants/brand";

interface PublicLayoutProps {
  children: ReactNode;
}

const PublicLayout = ({ children }: PublicLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-border bg-white/95 backdrop-blur-md sticky top-0 z-50 transition-all duration-300 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 transition-transform duration-200 hover:scale-[1.02]">
            <img
              src={RESKONNECT_BRAND.headerLogo}
              alt={RESKONNECT_BRAND.name}
              className="h-9 sm:h-11 w-auto object-contain"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            <Link to="/living" className="text-sm font-semibold text-[#071326]/80 hover:text-primary transition-colors">
              Living
            </Link>
            <Link to="/applications" className="text-sm font-semibold text-[#071326]/80 hover:text-primary transition-colors">
              Applications
            </Link>
            <Link to="/opportunities" className="text-sm font-semibold text-[#071326]/80 hover:text-primary transition-colors">
              Opportunities
            </Link>
            <Link to="/partners" className="text-sm font-semibold text-[#071326]/80 hover:text-primary transition-colors">
              Partners
            </Link>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate("/auth")}
              className="text-sm font-semibold text-[#071326]/80 hover:text-[#071326] hover:bg-black/5"
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate("/get-started")}
              className="bg-[#2563EB] text-white hover:bg-[#2F6EDB] shadow-md font-semibold px-5"
            >
              Get Started
            </Button>
          </div>
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon" className="border-slate-200 hover:bg-slate-50">
                <Menu className="h-5 w-5 text-[#071326]" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs sm:max-w-sm border-l border-slate-150 p-0 bg-white">
              <div className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                  <img src={RESKONNECT_BRAND.headerLogo} alt="ResKonnect Logo" className="h-8 w-auto object-contain" />
                </div>
                <div className="flex flex-col gap-5 mt-4">
                  <SheetClose asChild>
                    <Link to="/living" className="text-lg font-semibold text-[#071326] border-b pb-2 hover:text-[#2563EB] transition-colors">
                      Living
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/applications" className="text-lg font-semibold text-[#071326] border-b pb-2 hover:text-[#2563EB] transition-colors">
                      Applications
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/opportunities" className="text-lg font-semibold text-[#071326] border-b pb-2 hover:text-[#2563EB] transition-colors">
                      Opportunities
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/partners" className="text-lg font-semibold text-[#071326] border-b pb-2 hover:text-[#2563EB] transition-colors">
                      Partners
                    </Link>
                  </SheetClose>

                  <div className="flex flex-col gap-3 mt-8">
                    <SheetClose asChild>
                      <Button variant="outline" className="w-full font-semibold border-slate-200" onClick={() => navigate("/auth")}>
                        Sign In
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button className="w-full bg-[#2563EB] text-white hover:bg-[#2F6EDB] font-semibold" onClick={() => navigate("/get-started")}>
                        Get Started
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#071326] text-white border-t border-white/5 relative overflow-hidden">
        {/* Abstract background graphics for premium branding */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 mb-12">
            {/* Brand column */}
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-2">
                <img
                  src={RESKONNECT_BRAND.footerLogo}
                  alt={RESKONNECT_BRAND.name}
                  className="h-11 w-auto object-contain"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold tracking-[0.18em] text-[#F5B32F]">
                  {RESKONNECT_BRAND.descriptor}
                </p>
                <p className="text-xs text-slate-300 italic font-medium">
                  {RESKONNECT_BRAND.tagline}
                </p>
              </div>
              <p className="text-sm text-slate-400 max-w-sm leading-relaxed pt-2">
                Your nationwide gateway connecting South African students, parents, landlords, and institutions to trusted housing and opportunity hubs.
              </p>
            </div>

            {/* Quick Links Column */}
            <div className="md:col-span-2">
              <h4 className="font-bold text-white text-sm tracking-wider uppercase mb-4 pb-1 border-b border-white/10">Quick Links</h4>
              <ul className="space-y-2.5 text-sm text-slate-300">
                <li><Link to="/living" className="hover:text-[#F5B32F] transition-colors">Living</Link></li>
                <li><Link to="/applications" className="hover:text-[#F5B32F] transition-colors">Applications</Link></li>
                <li><Link to="/opportunities" className="hover:text-[#F5B32F] transition-colors">Opportunities</Link></li>
                <li><Link to="/partners" className="hover:text-[#F5B32F] transition-colors">Partners</Link></li>
                <li><Link to="/get-started" className="hover:text-[#F5B32F] font-semibold transition-colors">Get Started</Link></li>
              </ul>
            </div>

            {/* Support/Resource Column */}
            <div className="md:col-span-2">
              <h4 className="font-bold text-white text-sm tracking-wider uppercase mb-4 pb-1 border-b border-white/10">Services</h4>
              <ul className="space-y-2.5 text-sm text-slate-300">
                <li><Link to="/living/student-accommodation" className="hover:text-[#F5B32F] transition-colors">Student Accommodation</Link></li>
                <li><Link to="/living/private-rentals" className="hover:text-[#F5B32F] transition-colors">Private Rentals</Link></li>
                <li><Link to="/applications/checker" className="hover:text-[#F5B32F] transition-colors">APS Estimator</Link></li>
                <li><Link to="/opportunities/wil" className="hover:text-[#F5B32F] transition-colors">Work Integrated Learning</Link></li>
              </ul>
            </div>

            {/* Contact Column */}
            <div className="md:col-span-3">
              <h4 className="font-bold text-white text-sm tracking-wider uppercase mb-4 pb-1 border-b border-white/10">Contact Support</h4>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex flex-col">
                  <span className="text-[11px] text-slate-400 font-semibold tracking-wider uppercase">Email Support</span>
                  <a href="mailto:reskonnect@gmail.com" className="text-white hover:text-[#F5B32F] font-medium transition-colors">reskonnect@gmail.com</a>
                </li>
                <li className="flex flex-col">
                  <span className="text-[11px] text-slate-400 font-semibold tracking-wider uppercase">WhatsApp Helpline</span>
                  <a href="https://wa.me/27637323192" target="_blank" rel="noreferrer" className="text-white hover:text-[#F5B32F] font-medium transition-colors">063 732 3192</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-400 text-center md:text-left leading-relaxed max-w-2xl">
              &copy; {new Date().getFullYear()} ResKonnect. All rights reserved. <br className="md:hidden" />
              <span className="text-[#F5B32F] font-medium">Compliance Note:</span> ResKonnect provides guided support and does not replace official institution systems.
            </p>
            <div className="flex gap-4 text-xs text-slate-400">
              <Link to="/privacy" className="hover:text-[#F5B32F] transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-[#F5B32F] transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
