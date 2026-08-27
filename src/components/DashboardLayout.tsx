import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, FileText, Menu, LogOut, GraduationCap, Shield, RefreshCw, Briefcase, LogIn, UserPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND } from "@/constants/brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import NotificationCenter from "@/components/NotificationCenter";
import CommandPalette from "@/components/CommandPalette";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";

interface DashboardLayoutProps { children: ReactNode; }

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, isAdmin, user, isRecruiter } = useAuth();
  const { profile } = useRealtimeProfile(user);

  const publicNavItems = [
    { icon: Search, label: "Find My Res", path: "/findmyres" },
    { icon: FileText, label: "Apply", path: "/apply" },
    { icon: GraduationCap, label: "Bursaries", path: "/bursaries" },
  ];
  const authNavItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Briefcase, label: "My WIL", path: "/wil" },
    { icon: FileText, label: "Applications", path: "/applications" },
  ];
  const adminNavItems = [{ icon: Shield, label: "Admin Portal", path: "/admin" }];
  const recruiterNavItems = isRecruiter ? [{ icon: Sparkles, label: "Recruitments", path: "/recruit/dashboard" }] : [];
  const navItems = isAdmin ? adminNavItems : user ? [authNavItems[0], ...publicNavItems, ...authNavItems.slice(1), ...recruiterNavItems] : publicNavItems;

  const isActive = (path: string) => location.pathname === path;
  const handleLogout = async () => { await signOut(); };
  const handleRefresh = () => { toast.info("Refreshing data..."); window.location.reload(); };
  const profileInitials = profile?.full_name
    ? profile.full_name.split(" ").map((name: string) => name[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const SidebarContent = () => (
    <div className="flex h-[100dvh] min-h-0 w-full min-w-0 flex-col overflow-hidden bg-card text-foreground">
      <div className="shrink-0 border-b border-border p-5 sm:p-6">
        <div className="mb-1 flex flex-col items-center">
          <img src={BRAND.logos.full} alt={BRAND.name} className="mb-2 h-14 max-w-full object-contain sm:h-16" />
        </div>
        {isAdmin ? (
          <Badge variant="destructive" className="w-full justify-center gap-1.5 py-1"><Shield className="h-3.5 w-3.5" />Admin Mode</Badge>
        ) : user ? (
          <p className="text-center text-sm text-muted-foreground">Student Portal</p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">Browse Residences</p>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [-webkit-overflow-scrolling:touch]">
        <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex w-full min-w-0 items-center gap-3 rounded-lg px-4 py-3 text-left transition-smooth ${active ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-primary/10"}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0 truncate font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 space-y-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {user ? <>
          <Button variant="outline" className="w-full justify-start" onClick={handleRefresh}><RefreshCw className="mr-3 h-5 w-5" />Refresh</Button>
          <div className="flex items-center justify-between gap-2"><Button variant="ghost" className="min-w-0 flex-1 justify-start" onClick={handleLogout}><LogOut className="mr-3 h-5 w-5 shrink-0" />Logout</Button><ThemeToggle /></div>
        </> : <>
          <Button className="w-full justify-start" onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`)}><LogIn className="mr-3 h-5 w-5" />Sign In</Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`)}><UserPlus className="mr-3 h-5 w-5" />Get Started</Button>
          <div className="flex justify-end"><ThemeToggle /></div>
        </>}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-background">
      <aside className="sticky top-0 hidden h-[100dvh] max-h-[100dvh] w-64 shrink-0 overflow-hidden border-r border-border md:block">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
        <header className="hidden shrink-0 items-center justify-between border-b border-border bg-card p-4 md:flex">
          <CommandPalette />
          <div className="flex items-center gap-2">
            {user && <NotificationCenter />}
            <ThemeToggle />
            {user ? <button onClick={() => navigate("/profile")} className="ml-1"><Avatar className="h-8 w-8 cursor-pointer transition-all hover:ring-2 hover:ring-primary"><AvatarImage src={profile?.profile_picture_url || undefined} /><AvatarFallback className="bg-primary text-xs text-primary-foreground">{profileInitials}</AvatarFallback></Avatar></button> : <Button size="sm" onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`)}>Sign In</Button>}
          </div>
        </header>

        <header className="flex min-w-0 shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-border bg-card px-3 py-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <img src={BRAND.logos.full} alt={BRAND.name} className="h-8 min-w-0 max-w-[145px] object-contain object-left" />
            {isAdmin && <Badge variant="destructive" className="shrink-0 gap-1"><Shield className="h-3 w-3" />Admin</Badge>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {user && <NotificationCenter />}
            {user ? <button onClick={() => navigate("/profile")}><Avatar className="h-7 w-7"><AvatarImage src={profile?.profile_picture_url || undefined} /><AvatarFallback className="bg-primary text-xs text-primary-foreground">{profileInitials}</AvatarFallback></Avatar></button> : <Button size="sm" variant="default" onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`)}>Sign In</Button>}
            <Sheet>
              <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open navigation"><Menu className="h-5 w-5" /></Button></SheetTrigger>
              <SheetContent side="right" className="h-[100dvh] w-[min(92vw,20rem)] max-w-none overflow-hidden p-0 bg-card shadow-lg">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
