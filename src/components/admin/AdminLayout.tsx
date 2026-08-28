import { useNavigate, useLocation, Link } from "react-router-dom";
import { BarChart3, Building2, Home, LogOut, LayoutDashboard, RefreshCw, TrendingUp, ShoppingCart, Film, Cpu, GraduationCap, Users, ClipboardCheck, Handshake } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import DashboardUserManual from "@/components/manuals/DashboardUserManual";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth, StaffRole } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { GOD_MODE_ROLES } from "@/lib/constants/roles";
import { BRAND } from "@/constants/brand";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

interface AdminLayoutProps { children: React.ReactNode; }
const allNavItems=[
  {icon:LayoutDashboard,label:"Overview",path:"/admin",roles:GOD_MODE_ROLES},
  {icon:BarChart3,label:"Growth Command",path:"/admin/growth",roles:GOD_MODE_ROLES},
  {icon:Handshake,label:"Partnership God Mode",path:"/admin/partnerships",roles:GOD_MODE_ROLES},
  {icon:TrendingUp,label:"Analytics",path:"/admin/analytics",roles:GOD_MODE_ROLES},
  {icon:Building2,label:"Accommodation Hub",path:"/admin/operations",roles:GOD_MODE_ROLES},
  {icon:ClipboardCheck,label:"Applications Hub",path:"/admin/application-hub",roles:GOD_MODE_ROLES},
  {icon:Users,label:"Onboarding Hub",path:"/admin/onboarding",roles:GOD_MODE_ROLES},
  {icon:GraduationCap,label:"TVET Hub",path:"/admin/tvet",roles:GOD_MODE_ROLES},
  {icon:ShoppingCart,label:"Commerce Hub",path:"/admin/commerce",roles:GOD_MODE_ROLES},
  {icon:Film,label:"Media Hub",path:"/admin/media",roles:GOD_MODE_ROLES},
  {icon:Cpu,label:"System Hub",path:"/admin/system",roles:GOD_MODE_ROLES},
];
const roleLabels:Record<string,string>={admin:"God Mode",super_admin:"Super Admin",developer:"Developer",owner:"Owner",operations_lead:"Operations Lead",commerce_lead:"Commerce Lead",growth_lead:"Growth Lead",system_operator:"System Operator",tvet_lead:"TVET Lead",support_agent:"Support Agent"};

const AdminSidebar=({staffRole}:{staffRole:StaffRole|null})=>{
  const navigate=useNavigate();const location=useLocation();const {state}=useSidebar();const collapsed=state==="collapsed";const navItems=allNavItems.filter((item)=>staffRole&&(item.roles as readonly string[]).includes(staffRole));
  const handleLogout=async()=>{await supabase.auth.signOut();navigate("/");};
  const handleRefresh=()=>{toast.info("Refreshing data...");window.location.reload();};
  return <Sidebar collapsible="icon" className="h-dvh overflow-hidden"><SidebarHeader className="shrink-0 border-b p-4"><div className="flex items-center gap-2"><img src={BRAND.logos.icon} alt={BRAND.name} className="h-8 w-8 shrink-0 object-contain"/>{!collapsed&&<div className="min-w-0"><img src={BRAND.logos.full} alt={BRAND.name} className="h-6 w-auto object-contain"/><Badge variant="outline" className="mt-1 text-[10px]">{roleLabels[staffRole||"admin"]}</Badge></div>}</div></SidebarHeader><SidebarContent className="min-h-0 overflow-y-auto overscroll-contain"><SidebarGroup><SidebarGroupContent><SidebarMenu>{navItems.map((item)=>{const isActive=location.pathname===item.path;return <SidebarMenuItem key={item.path}><SidebarMenuButton asChild isActive={isActive} tooltip={item.label}><Link to={item.path}><item.icon className="h-4 w-4"/><span>{item.label}</span></Link></SidebarMenuButton></SidebarMenuItem>;})}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter className="shrink-0 space-y-1 border-t bg-sidebar p-2"><SidebarMenu><SidebarMenuItem><SidebarMenuButton onClick={handleRefresh} tooltip="Refresh Data"><RefreshCw className="h-4 w-4"/><span>Refresh Data</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton onClick={()=>navigate("/")} tooltip="Public Site"><Home className="h-4 w-4"/><span>View Public Site</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton onClick={handleLogout} tooltip="Logout" className="text-destructive hover:text-destructive"><LogOut className="h-4 w-4"/><span>Logout</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter></Sidebar>;
};

const AdminLayout=({children}:AdminLayoutProps)=>{const {staffRole,isGodMode}=useAuth();const navigate=useNavigate();if(!isGodMode&&staffRole){console.warn(`[AdminLayout] Scoped staff role ${staffRole} detected in AdminLayout. Redirecting...`);if(staffRole==='tvet_lead')navigate('/tvet-dashboard');else navigate('/dashboard');return null;}return <SidebarProvider><div className="flex min-h-screen min-w-0 w-full overflow-x-hidden"><AdminSidebar staffRole={staffRole}/><div className="flex min-w-0 flex-1 flex-col"><header className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-between border-b bg-card px-3 sm:px-4"><SidebarTrigger/><div className="flex items-center gap-2"><DashboardUserManual role="admin" inline/><ThemeToggle/></div></header><main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-8">{children}</main></div><div className="md:hidden"><DashboardUserManual role="admin"/></div></div></SidebarProvider>;};
export default AdminLayout;
