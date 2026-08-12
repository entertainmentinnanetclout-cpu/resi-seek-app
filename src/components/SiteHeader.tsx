import { ReactNode, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BRAND } from "@/constants/brand";

export const PUBLIC_NAV = [
  { label: "Living", to: "/living" },
  { label: "Applications", to: "/apply" },
  { label: "Opportunities", to: "/opportunities" },
  { label: "Partners", to: "/partners" },
] as const;

interface SiteHeaderProps {
  /** Optional contextual slot (e.g. a compact search bar on accommodation pages) */
  search?: ReactNode;
}

/**
 * The single public header for ResKonnect. Reuse this on every public page —
 * never re-implement a page-local nav.
 */
const SiteHeader = ({ search }: SiteHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (to: string) => location.pathname.startsWith(to);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        {/* Left: logo, always anchored */}
        <Link to="/" className="mr-auto flex shrink-0 items-center" aria-label={`${BRAND.name} home`}>
          <img
            src={BRAND.logos.full}
            alt={BRAND.name}
            className="hidden h-14 w-auto object-contain sm:block lg:h-16"
          />
          <img
            src={BRAND.logos.icon}
            alt={BRAND.name}
            className="h-11 w-11 object-contain sm:hidden"
          />
        </Link>

        {/* Center: primary nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.to)
                  ? "text-primary"
                  : "text-foreground/80 hover:text-primary"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {search ? <div className="hidden min-w-0 flex-1 lg:block">{search}</div> : null}

        {/* Right: actions */}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Button variant="ghost" onClick={() => navigate("/auth")}>
            Sign In
          </Button>
          <Button
            onClick={() => navigate("/get-started")}
            className="bg-cta font-semibold text-cta-foreground hover:bg-cta/90"
          >
            Get Started
          </Button>
        </div>

        {/* Mobile */}
        <div className="ml-auto flex items-center gap-1.5 md:hidden">
          <ThemeToggle />
          <Button
            size="sm"
            onClick={() => navigate("/get-started")}
            className="bg-cta font-semibold text-cta-foreground hover:bg-cta/90"
          >
            Get Started
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs">
              <div className="mt-10 flex flex-col gap-2">
                {PUBLIC_NAV.map((item) => (
                  <SheetClose key={item.to} asChild>
                    <Link
                      to={item.to}
                      className="rounded-lg px-3 py-3 text-lg font-medium transition-colors hover:bg-muted"
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                <div className="mt-3 space-y-2 border-t pt-3">
                  <SheetClose asChild>
                    <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                      Sign In
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button
                      className="w-full bg-cta font-semibold text-cta-foreground hover:bg-cta/90"
                      onClick={() => navigate("/get-started")}
                    >
                      Get Started
                    </Button>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {search ? <div className="border-t border-border px-4 py-2 lg:hidden">{search}</div> : null}
    </header>
  );
};

export default SiteHeader;
