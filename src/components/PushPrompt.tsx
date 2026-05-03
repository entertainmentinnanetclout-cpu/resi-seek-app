import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isPushSupported, pushPermission, subscribePush, ensureServiceWorker } from "@/lib/push";
import { toast } from "sonner";

const DISMISS_KEY = "rk_push_dismissed_at";

export default function PushPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    ensureServiceWorker();
    if (!isPushSupported()) return;
    if (pushPermission() !== "default") return;
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    // re-show after 7 days
    if (dismissed && Date.now() - dismissed < 7 * 86400 * 1000) return;
    const t = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const enable = async () => {
    const ok = await subscribePush();
    if (ok) {
      toast.success("Notifications enabled");
      setShow(false);
    } else {
      toast.error("Could not enable notifications");
      dismiss();
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 z-50 p-4 max-w-sm shadow-lg border-primary/30 bg-card">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2"><Bell className="w-5 h-5 text-primary" /></div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">Get notified</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Allow notifications for application updates, order status, deals and bursaries.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={enable}>Enable</Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
          </div>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
    </Card>
  );
}