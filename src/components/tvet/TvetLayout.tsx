import { useNavigate, useLocation, Link } from "react-router-dom";
import { Building2, Home, LogOut, LayoutDashboard, RefreshCw, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import SpecialistUserManual from "@/components/manuals/SpecialistUserManual";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

interface TvetLayoutProps { children: React.ReactNode; }
const navItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/tvet-dashboard" },
  { icon: GraduationCap, label: "TVET Hub", path: "/tvet-dashboard" },
];

const TvetSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const handleLogout = async () => { await signOut(); navigate("/"); };
  const handleRefresh = () => { toast.info("Refreshing data..."); window.location.reload(); };
  return <Sidebar collapsible="icon" className="h-dvh overflow-hidden"><SidebarHeader className="shrink-0 border-b p-4"><div className="flex items-center gap-2"><Building2 className="w-7 h-7 text-primary shrink-0" />{!collapsed && <div className="min-w-0"><span className="text-lg font-bold block leading-tight">ResKonnect</span><Badge variant="outline" className="text-[10px] mt-0.5">TVET Lead</Badge></div>}</div></SidebarHeader><SidebarContent className="min-h-0 overflow-y-auto"><SidebarGroup><SidebarGroupContent><SidebarMenu>{navItems.map((item) => { const isActive=location.pathname===item.path; return <SidebarMenuItem key={`${item.path}-${item.label}`}><SidebarMenuButton asChild isActive={isActive} tooltip={item.label}><Link to={item.path}><item.icon className="w-4 h-4"/><span>{item.label}</span></Link></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter className="shrink-0 border-t p-2 space-y-1"><SidebarMenu><SidebarMenuItem><SidebarMenuButton onClick={handleRefresh} tooltip="Refresh Data"><RefreshCw className="w-4 h-4"/><span>Refresh Data</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton onClick={() => navigate("/")} tooltip="Public Site"><Home className="w-4 h-4"/><span>View Public Site</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton onClick={handleLogout} tooltip="Logout" className="text-destructive hover:text-destructive"><LogOut className="w-4 h-4"/><span>Logout</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter></Sidebar>;
};

const TvetLayout = ({ children }: TvetLayoutProps) => <SidebarProvider><div className="min-h-screen flex w-full overflow-x-hidden"><TvetSidebar/><div className="flex-1 flex flex-col min-w-0"><header className="h-12 flex items-center justify-between border-b bg-card px-4 shrink-0 sticky top-0 z-40"><SidebarTrigger/><div className="flex items-center gap-2"><SpecialistUserManual title="TVET Lead User Manual" roleLabel="TVET Lead" basePath="/tvet-dashboard"/><ThemeToggle/></div></header><main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6 lg:p-8">{children}</main></div></div></SidebarProvider>;
export default TvetLayout;
