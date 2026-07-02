import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home,
  Search,
  FileText,
  User,
  Bell,
  GraduationCap,
  Percent,
  Users,
  Calendar,
  Newspaper,
  MessageSquare,
  Heart,
  Settings,
  LogOut,
  Command,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string[];
  category: "navigation" | "action" | "quick";
}

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleNavigation = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    await signOut();
    setOpen(false);
  }, [signOut]);

  const navigationItems: QuickAction[] = [
    { id: "dashboard", label: "Dashboard", icon: Home, action: () => handleNavigation("/dashboard"), keywords: ["home", "main"], category: "navigation" },
    { id: "find-res", label: "Find My Res", icon: Search, action: () => handleNavigation("/findmyres"), keywords: ["search", "accommodation", "residence"], category: "navigation" },
    { id: "applications", label: "My Applications", icon: FileText, action: () => handleNavigation("/applications"), keywords: ["apply", "status", "track"], category: "navigation" },
    { id: "profile", label: "My Profile", icon: User, action: () => handleNavigation("/profile"), keywords: ["account", "settings", "details"], category: "navigation" },
    { id: "notifications", label: "Notifications", icon: Bell, action: () => handleNavigation("/dashboard/updates"), keywords: ["alerts", "updates", "messages"], category: "navigation" },
    { id: "favorites", label: "My Favorites", icon: Heart, action: () => handleNavigation("/favorites"), keywords: ["saved", "liked", "wishlist"], category: "navigation" },
    { id: "apply-hub", label: "Applications Hub", icon: FileText, action: () => handleNavigation("/apply"), keywords: ["tut", "nsfas", "tvet", "college", "university"], category: "navigation" },
    { id: "bursaries", label: "Bursaries", icon: GraduationCap, action: () => handleNavigation("/bursaries"), keywords: ["funding", "nsfas", "money", "scholarship"], category: "navigation" },
    { id: "discounts", label: "Student Discounts", icon: Percent, action: () => handleNavigation("/discounts"), keywords: ["deals", "offers", "save"], category: "navigation" },
    { id: "roommates", label: "Find Roommates", icon: Users, action: () => handleNavigation("/roommates"), keywords: ["sharing", "partner", "flatmate"], category: "navigation" },
    { id: "events", label: "Campus Events", icon: Calendar, action: () => handleNavigation("/events"), keywords: ["activities", "parties", "gatherings"], category: "navigation" },
    { id: "news", label: "Campus News", icon: Newspaper, action: () => handleNavigation("/campus-news"), keywords: ["articles", "updates", "blog"], category: "navigation" },
    { id: "messages", label: "Messages", icon: MessageSquare, action: () => handleNavigation("/messages"), keywords: ["chat", "inbox", "communication"], category: "navigation" },
  ];

  const quickActions: QuickAction[] = [
    { id: "quick-apply", label: "Quick Apply to Residence", icon: FileText, action: () => handleNavigation("/findmyres"), keywords: ["fast", "apply"], category: "quick" },
    { id: "quick-upload", label: "Upload Documents", icon: FileText, action: () => handleNavigation("/profile"), keywords: ["docs", "files"], category: "quick" },
    { id: "quick-nsfas", label: "NSFAS Residences", icon: GraduationCap, action: () => handleNavigation("/findmyres?nsfas=true"), keywords: ["funded"], category: "quick" },
  ];

  const actionItems: QuickAction[] = [
    { id: "logout", label: "Sign Out", icon: LogOut, action: handleLogout, keywords: ["exit", "leave"], category: "action" },
  ];

  return (
    <>
      {/* Keyboard shortcut hint */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 rounded-lg hover:bg-muted transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Quick search...</span>
        <Badge variant="outline" className="ml-2 text-[10px] px-1.5">
          <Command className="w-3 h-3 mr-0.5" />K
        </Badge>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Quick Actions">
            {quickActions.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={item.action}
                className="flex items-center gap-3 cursor-pointer"
              >
                <item.icon className="w-4 h-4 text-primary" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={item.action}
                className="flex items-center gap-3 cursor-pointer"
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Account">
            {actionItems.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={item.action}
                className="flex items-center gap-3 cursor-pointer"
              >
                <item.icon className="w-4 h-4 text-destructive" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default CommandPalette;
