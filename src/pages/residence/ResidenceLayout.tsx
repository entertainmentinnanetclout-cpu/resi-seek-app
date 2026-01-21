import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { 
  Building2, Home, Inbox, BarChart3, LogOut, Menu, Bell, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ResidenceInfo {
  id: string;
  name: string;
}

const navItems = [
  { icon: Home, label: "Dashboard", path: "/residence" },
  { icon: Inbox, label: "Applications", path: "/residence/inbox" },
  { icon: BarChart3, label: "Analytics", path: "/residence/analytics" },
];

const ResidenceLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [residence, setResidence] = useState<ResidenceInfo | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchResidenceInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get residence portal account
      const { data: portalAccount } = await supabase
        .from('residence_portal_accounts')
        .select('residence_id')
        .eq('user_id', user.id)
        .single();

      if (portalAccount) {
        // Get residence details
        const { data: residenceData } = await supabase
          .from('residences')
          .select('id, name')
          .eq('id', portalAccount.residence_id)
          .single();

        if (residenceData) {
          setResidence(residenceData);

          // Get pending applications count
          const { count } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('residence_id', residenceData.id)
            .in('status', ['new', 'submitted', 'ready_for_review']);

          setPendingCount(count || 0);
        }
      }
    };

    fetchResidenceInfo();

    // Subscribe to application changes
    const channel = supabase
      .channel('residence-applications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        () => fetchResidenceInfo()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate("/residence/login");
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-8 h-8 text-primary" />
          <span className="text-xl font-bold">ResKonnect</span>
        </div>
        <p className="text-sm text-muted-foreground">Residence Portal</p>
        {residence && (
          <p className="text-sm font-medium mt-2 truncate">{residence.name}</p>
        )}
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
            {item.label === "Applications" && pendingCount > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {pendingCount}
              </Badge>
            )}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t space-y-2">
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
          <span className="font-bold">Residence Portal</span>
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
        <div className="hidden lg:flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span>{residence?.name || 'Loading...'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <div className="pt-16 lg:pt-0 p-4 md:p-6 lg:p-8">
          <Outlet context={{ residence }} />
        </div>
      </main>
    </div>
  );
};

export default ResidenceLayout;
