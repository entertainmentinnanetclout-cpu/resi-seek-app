import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Building2, Users, FileText, Home, Settings, LogOut, Menu, Image, Percent, GraduationCap, Newspaper, Calendar, ShoppingBag, LayoutDashboard, RefreshCw, Activity, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/admin" },
  { icon: TrendingUp, label: "Analytics", path: "/admin/analytics" },
  { icon: Building2, label: "Residences", path: "/admin/residences" },
  { icon: FileText, label: "Applications", path: "/admin/applications" },
  { icon: FileText, label: "Documents", path: "/admin/documents" },
  { icon: Users, label: "Users", path: "/admin/users" },
  { icon: ShoppingBag, label: "Marketplace", path: "/admin/marketplace" },
  { icon: Image, label: "Hero Slides", path: "/admin/slides" },
  { icon: GraduationCap, label: "Bursaries", path: "/admin/bursaries" },
  { icon: Percent, label: "Discounts", path: "/admin/discounts" },
  { icon: Calendar, label: "Events", path: "/admin/events" },
  { icon: Newspaper, label: "News", path: "/admin/news" },
  { icon: Activity, label: "System Status", path: "/admin/system-status" },
  { icon: Settings, label: "Settings", path: "/admin/settings" },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleRefresh = () => {
    toast.info("Refreshing data...");
    window.location.reload();
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-8 h-8 text-primary" />
          <span className="text-xl font-bold">ResKonnect</span>
        </div>
        <p className="text-sm text-muted-foreground">Admin Dashboard</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              location.pathname === item.path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t space-y-2">
        <Button 
          variant="outline" 
          className="w-full justify-start"
          onClick={handleRefresh}
        >
          <RefreshCw className="w-5 h-5 mr-3" />
          Refresh Data
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start"
          onClick={() => navigate("/")}
        >
          <Home className="w-5 h-5 mr-3" />
          View Public Site
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-destructive hover:text-destructive"
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
      <aside className="hidden lg:block w-64 border-r bg-card fixed h-full">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" />
          <span className="font-bold">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64">
        <div className="hidden lg:flex items-center justify-end p-4 border-b bg-card">
          <ThemeToggle />
        </div>
        <div className="pt-16 lg:pt-0 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
