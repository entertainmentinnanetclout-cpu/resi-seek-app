import { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Home, Bell, Search, FileText, User, Menu, LogOut, GraduationCap, Shield, RefreshCw, Briefcase, LogIn, UserPlus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { RESKONNECT_BRAND } from "@/constants/brand";
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

  // Public browse items (always visible)
  const publicNavItems = [
    { icon: Search, label: "Find My Res", path: "/findmyres" },
    { icon: FileText, label: "Apply", path: "/apply" },
    { icon: GraduationCap, label: "Bursaries", path: "/bursaries" },
  ];

  // Auth-required items (only for logged-in students)
  const authNavItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Briefcase, label: "My WIL", path: "/wil" },
    { icon: FileText, label: "Applications", path: "/applications" },
  ];

  // Admin gets a minimal nav (redirect to admin portal)
  const adminNavItems = [
    { icon: Shield, label: "Admin Portal", path: "/admin" },
  ];

  const { isRecruiter } = useAuth();

  const recruiterNavItems = isRecruiter ? [{ icon: Sparkles, label: "Recruitments", path: "/recruit/dashboard" }] : [];

  const navItems = isAdmin
    ? adminNavItems
    : user
      ? [authNavItems[0], ...publicNavItems, ...authNavItems.slice(1), ...recruiterNavItems]
      : publicNavItems;

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
    <div className="flex flex-col h-full bg-[#071326] text-white">
      <div className="p-6 border-b border-white/5 flex flex-col items-center">
        <Link to="/" className="mb-2 transition-transform hover:scale-[1.02]">
          <img src={RESKONNECT_BRAND.headerLogo} alt={RESKONNECT_BRAND.name} className="h-12 w-auto object-contain brightness-110" />
        </Link>
        {isAdmin ? (
          <Badge variant="destructive" className="w-full justify-center gap-1.5 py-1">
            <Shield className="w-3.5 h-3.5" />
            Admin Mode
          </Badge>
        ) : user ? (
          <p className="text-xs text-slate-300 tracking-wider uppercase font-semibold">Student Portal</p>
        ) : (
          <p className="text-xs text-slate-300 tracking-wider uppercase font-semibold">Browse Residences</p>
        )}
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active 
                    ? "bg-[#2563EB] text-white shadow-md font-semibold"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-white/5 space-y-2.5">
        {user ? (
          <>
            <Button 
              variant="outline" 
              className="w-full justify-start text-slate-300 hover:text-white border-white/10 hover:bg-white/5"
              onClick={handleRefresh}
            >
              <RefreshCw className="w-4 h-4 mr-3" />
              Refresh
            </Button>
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                className="flex-1 justify-start text-slate-300 hover:text-white hover:bg-white/5"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-3" />
                Logout
              </Button>
              <ThemeToggle />
            </div>
          </>
        ) : (
          <>
            <Button 
              className="w-full justify-start bg-[#2563EB] text-white hover:bg-[#2F6EDB]"
              onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`)}
            >
              <LogIn className="w-4 h-4 mr-3" />
              Sign In
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start text-slate-300 hover:text-white border-white/10 hover:bg-white/5"
              onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`)}
            >
              <UserPlus className="w-4 h-4 mr-3" />
              Get Started
            </Button>
            <div className="flex justify-end">
              <ThemeToggle />
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r border-slate-200 shrink-0">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Bar */}
        <header className="hidden md:flex border-b border-slate-200 bg-white p-4 items-center justify-between shadow-sm sticky top-0 z-40">
          <CommandPalette />
          <div className="flex items-center gap-2">
            {user && <NotificationCenter />}
            <ThemeToggle />
            {user ? (
              <button onClick={() => navigate("/profile")} className="ml-1">
                <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-[#2563EB] transition-all">
                  <AvatarImage src={profile?.profile_picture_url || undefined} />
                  <AvatarFallback className="text-xs bg-[#2563EB] text-white">{profileInitials}</AvatarFallback>
                </Avatar>
              </button>
            ) : (
              <Button size="sm" onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`)} className="bg-[#2563EB] text-white hover:bg-[#2F6EDB]">
                Sign In
              </Button>
            )}
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden border-b border-slate-200 bg-[#071326] p-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Link to="/">
              <img src={RESKONNECT_BRAND.headerLogo} alt={RESKONNECT_BRAND.name} className="h-8 w-auto object-contain brightness-110" />
            </Link>
            {isAdmin && (
              <Badge variant="destructive" className="gap-1">
                <Shield className="w-3 h-3" />
                Admin
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user && <NotificationCenter />}
            {user ? (
              <button onClick={() => navigate("/profile")}>
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile?.profile_picture_url || undefined} />
                  <AvatarFallback className="text-xs bg-[#2563EB] text-white">{profileInitials}</AvatarFallback>
                </Avatar>
              </button>
            ) : (
              <Button size="sm" variant="default" onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`)} className="bg-[#2563EB] text-white hover:bg-[#2F6EDB]">
                Sign In
              </Button>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/5">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-[#071326] shadow-lg border-r border-white/5">
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
