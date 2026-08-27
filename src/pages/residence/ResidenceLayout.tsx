import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Bell, Boxes, CalendarDays, ExternalLink, Home, Inbox, LogOut, Megaphone, Menu, Palette, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BRAND } from "@/constants/brand";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { resolveResidencePortalAccount } from "@/lib/residencePortal";
import { RESIDENCE_ATTENTION_STATUSES } from "@/lib/residenceApplications";
import { toast } from "sonner";

export interface ResidencePortalContext {
  residence: {
    id: string;
    name: string;
    cover_image_url?: string | null;
    image_url?: string | null;
    place_label?: string | null;
    reservations_2027_open?: boolean | null;
  } | null;
}

const navItems = [
  { icon: Home, label: "Overview", path: "/residence", match: (path: string) => path === "/residence" },
  { icon: CalendarDays, label: "2027 Reservations", path: "/residence/reservations-2027", match: (path: string) => path.startsWith("/residence/reservations-2027") },
  { icon: Palette, label: "Listing & Brand", path: "/residence/listing", match: (path: string) => path.startsWith("/residence/listing") },
  { icon: Boxes, label: "Inventory & Pricing", path: "/residence/inventory", match: (path: string) => path.startsWith("/residence/inventory") },
  { icon: Megaphone, label: "Recruitment Channel", path: "/residence/recruiters", match: (path: string) => path.startsWith("/residence/recruiters") },
  { icon: Inbox, label: "Applications", path: "/residence/inbox", match: (path: string) => path.startsWith("/residence/inbox") || path.startsWith("/residence/application/") },
  { icon: Target, label: "Lead CRM", path: "/residence/crm", match: (path: string) => path.startsWith("/residence/crm") },
  { icon: BarChart3, label: "Analytics", path: "/residence/analytics", match: (path: string) => path.startsWith("/residence/analytics") },
];

const ResidenceLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [residence, setResidence] = useState<ResidencePortalContext["residence"]>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [reservationCount, setReservationCount] = useState(0);

  useEffect(() => {
    let active = true;
    const loadResidence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const account = await resolveResidencePortalAccount(user);
        if (!account?.is_active) return;
        const { data, error } = await (supabase as any).from("residences")
          .select("id,name,cover_image_url,image_url,place_label,reservations_2027_open")
          .eq("id", account.residence_id).single();
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
    const loadCounts = async () => {
      const [apps, reservations] = await Promise.all([
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("residence_id", residence.id).in("status", [...RESIDENCE_ATTENTION_STATUSES]),
        (supabase as any).rpc("get_residence_portal_reservations", { p_residence_id: residence.id, p_year: 2027 }),
      ]);
      if (!apps.error) setPendingCount(apps.count || 0);
      if (!reservations.error) setReservationCount((reservations.data || []).filter((row: any) => row.status !== "cancelled").length);
    };
    void loadCounts();
    const interval = window.setInterval(() => void loadCounts(), 30_000);
    const channel = supabase.channel(`residence-portal-app-counts-${residence.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `residence_id=eq.${residence.id}` }, loadCounts)
      .subscribe();
    const onFocus = () => void loadCounts();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); void supabase.removeChannel(channel); };
  }, [residence?.id]);

  const handleLogout = async () => { await supabase.auth.signOut(); toast.success("Signed out."); navigate("/residence/login", { replace: true }); };
  const cover = residence?.cover_image_url || residence?.image_url;

  const NavContent = () => (
    <div className="flex h-[100dvh] min-h-0 w-full min-w-0 flex-col overflow-hidden bg-card">
      <div className="relative shrink-0 overflow-hidden border-b bg-[#071326] p-5 text-white">
        {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />}
        <div className="absolute inset-0 bg-gradient-to-br from-[#071326]/95 via-[#071326]/95 to-[#2563EB]/65" />
        <div className="relative z-10">
          <Link to="/residence" onClick={() => setIsOpen(false)} className="block rounded-2xl bg-white p-3 shadow-lg">
            <img src={BRAND.logos.full} alt={BRAND.name} className="h-10 w-auto max-w-[190px] object-contain object-left" />
          </Link>
          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F5B32F]">Landlord Portal · Property OS</p>
            <p className="mt-1 truncate text-lg font-black">{residence?.name || "Loading residence..."}</p>
            <p className="truncate text-xs text-white/65">{residence?.place_label || BRAND.tagline}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold">ResKonnect managed</span>
            {residence?.reservations_2027_open && <span className="rounded-full bg-[#F5B32F] px-2.5 py-1 text-[10px] font-black text-[#071326]">2027 OPEN</span>}
          </div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch]">
        {navItems.map((item) => {
          const active = item.match(location.pathname);
          const badge = item.label === "Applications" ? pendingCount : item.label === "2027 Reservations" ? reservationCount : 0;
          return (
            <Link key={item.path} to={item.path} onClick={() => setIsOpen(false)}
              className={cn("flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors", active ? "bg-[#071326] text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", active && "text-[#F5B32F]")} />
              <span className="min-w-0 truncate">{item.label}</span>
              {badge > 0 && <Badge className={cn("ml-auto shrink-0", active ? "bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]" : "bg-primary text-primary-foreground")}>{badge > 99 ? "99+" : badge}</Badge>}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-1 border-t bg-card p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        {residence && <Button asChild variant="ghost" className="w-full justify-start"><Link to={`/res/${residence.id}`} target="_blank"><ExternalLink className="mr-3 h-4 w-4" />View public listing</Link></Button>}
        <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}><LogOut className="mr-3 h-4 w-4" />Sign out</Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] w-full max-w-full min-w-0 overflow-x-hidden bg-muted/20">
      <aside className="fixed inset-y-0 left-0 z-40 hidden h-[100dvh] max-h-[100dvh] w-72 overflow-hidden border-r bg-card lg:block"><NavContent /></aside>
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 min-w-0 items-center justify-between gap-2 overflow-hidden border-b bg-[#071326] px-3 text-white shadow-md sm:px-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src={BRAND.logos.icon} alt={BRAND.name} className="h-9 w-9 shrink-0 rounded-lg bg-white p-1 object-contain" />
          <div className="min-w-0"><p className="truncate font-black">Property OS</p><p className="max-w-[130px] truncate text-xs text-white/65 sm:max-w-[220px]">{residence?.name || "Loading residence..."}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/residence/reservations-2027")} aria-label="2027 reservations"><CalendarDays className="h-5 w-5" />{reservationCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F5B32F] px-1 text-[10px] font-black text-[#071326]">{reservationCount > 9 ? "9+" : reservationCount}</span>}</Button>
          <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/residence/inbox?status=new")} aria-label="Applications needing attention"><Bell className="h-5 w-5" />{pendingCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{pendingCount > 9 ? "9+" : pendingCount}</span>}</Button>
          <ThemeToggle />
          <Sheet open={isOpen} onOpenChange={setIsOpen}><SheetTrigger asChild><Button variant="outline" size="icon" className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white" aria-label="Open residence navigation"><Menu className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="right" className="h-[100dvh] w-[min(92vw,20rem)] max-w-none overflow-hidden p-0"><NavContent /></SheetContent></Sheet>
        </div>
      </header>

      <main className="min-w-0 max-w-full flex-1 overflow-x-hidden lg:ml-72">
        <div className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur lg:flex">
          <div className="min-w-0"><p className="truncate text-sm font-black text-[#071326] dark:text-foreground">{residence?.name || "Loading residence..."}</p><p className="truncate text-xs text-muted-foreground">Listing quality, 2027 reservations, pricing, recruitment and conversion intelligence.</p></div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" className="relative" onClick={() => navigate("/residence/reservations-2027")}><CalendarDays className="mr-2 h-4 w-4" />2027 Reservations{reservationCount > 0 && <Badge className="ml-2 bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]">{reservationCount}</Badge>}</Button>
            <Button variant="outline" className="relative" onClick={() => navigate("/residence/inbox?status=new")}><Inbox className="mr-2 h-4 w-4" />Applications{pendingCount > 0 && <Badge variant="destructive" className="ml-2">{pendingCount}</Badge>}</Button>
            <ThemeToggle />
          </div>
        </div>
        <div className="min-w-0 max-w-full p-3 pt-20 sm:p-4 sm:pt-20 md:p-6 md:pt-20 lg:p-8"><Outlet context={{ residence }} /></div>
        <div className="border-t px-4 py-5 text-center text-[11px] text-muted-foreground lg:px-8">
          <span className="font-semibold text-foreground">{BRAND.name}</span> · {BRAND.descriptor} · Developed by Start To Up Innovations Group
        </div>
      </main>
    </div>
  );
};

export default ResidenceLayout;
