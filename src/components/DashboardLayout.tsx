import { ReactNode } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Home, Bell, Search, FileText, User, Menu, LogOut, ShoppingBag, GraduationCap, Shield, RefreshCw, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import desktopLogo from "@/assets/LIGHT THEME HOMESCREEN_APP ICON.png";
import mobileLogo from "@/assets/LIGHT THEME HOMESCREEN_APP ICON.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import NotificationCenter from "@/components/NotificationCenter";
import CommandPalette from "@/components/CommandPalette";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, isAdmin, user } = useAuth();
  const { profile } = useRealtimeProfile(user);

  // Streamlined student nav — Phase 1C
  const studentNavItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Search, label: "Find My Res", path: "/findmyres" },
    { icon: ShoppingBag, label: "Marketplace", path: "/marketplace" },
    { icon: GraduationCap, label: "Bursaries", path: "/bursaries" },
    { icon: Briefcase, label: "My WIL", path: "/wil" },
    { icon: FileText, label: "Applications", path: "/applications" },
  ];

  // Admin gets a minimal nav (redirect to admin portal)
  const adminNavItems = [
    { icon: Shield, label: "Admin Portal", path: "/admin" },
  ];

  const navItems = isAdmin ? adminNavItems : studentNavItems;

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await signOut();
  };

  const handleRefresh = () => {
    toast.info("Refreshing data...");
    window.location.reload();
  };

  const profileInitials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card text-foreground">
      <div className="p-6 border-b border-border">
        <div className="flex flex-col items-center mb-1">
          <img src={desktopLogo} alt="ResKonnect" className="h-16 w-auto mb-2" />
        </div>
        {isAdmin ? (
          <Badge variant="destructive" className="w-full justify-center gap-1.5 py-1">
            <Shield className="w-3.5 h-3.5" />
            Admin Mode
          </Badge>
        ) : (
          <p className="text-sm text-muted-foreground text-center">Student Portal</p>
        )}
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-smooth ${
                  active 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "hover:bg-primary/10"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <Button 
          variant="outline" 
          className="w-full justify-start" 
          onClick={handleRefresh}
        >
          <RefreshCw className="w-5 h-5 mr-3" />
          Refresh
        </Button>
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            className="flex-1 justify-start" 
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r border-border">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Desktop Top Bar */}
        <header className="hidden md:flex border-b border-border bg-card p-4 items-center justify-between">
          <CommandPalette />
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <ThemeToggle />
            <button onClick={() => navigate("/profile")} className="ml-1">
              <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                <AvatarImage src={profile?.profile_picture_url || undefined} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">{profileInitials}</AvatarFallback>
              </Avatar>
            </button>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden border-b border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={mobileLogo} alt="ResKonnect" className="h-8 w-auto" />
            {isAdmin && (
              <Badge variant="destructive" className="gap-1">
                <Shield className="w-3 h-3" />
                Admin
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <button onClick={() => navigate("/profile")}>
              <Avatar className="h-7 w-7">
                <AvatarImage src={profile?.profile_picture_url || undefined} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">{profileInitials}</AvatarFallback>
              </Avatar>
            </button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-card shadow-lg">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
