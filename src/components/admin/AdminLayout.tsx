import { useNavigate, useLocation, Link } from "react-router-dom";
import { Building2, Home, LogOut, Menu, LayoutDashboard, RefreshCw, TrendingUp, ShoppingCart, Film, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth, StaffRole } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const allNavItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/admin", roles: ["admin", "operations_lead", "commerce_lead", "growth_lead", "system_operator", "support_agent"] },
  { icon: TrendingUp, label: "Analytics", path: "/admin/analytics", roles: ["admin", "growth_lead", "system_operator"] },
  { icon: Building2, label: "Accommodation Hub", path: "/admin/operations", roles: ["admin", "operations_lead", "support_agent"] },
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

const AdminSidebar = ({ staffRole }: { staffRole: StaffRole | null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-7 h-7 text-primary shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-lg font-bold block leading-tight">ResKonnect</span>
              <Badge variant="outline" className="text-[10px] mt-0.5">
                {roleLabels[staffRole || "admin"]}
              </Badge>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link to={item.path}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2 space-y-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleRefresh} tooltip="Refresh Data">
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Data</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => navigate("/")} tooltip="Public Site">
              <Home className="w-4 h-4" />
              <span>View Public Site</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Logout"
              className="text-destructive hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { staffRole } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar staffRole={staffRole} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b bg-card px-4 shrink-0 sticky top-0 z-40">
            <SidebarTrigger />
            <ThemeToggle />
          </header>

          <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
