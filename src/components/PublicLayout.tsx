import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import headerLogo from "@/assets/LIGHT THEME HOMESCREEN_APP ICON.png";
import footerLogo from "@/assets/FOOTER.png";

interface PublicLayoutProps {
  children: ReactNode;
}

const PublicLayout = ({ children }: PublicLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <img src={headerLogo} alt="ResKonnect" className="h-8 sm:h-10 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/living" className="text-sm font-medium hover:text-primary transition-colors">
              Living
            </Link>
            <Link to="/applications" className="text-sm font-medium hover:text-primary transition-colors">
              Applications
            </Link>
            <Link to="/opportunities" className="text-sm font-medium hover:text-primary transition-colors">
              Opportunities
            </Link>
            <Link to="/partners" className="text-sm font-medium hover:text-primary transition-colors">
              Partners
            </Link>
          </nav>
          <div className="hidden md:flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/auth")}>Sign In</Button>
            <Button onClick={() => navigate("/get-started")} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Get Started
            </Button>
          </div>
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon"><Menu className="h-6 w-6" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs sm:max-w-sm">
              <div className="p-6">
                <div className="flex flex-col gap-4 mt-8">
                  <SheetClose asChild>
                    <Link to="/living" className="text-lg font-medium hover:text-primary transition-colors">
                      Living
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/applications" className="text-lg font-medium hover:text-primary transition-colors">
                      Applications
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/opportunities" className="text-lg font-medium hover:text-primary transition-colors">
                      Opportunities
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/partners" className="text-lg font-medium hover:text-primary transition-colors">
                      Partners
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/auth")}>
                      Sign In
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button className="w-full" onClick={() => navigate("/get-started")}>Get Started</Button>
                  </SheetClose>
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
      <footer className="bg-card/50 border-t">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src={footerLogo} alt="ResKonnect" className="h-7 w-auto" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your trusted student accommodation finder in Pretoria & Tshwane.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/find" className="hover:text-primary transition-colors">Find My Res</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">Sign Up</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">Login</Link></li>
                <li><Link to="/apply" className="hover:text-primary transition-colors">Applications</Link></li>
                <li><Link to="/affiliates" className="hover:text-primary transition-colors">Affiliates</Link></li>
                <li><Link to="/recruit" className="hover:text-primary transition-colors">Become a Recruiter</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Accommodation</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/nsfas-accredited-accommodation" className="hover:text-primary transition-colors">NSFAS Approved</Link></li>
                <li><Link to="/student-accommodation-gauteng" className="hover:text-primary transition-colors">Gauteng</Link></li>
                <li><Link to="/tut-pretoria-west-accommodation" className="hover:text-primary transition-colors">TUT Pretoria West</Link></li>
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

export default PublicLayout;