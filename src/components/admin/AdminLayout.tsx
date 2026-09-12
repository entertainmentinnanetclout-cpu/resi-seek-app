import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, BriefcaseBusiness, Building2, Cpu, Handshake, Home, Landmark, LayoutDashboard,
  LogOut, Megaphone, MessageCircle, RefreshCw, Settings2, UsersRound
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import DashboardUserManual from "@/components/manuals/DashboardUserManual";
import AdminOSCommandBar from "@/components/admin/AdminOSCommandBar";
import AdminAccessControl from "@/components/admin/AdminAccessControl";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth, StaffRole } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { BRAND } from "@/constants/brand";
import { ADMIN_DEPARTMENTS, AdminDepartmentKey } from "@/lib/adminDepartments";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar
} from "@/components/ui/sidebar";

interface AdminLayoutProps { children: React.ReactNode; }

const iconByDepartment: Record<AdminDepartmentKey, any> = {
  executive: LayoutDashboard,
  accommodation: Building2,
  student_opportunities: UsersRound,
  marketing_corporate_affairs: Megaphone,
  partnerships_engagements: Handshake,
  communications_service: MessageCircle,
  operations: Settings2,
  finance_admin: Landmark,
  intelligence_analytics: BarChart3,
  technology_systems: Cpu,
};

const roleLabels:Record<string,string>={
  admin:"God Mode",super_admin:"Super Admin",developer:"Developer",owner:"Owner",
  operations_lead:"Operations Lead",commerce_lead:"Commerce Lead",growth_lead:"Growth Lead",
  system_operator:"System Operator",tvet_lead:"TVET Lead",support_agent:"Support Agent",
  department_staff:"Department Staff"
};

const AdminSidebar=({
  staffRole,
  isGodMode,
  departments,
}:{staffRole:StaffRole|null;isGodMode:boolean;departments:AdminDepartmentKey[]})=>{
  const navigate=useNavigate();
  const location=useLocation();
  const {state}=useSidebar();
  const collapsed=state==="collapsed";
  const visibleDepartments=ADMIN_DEPARTMENTS.filter((department)=>isGodMode||departments.includes(department.key));

  const handleLogout=async()=>{await supabase.auth.signOut();navigate("/");};
  const handleRefresh=()=>{toast.info("Refreshing live administration data…");window.location.reload();};

  return <Sidebar collapsible="icon" className="h-dvh overflow-hidden">
    <SidebarHeader className="shrink-0 border-b p-4">
      <div className="flex items-center gap-2">
        <img src={BRAND.logos.icon} alt={BRAND.name} className="h-8 w-8 shrink-0 object-contain"/>
        {!collapsed&&<div className="min-w-0">
          <img src={BRAND.logos.full} alt={BRAND.name} className="h-6 w-auto object-contain"/>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[9px]">{roleLabels[staffRole||"department_staff"]||"Department Staff"}</Badge>
            <Badge variant="secondary" className="text-[9px]">{isGodMode?"All offices":`${visibleDepartments.length} office${visibleDepartments.length===1?"":"s"}`}</Badge>
          </div>
        </div>}
      </div>
    </SidebarHeader>

    <SidebarContent className="min-h-0 overflow-y-auto overscroll-contain">
      <SidebarGroup>
        {!collapsed&&<SidebarGroupLabel>Departments & Offices</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {visibleDepartments.map((department)=>{
              const Icon=iconByDepartment[department.key];
              const isActive=location.pathname===department.path
                || (department.key==="executive"&&location.pathname==="/admin")
                || (department.key==="accommodation"&&location.pathname==="/admin/operations")
                || (department.key==="intelligence_analytics"&&location.pathname==="/admin/analytics");
              return <SidebarMenuItem key={department.key}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={department.label}>
                  <Link to={department.path}><Icon className="h-4 w-4"/><span>{department.shortLabel}</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>;
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter className="shrink-0 space-y-1 border-t bg-sidebar p-2">
      <SidebarMenu>
        <SidebarMenuItem><SidebarMenuButton onClick={handleRefresh} tooltip="Refresh Data"><RefreshCw className="h-4 w-4"/><span>Refresh Data</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton onClick={()=>navigate("/")} tooltip="Public Site"><Home className="h-4 w-4"/><span>View Public Site</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton onClick={handleLogout} tooltip="Logout" className="text-destructive hover:text-destructive"><LogOut className="h-4 w-4"/><span>Logout</span></SidebarMenuButton></SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>;
};

const AdminLayout=({children}:AdminLayoutProps)=>{
  const {staffRole,isGodMode,adminDepartments}=useAuth();
  return <SidebarProvider>
    <div className="flex min-h-screen min-w-0 w-full overflow-x-hidden">
      <AdminSidebar staffRole={staffRole} isGodMode={isGodMode} departments={adminDepartments}/>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-card/95 px-3 backdrop-blur-xl sm:px-4">
          <SidebarTrigger/>
          <div className="flex min-w-0 flex-1 justify-center"><AdminOSCommandBar/></div>
          <div className="flex shrink-0 items-center gap-2">
            {isGodMode&&<AdminAccessControl/>}
            <DashboardUserManual role="admin" inline/>
            <ThemeToggle/>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-8">{children}</main>
      </div>
      <div className="md:hidden"><DashboardUserManual role="admin"/></div>
    </div>
  </SidebarProvider>;
};

export default AdminLayout;
