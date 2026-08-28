import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Home, LogOut, RefreshCw, Building2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import SpecialistUserManual from "@/components/manuals/SpecialistUserManual";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

export interface SpecialistNavItem { value: string; label: string; icon: React.ComponentType<{ className?: string }>; }
interface SpecialistLayoutProps { title: string; roleLabel: string; basePath: string; navItems: SpecialistNavItem[]; defaultTab: string; children: React.ReactNode; }

const SpecialistSidebar = ({ title, roleLabel, basePath, navItems, defaultTab }: Omit<SpecialistLayoutProps, "children">) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const activeTab = searchParams.get("tab") || defaultTab;
  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-4"><div className="flex items-center gap-2"><Building2 className="w-7 h-7 text-primary shrink-0" />{!collapsed && <div className="min-w-0"><span className="text-lg font-bold block leading-tight">ResKonnect</span><Badge variant="outline" className="text-[10px] mt-0.5">{roleLabel}</Badge></div>}</div></SidebarHeader>
      <SidebarContent><SidebarGroup><SidebarGroupContent><SidebarMenu>{navItems.map((item) => { const isActive = location.pathname === basePath && activeTab === item.value; return <SidebarMenuItem key={item.value}><SidebarMenuButton isActive={isActive} tooltip={item.label} onClick={() => { if (location.pathname !== basePath) navigate(`${basePath}?tab=${item.value}`); else setSearchParams({ tab: item.value }); }}><item.icon className="w-4 h-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
      <SidebarFooter className="border-t p-2 space-y-1"><SidebarMenu><SidebarMenuItem><SidebarMenuButton onClick={() => { toast.info("Refreshing..."); window.location.reload(); }} tooltip="Refresh"><RefreshCw className="w-4 h-4" /><span>Refresh Data</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton onClick={() => navigate("/")} tooltip="Public Site"><Home className="w-4 h-4" /><span>View Public Site</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton onClick={handleLogout} tooltip="Logout" className="text-destructive hover:text-destructive"><LogOut className="w-4 h-4" /><span>Logout</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter>
    </Sidebar>
  );
};

const SpecialistLayout = ({ children, ...rest }: SpecialistLayoutProps) => (
  <SidebarProvider><div className="min-h-screen flex w-full"><SpecialistSidebar {...rest} /><div className="flex-1 flex flex-col min-w-0"><header className="h-12 flex items-center justify-between border-b bg-card px-4 shrink-0 sticky top-0 z-40"><SidebarTrigger /><div className="flex items-center gap-2"><span className="text-sm font-medium hidden sm:inline">{rest.title}</span><SpecialistUserManual title={`${rest.roleLabel} User Manual`} roleLabel={rest.roleLabel} basePath={rest.basePath}/><ThemeToggle /></div></header><main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main></div></div></SidebarProvider>
);

export default SpecialistLayout;
