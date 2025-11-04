import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Bell, Search, FileText, User, Menu, MessageSquare, LogOut, Newspaper, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import desktopLogo from "@/assets/Main header Desktop.png";
import mobileLogo from "@/assets/HEADER MOBILE.png";

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
    { icon: Search, label: "Find My Res", path: "/find-my-res" },
    { icon: ShoppingBag, label: "Marketplace", path: "/marketplace" },
    { icon: FileText, label: "Applications", path: "/dashboard/applications" },
    { icon: User, label: "Profile", path: "/dashboard/profile" },
    { icon: MessageSquare, label: "Messages", path: "/dashboard/messages" },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await signOut();
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
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
                    ? "bg-gradient-primary text-primary-foreground shadow-glow" 
                    : "text-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t">
        <Button 
          variant="ghost" 
          className="w-full justify-start" 
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r bg-card">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden border-b bg-card p-4 flex items-center justify-between">
          <div className="flex items-center">
            <img src={mobileLogo} alt="ResKonnect" className="h-8 w-auto" />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <SidebarContent />
            </SheetContent>
          </Sheet>
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
