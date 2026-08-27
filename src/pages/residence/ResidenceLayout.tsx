import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Bell, Boxes, Building2, ExternalLink, Home, Inbox, LogOut, Menu, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { resolveResidencePortalAccount } from "@/lib/residencePortal";
import { RESIDENCE_ATTENTION_STATUSES } from "@/lib/residenceApplications";
import { toast } from "sonner";

export interface ResidencePortalContext { residence: { id: string; name: string } | null; }

const navItems = [
  { icon: Home, label: "Overview", path: "/residence", match: (path: string) => path === "/residence" },
  { icon: Inbox, label: "Applications", path: "/residence/inbox", match: (path: string) => path.startsWith("/residence/inbox") || path.startsWith("/residence/application/") },
  { icon: Target, label: "Lead CRM", path: "/residence/crm", match: (path: string) => path.startsWith("/residence/crm") },
  { icon: Boxes, label: "Inventory & Pricing", path: "/residence/inventory", match: (path: string) => path.startsWith("/residence/inventory") },
  { icon: BarChart3, label: "Analytics", path: "/residence/analytics", match: (path: string) => path.startsWith("/residence/analytics") },
];

const ResidenceLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [residence, setResidence] = useState<ResidencePortalContext["residence"]>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let active = true;
    const loadResidence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const account = await resolveResidencePortalAccount(user);
        if (!account?.is_active) return;
        const { data, error } = await supabase.from("residences").select("id,name").eq("id", account.residence_id).single();
        if (error) throw error;
        if (active) setResidence(data);
      } catch (err) {
        console.error("Could not load residence portal context:", err);
        toast.error("Could not load your residence information.");
      }
    };
    void loadResidence();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!residence?.id) return;
    const loadAttentionCount = async () => {
      const { count, error } = await supabase.from("applications").select("id", { count: "exact", head: true }).eq("residence_id", residence.id).in("status", [...RESIDENCE_ATTENTION_STATUSES]);
      if (!error) setPendingCount(count || 0);
    };
    void loadAttentionCount();
    const channel = supabase.channel(`residence-applications-${residence.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `residence_id=eq.${residence.id}` }, loadAttentionCount)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [residence?.id]);

  const handleLogout = async () => { await supabase.auth.signOut(); toast.success("Signed out."); navigate("/residence/login", { replace: true }); };

  const NavContent = () => <div className="flex h-full flex-col">
    <div className="border-b p-5"><Link to="/residence" onClick={() => setIsOpen(false)} className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div><div className="min-w-0"><p className="font-black tracking-tight">ResKonnect</p><p className="text-xs text-muted-foreground">Landlord Portal 2.0</p></div></Link>{residence && <p className="mt-4 truncate rounded-lg bg-muted/70 px-3 py-2 text-sm font-semibold">{residence.name}</p>}</div>
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">{navItems.map((item) => { const active = item.match(location.pathname); return <Link key={item.path} to={item.path} onClick={() => setIsOpen(false)} className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><item.icon className="h-5 w-5" /><span>{item.label}</span>{item.label === "Applications" && pendingCount > 0 && <Badge variant={active ? "secondary" : "destructive"} className="ml-auto">{pendingCount}</Badge>}</Link>; })}</nav>
    <div className="space-y-1 border-t p-3">{residence && <Button asChild variant="ghost" className="w-full justify-start"><Link to={`/res/${residence.id}`} target="_blank"><ExternalLink className="mr-3 h-4 w-4" />View public listing</Link></Button>}<Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}><LogOut className="mr-3 h-4 w-4" />Sign out</Button></div>
  </div>;

  return <div className="flex min-h-screen bg-muted/20">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card lg:block"><NavContent /></aside>
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden"><div className="min-w-0"><p className="font-bold">Landlord Portal</p><p className="max-w-[190px] truncate text-xs text-muted-foreground">{residence?.name || "Loading residence..."}</p></div><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="relative" onClick={() => navigate("/residence/inbox?status=new")} aria-label="Applications needing attention"><Bell className="h-5 w-5" />{pendingCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{pendingCount > 9 ? "9+" : pendingCount}</span>}</Button><ThemeToggle /><Sheet open={isOpen} onOpenChange={setIsOpen}><SheetTrigger asChild><Button variant="outline" size="icon"><Menu className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="left" className="w-72 p-0"><NavContent /></SheetContent></Sheet></div></header>
    <main className="min-w-0 flex-1 lg:ml-64"><div className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b bg-background/90 px-6 backdrop-blur lg:flex"><div><p className="text-sm font-semibold">{residence?.name || "Loading residence..."}</p><p className="text-xs text-muted-foreground">Applications, 2027 reservations, leads, inventory, pricing and analytics.</p></div><div className="flex items-center gap-2"><Button variant="outline" className="relative" onClick={() => navigate("/residence/inbox?status=new")}><Inbox className="mr-2 h-4 w-4" />Applications{pendingCount > 0 && <Badge variant="destructive" className="ml-2">{pendingCount}</Badge>}</Button><ThemeToggle /></div></div><div className="p-4 pt-20 md:p-6 md:pt-20 lg:p-8"><Outlet context={{ residence }} /></div></main>
  </div>;
};

export default ResidenceLayout;
