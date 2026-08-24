import { ReactNode, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BRAND } from "@/constants/brand";

export const PUBLIC_NAV = [
  { label: "Living", to: "/living" },
  { label: "Applications", to: "/apply" },
  {
    label: "Career & Education",
    to: "/career-education",
    children: [{ label: "Tumelo | Career & Education", to: "/career-education/tumelo" }],
  },
  { label: "Opportunities", to: "/opportunities" },
  { label: "Partners", to: "/partners" },
  { label: "About", to: "/about" },
] as const;

interface SiteHeaderProps {
  search?: ReactNode;
}

const SiteHeader = ({ search }: SiteHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link to="/" className="mr-auto flex shrink-0 items-center" aria-label={`${BRAND.name} home`}>
          <img src={BRAND.logos.full} alt={BRAND.name} className="hidden h-14 w-auto object-contain sm:block lg:h-16" />
          <img src={BRAND.logos.icon} alt={BRAND.name} className="h-11 w-11 object-contain sm:hidden" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {PUBLIC_NAV.map((item) => {
            const children = "children" in item ? item.children : undefined;
            if (!children) {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive(item.to) ? "text-primary" : "text-foreground/80 hover:text-primary"}`}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <div key={item.to} className="group relative">
                <Link
                  to={item.to}
                  className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive(item.to) ? "text-primary" : "text-foreground/80 hover:text-primary"}`}
                >
                  {item.label} <ChevronDown className="h-3.5 w-3.5" />
                </Link>
                <div className="invisible absolute left-0 top-full z-50 min-w-[250px] translate-y-1 rounded-xl border bg-popover p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <Link to={item.to} className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted">
                    Explore Career & Education
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Guidance, contributors and student pathways</span>
                  </Link>
                  <div className="my-1 border-t" />
                  {children.map((child) => (
                    <Link key={child.to} to={child.to} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-muted hover:text-primary">
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {search ? <div className="hidden min-w-0 flex-1 lg:block">{search}</div> : null}

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Button variant="ghost" onClick={() => navigate("/auth")}>Sign In</Button>
          <Button onClick={() => navigate("/get-started")} className="bg-cta font-semibold text-cta-foreground hover:bg-cta/90">Get Started</Button>
        </div>

        <div className="ml-auto flex items-center gap-1.5 md:hidden">
          <ThemeToggle />
          <Button size="sm" onClick={() => navigate("/get-started")} className="bg-cta font-semibold text-cta-foreground hover:bg-cta/90">Get Started</Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs">
              <div className="mt-10 flex flex-col gap-2">
                {PUBLIC_NAV.map((item) => {
                  const children = "children" in item ? item.children : undefined;
                  return (
                    <div key={item.to} className="rounded-xl border-b border-border/60 pb-1 last:border-0">
                      <SheetClose asChild>
                        <Link to={item.to} className="block rounded-lg px-3 py-3 text-lg font-medium transition-colors hover:bg-muted">{item.label}</Link>
                      </SheetClose>
                      {children?.map((child) => (
                        <SheetClose key={child.to} asChild>
                          <Link to={child.to} className="ml-3 block rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-primary">{child.label}</Link>
                        </SheetClose>
                      ))}
                    </div>
                  );
                })}
                <div className="mt-3 space-y-2 border-t pt-3">
                  <SheetClose asChild><Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>Sign In</Button></SheetClose>
                  <SheetClose asChild><Button className="w-full bg-cta font-semibold text-cta-foreground hover:bg-cta/90" onClick={() => navigate("/get-started")}>Get Started</Button></SheetClose>
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
