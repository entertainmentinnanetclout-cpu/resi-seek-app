import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Building2, Home, LogOut, Menu, LayoutDashboard, RefreshCw, TrendingUp, Boxes, ShoppingCart, Film, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth, StaffRole } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const allNavItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/admin", roles: ["admin", "operations_lead", "commerce_lead", "growth_lead", "system_operator", "support_agent"] },
  { icon: TrendingUp, label: "Analytics", path: "/admin/analytics", roles: ["admin", "growth_lead", "system_operator"] },
  { icon: Boxes, label: "Operations Hub", path: "/admin/operations", roles: ["admin", "operations_lead", "support_agent"] },
  { icon: ShoppingCart, label: "Commerce Hub", path: "/admin/commerce", roles: ["admin", "commerce_lead", "support_agent"] },
  { icon: Film, label: "Media Hub", path: "/admin/media", roles: ["admin", "growth_lead"] },
  { icon: Cpu, label: "System Hub", path: "/admin/system", roles: ["admin", "system_operator"] },
];

const roleLabels: Record<string, string> = {
  admin: "God Mode",
  operations_lead: "Operations Lead",
  commerce_lead: "Commerce Lead",
  growth_lead: "Growth Lead",
  system_operator: "System Operator",
  support_agent: "Support Agent",
};

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { staffRole } = useAuth();

  const navItems = allNavItems.filter(
    (item) => staffRole && item.roles.includes(staffRole)
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleRefresh = () => {
    toast.info("Refreshing data...");
    window.location.reload();
  };

  const NavLink = ({ item, onClick }: { item: typeof allNavItems[0]; onClick?: () => void }) => (
    <Link
      to={item.path}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
        location.pathname === item.path
          ? "bg-primary text-primary-foreground"
          : "hover:bg-secondary text-muted-foreground hover:text-foreground"
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      {item.label}
    </Link>
  );

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-8 h-8 text-primary" />
          <span className="text-xl font-bold">ResKonnect</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {roleLabels[staffRole || "admin"]}
          </Badge>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.path} item={item} onClick={() => setIsOpen(false)} />
        ))}
      </nav>

      <div className="p-4 border-t space-y-2">
        <Button variant="outline" className="w-full justify-start" onClick={handleRefresh}>
          <RefreshCw className="w-5 h-5 mr-3" />
          Refresh Data
        </Button>
        <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/")}>
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
      <aside className="hidden lg:block w-64 border-r bg-card fixed h-full">
        <NavContent />
      </aside>

      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" />
          <span className="font-bold">Admin</span>
          <Badge variant="outline" className="text-xs ml-1">
            {roleLabels[staffRole || "admin"]}
          </Badge>
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
