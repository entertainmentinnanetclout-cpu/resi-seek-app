import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Bell, Search, FileText, User, Menu, MessageSquare, LogOut, Newspaper, ShoppingBag, GraduationCap, Percent, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import desktopLogo from "@/assets/LIGHT THEME HOMESCREEN_APP ICON.png";
import mobileLogo from "@/assets/LIGHT THEME HOMESCREEN_APP ICON.png";
import { ThemeToggle } from "@/components/ThemeToggle";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const navItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Bell, label: "Updates", path: "/dashboard/updates" },
    { icon: Newspaper, label: "Campus News", path: "/campus-news" },
    { icon: Search, label: "Find My Res", path: "/findmyres" },
    { icon: ShoppingBag, label: "Marketplace", path: "/marketplace" },
    { icon: GraduationCap, label: "Bursaries", path: "/bursaries" },
    { icon: Percent, label: "Discounts", path: "/discounts" },
    { icon: Users, label: "Roommates", path: "/roommates" },
    { icon: Calendar, label: "Events", path: "/events" },
    { icon: FileText, label: "Applications", path: "/applications" },
    { icon: User, label: "Profile", path: "/profile" },
    { icon: MessageSquare, label: "Messages", path: "/messages" },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await signOut();
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card text-foreground">
      <div className="p-6 border-b border-border">
        <div className="flex flex-col items-center mb-1">
          <img src={desktopLogo} alt="ResKonnect" className="h-16 w-auto mb-2" />
        </div>
        <p className="text-sm text-muted-foreground text-center">Student Portal</p>
      </div>

      <nav className="flex-1 p-4">
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

      <div className="p-4 border-t border-border flex items-center justify-between">
        <Button 
          variant="ghost" 
          className="w-full justify-start" 
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
        <ThemeToggle />
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
        {/* Mobile Header */}
        <header className="md:hidden border-b border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center">
            <img src={mobileLogo} alt="ResKonnect" className="h-8 w-auto" />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
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
