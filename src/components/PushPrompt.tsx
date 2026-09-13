import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isNativeShell, isPushSupported, pushPermission, subscribePush } from "@/lib/push";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const DISMISS_PREFIX = "rk_push_dismissed_at:";
const ELIGIBLE_PATHS = ["/dashboard", "/profile", "/my-applications", "/applications", "/opportunities", "/wil"];

export default function PushPrompt() {
  const [show, setShow] = useState(false);
  const { user, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setShow(false);
    if (isLoading || !user?.id || isNativeShell() || !isPushSupported()) return;
    if (pushPermission() !== "default") return;
    if (!ELIGIBLE_PATHS.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))) return;

    const key = `${DISMISS_PREFIX}${user.id}`;
    const dismissed = Number(localStorage.getItem(key) || 0);
    if (dismissed && Date.now() - dismissed < 7 * 86_400_000) return;

    const timer = window.setTimeout(() => setShow(true), 6_000);
    return () => window.clearTimeout(timer);
  }, [isLoading, location.pathname, user?.id]);

  if (!show || !user?.id) return null;

  const dismiss = () => {
    try { localStorage.setItem(`${DISMISS_PREFIX}${user.id}`, String(Date.now())); } catch {}
    setShow(false);
  };

  const enable = async () => {
    const ok = await subscribePush();
    if (ok) {
      toast.success("Notifications enabled");
      setShow(false);
      return;
    }
    toast.error("Notifications could not be enabled right now. Your account and app remain available.");
    dismiss();
  };

  return (
    <Card className="fixed bottom-4 right-4 z-50 max-w-sm border-primary/30 bg-card p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2"><Bell className="h-5 w-5 text-primary" /></div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold">Get account updates</h4>
          <p className="mt-1 text-xs text-muted-foreground">Allow browser notifications for important application and ResKonnect account updates.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void enable()}>Enable</Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
          </div>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss notification prompt"><X className="h-4 w-4" /></button>
      </div>
    </Card>
  );
}
