import { ReactNode } from "react";
import { BookOpen, ExternalLink, Home, LayoutDashboard, LogOut, Menu, RefreshCw, Shield } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BRAND } from "@/constants/brand";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface TumeloDashboardLayoutProps {
  children: ReactNode;
}

const TumeloDashboardLayout = ({ children }: TumeloDashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, isGodMode, tumeloPartnerRole } = useAuth();

  const dashboardItems = [
    { icon: LayoutDashboard, label: "Career & Education Dashboard", path: "/partner/tumelo/os" },
    { icon: BookOpen, label: "My Public Section", path: "/career-education/tumelo" },
    { icon: Home, label: "ResKonnect Public Site", path: "/" },
  ];

  const handleRefresh = () => {
    toast.info("Refreshing Tumelo dashboard...");
    window.location.reload();
  };

  const Sidebar = () => (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-card text-foreground">
      <div className="shrink-0 border-b p-5">
        <Link to="/" className="block">
          <img src={BRAND.logos.full} alt={BRAND.name} className="mx-auto h-12 w-auto max-w-full object-contain" />
        </Link>
        <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.04] p-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Tumelo × ResKonnect</p>
          <p className="mt-1 text-sm font-bold">Career & Education</p>
          <Badge variant="outline" className="mt-2 capitalize">{tumeloPartnerRole || "authorized member"}</Badge>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {dashboardItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.path !== "/partner/tumelo/os" && <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />}
              </button>
            );
          })}
          {isGodMode && (
            <button onClick={() => navigate("/admin")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition hover:bg-muted">
              <Shield className="h-4 w-4" /> AdminOS
            </button>
          )}
        </div>
      </nav>

      <div className="shrink-0 space-y-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="outline" className="w-full justify-start" onClick={handleRefresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        <div className="flex gap-2">
          <Button variant="ghost" className="min-w-0 flex-1 justify-start" onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] w-full overflow-x-hidden bg-background">
      <aside className="sticky top-0 hidden h-[100dvh] w-72 shrink-0 border-r md:block"><Sidebar /></aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/95 px-3 backdrop-blur-xl md:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open dashboard navigation"><Menu className="h-5 w-5" /></Button></SheetTrigger>
                <SheetContent side="left" className="h-[100dvh] w-[min(90vw,19rem)] p-0"><Sidebar /></SheetContent>
              </Sheet>
            </div>
            <img src={BRAND.logos.icon} alt={BRAND.name} className="h-8 w-8 shrink-0 object-contain" />
            <div className="min-w-0"><p className="truncate text-sm font-black">Career & Education Dashboard</p><p className="truncate text-[11px] text-muted-foreground">Tumelo Sithole workspace</p></div>
          </div>
          <div className="flex items-center gap-2"><Button asChild variant="outline" size="sm" className="hidden sm:inline-flex"><Link to="/career-education/tumelo">View public section</Link></Button><ThemeToggle /></div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
};

export default TumeloDashboardLayout;
