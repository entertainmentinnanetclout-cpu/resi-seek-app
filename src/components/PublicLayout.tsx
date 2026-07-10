import { ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, ChevronDown, Landmark, Key, UserCheck, ShieldAlert, Laptop, Briefcase } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import headerLogo from "@/assets/LIGHT THEME HOMESCREEN_APP ICON.png";
import footerLogo from "@/assets/FOOTER.png";

interface PublicLayoutProps {
  children: ReactNode;
}

const PublicLayout = ({ children }: PublicLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleAnchorLink = (hash: string) => {
    if (location.pathname !== "/") {
      navigate("/" + hash);
    } else {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <div className="min-h-screen bg-rk-light text-rk-navy flex flex-col font-sans selection:bg-rk-blue/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-rk-navy text-rk-white sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 group">
            <img src={headerLogo} alt="ResKonnect" className="h-9 sm:h-11 w-auto transition-transform group-hover:scale-105" />
          </Link>

          {/* Simple Corporate Header Links */}
          <nav className="hidden md:flex items-center gap-5">
            <Link to="/" className="text-sm font-semibold hover:text-rk-gold transition-colors">
              Home
            </Link>
            <Link to="/find-my-res" className="text-sm font-semibold hover:text-rk-gold transition-colors">
              Accommodation
            </Link>
            <button onClick={() => handleAnchorLink("#opportunities")} className="text-sm font-semibold hover:text-rk-gold transition-colors">
              Opportunities
            </button>
            <button onClick={() => handleAnchorLink("#partners")} className="text-sm font-semibold hover:text-rk-gold transition-colors">
              Partners
            </button>
            <Link to="/recruit" className="text-sm font-semibold hover:text-rk-gold transition-colors">
              Recruiters
            </Link>
            <button onClick={() => handleAnchorLink("#pillars")} className="text-sm font-semibold hover:text-rk-gold transition-colors">
              About
            </button>
            <button onClick={() => handleAnchorLink("#contact")} className="text-sm font-semibold hover:text-rk-gold transition-colors">
              Contact
            </button>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {/* Portal Login Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-rk-white hover:text-rk-navy hover:bg-rk-white text-sm font-semibold gap-1">
                  Portal Login <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white border border-border text-rk-navy shadow-lg rounded-xl mt-1">
                <DropdownMenuItem onClick={() => navigate("/auth")} className="gap-2 cursor-pointer focus:bg-rk-light focus:text-rk-blue py-2.5">
                  <UserCheck className="h-4 w-4 text-rk-blue" />
                  <span>Student Portal</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/recruit/auth")} className="gap-2 cursor-pointer focus:bg-rk-light focus:text-rk-blue py-2.5">
                  <Briefcase className="h-4 w-4 text-rk-gold" />
                  <span>Recruiter Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/residence/login")} className="gap-2 cursor-pointer focus:bg-rk-light focus:text-rk-blue py-2.5">
                  <Key className="h-4 w-4 text-rk-orange" />
                  <span>Residence Portal</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/tvet-dashboard")} className="gap-2 cursor-pointer focus:bg-rk-light focus:text-rk-blue py-2.5">
                  <Laptop className="h-4 w-4 text-rk-green" />
                  <span>TVET Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={() => navigate("/auth")} className="gap-2 cursor-pointer focus:bg-rk-light focus:text-rk-blue py-2.5 font-medium">
                  <ShieldAlert className="h-4 w-4 text-rk-red" />
                  <span>Admin Login</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={() => navigate("/auth")} className="bg-rk-blue hover:bg-rk-blue/90 text-white font-semibold rounded-lg px-5 shadow-sm transition-transform hover:-translate-y-[1px]">
              Get Started
            </Button>
          </div>

          {/* Mobile Navigation Sheet */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" className="text-rk-white border-white/20 hover:bg-white/10" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs sm:max-w-sm bg-rk-navy text-rk-white border-l-rk-blue/20">
              <div className="p-4 flex flex-col gap-6 mt-8">
                <SheetClose asChild>
                  <Link to="/" className="text-lg font-medium hover:text-rk-gold transition-colors">
                    Home
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/find-my-res" className="text-lg font-medium hover:text-rk-gold transition-colors">
                    Accommodation
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <button onClick={() => handleAnchorLink("#opportunities")} className="text-lg font-medium text-left hover:text-rk-gold transition-colors">
                    Opportunities
                  </button>
                </SheetClose>
                <SheetClose asChild>
                  <button onClick={() => handleAnchorLink("#partners")} className="text-lg font-medium text-left hover:text-rk-gold transition-colors">
                    Partners
                  </button>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/recruit" className="text-lg font-medium hover:text-rk-gold transition-colors">
                    Recruiters
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <button onClick={() => handleAnchorLink("#pillars")} className="text-lg font-medium text-left hover:text-rk-gold transition-colors">
                    About
                  </button>
                </SheetClose>
                <SheetClose asChild>
                  <button onClick={() => handleAnchorLink("#contact")} className="text-lg font-medium text-left hover:text-rk-gold transition-colors">
                    Contact
                  </button>
                </SheetClose>

                <div className="border-t border-white/10 pt-4 mt-2 space-y-3">
                  <p className="text-xs uppercase tracking-wider text-white/50 font-semibold mb-1">Portal Logins</p>
                  <SheetClose asChild>
                    <button onClick={() => navigate("/auth")} className="flex items-center gap-2 text-sm text-white/80 hover:text-white py-1">
                      <UserCheck className="h-4 w-4 text-rk-blue" /> Student Portal
                    </button>
                  </SheetClose>
                  <SheetClose asChild>
                    <button onClick={() => navigate("/recruit/auth")} className="flex items-center gap-2 text-sm text-white/80 hover:text-white py-1">
                      <Briefcase className="h-4 w-4 text-rk-gold" /> Recruiter Dashboard
                    </button>
                  </SheetClose>
                  <SheetClose asChild>
                    <button onClick={() => navigate("/residence/login")} className="flex items-center gap-2 text-sm text-white/80 hover:text-white py-1">
                      <Key className="h-4 w-4 text-rk-orange" /> Residence Portal
                    </button>
                  </SheetClose>
                  <SheetClose asChild>
                    <button onClick={() => navigate("/tvet-dashboard")} className="flex items-center gap-2 text-sm text-white/80 hover:text-white py-1">
                      <Laptop className="h-4 w-4 text-rk-green" /> TVET Dashboard
                    </button>
                  </SheetClose>
                  <SheetClose asChild>
                    <button onClick={() => navigate("/auth")} className="flex items-center gap-2 text-sm text-white/80 hover:text-white py-1">
                      <ShieldAlert className="h-4 w-4 text-rk-red" /> Admin Login
                    </button>
                  </SheetClose>

                  <div className="pt-4">
                    <SheetClose asChild>
                      <Button onClick={() => navigate("/auth")} className="w-full bg-rk-blue hover:bg-rk-blue/90 text-white">
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
      <main className="flex-1 bg-white">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-rk-deep-navy text-rk-white border-t border-white/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="sm:col-span-2 md:col-span-1 space-y-4">
              <div className="flex items-center gap-2">
                <img src={footerLogo} alt="ResKonnect" className="h-8 w-auto" />
              </div>
              <p className="text-sm text-white/70 max-w-xs leading-relaxed">
                ResKonnect connects students with trusted accommodation, practical opportunities, and digital services designed to support their journey from campus to career.
              </p>
              <p className="text-xs font-bold text-rk-gold tracking-widest uppercase">
                LIVING • AI • OPPORTUNITY
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Quick Links</h4>
              <ul className="space-y-2.5 text-sm text-white/70">
                <li><Link to="/find-my-res" className="hover:text-rk-gold transition-colors">Find My Res</Link></li>
                <li><button onClick={() => handleAnchorLink("#opportunities")} className="hover:text-rk-gold transition-colors text-left">Student Opportunities</button></li>
                <li><Link to="/recruit" className="hover:text-rk-gold transition-colors">Become a Recruiter</Link></li>
                <li><button onClick={() => handleAnchorLink("#partners")} className="hover:text-rk-gold transition-colors text-left">Partner Solutions</button></li>
                <li><button onClick={() => handleAnchorLink("#contact")} className="hover:text-rk-gold transition-colors text-left">Get in Touch</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Student & Partners</h4>
              <ul className="space-y-2.5 text-sm text-white/70">
                <li><Link to="/auth" className="hover:text-rk-gold transition-colors">Student Portal</Link></li>
                <li><Link to="/recruit/auth" className="hover:text-rk-gold transition-colors">Recruiter Dashboard</Link></li>
                <li><Link to="/residence/login" className="hover:text-rk-gold transition-colors">Residence Portal</Link></li>
                <li><Link to="/tvet-dashboard" className="hover:text-rk-gold transition-colors">TVET Dashboard</Link></li>
                <li><Link to="/terms" className="hover:text-rk-gold transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-rk-gold transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Contact Channels</h4>
              <ul className="space-y-3 text-sm text-white/70">
                <li className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-rk-blue" />
                  <span>National Coverage, SA</span>
                </li>
                <li>Email: Reskonnect@gmail.com</li>
                <li>Phone: 063 732 3192</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 text-center text-xs text-white/40 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p>&copy; {new Date().getFullYear()} ResKonnect. All rights reserved.</p>
            <p className="flex items-center gap-1">
              Connecting Residents. Advancing Futures.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;