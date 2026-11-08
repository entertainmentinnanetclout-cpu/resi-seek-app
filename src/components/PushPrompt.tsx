import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isNativeShell, isPushSupported, pushPermission, subscribePushDetailed } from "@/lib/push";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const DISMISS_PREFIX = "rk_push_dismissed_at:";
const ELIGIBLE_PATHS = ["/", "/find", "/dashboard", "/profile", "/my-applications", "/applications", "/opportunities", "/wil"];

export default function PushPrompt() {
  const [show, setShow] = useState(false);
  const [busy,setBusy]=useState(false);
  const [problem,setProblem]=useState("");
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate=useNavigate();

  useEffect(() => {
    setShow(false);
    if (isLoading || isNativeShell() || !isPushSupported()) return;
    if (!ELIGIBLE_PATHS.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))) return;
    const permission=pushPermission();
    if(permission==="denied"||permission==="unsupported")return;

    const key = `${DISMISS_PREFIX}${user?.id||"visitor"}`;
    const dismissed = Number(localStorage.getItem(key) || 0);
    if (dismissed && Date.now() - dismissed < 7 * 86_400_000) return;
    let active=true;
    const timer = window.setTimeout(()=>{
      if(!user?.id||permission!=="granted"){if(active)setShow(true);return;}
      // Permission may have been granted on a previous attempt while the
      // VAPID key or subscription persistence failed. Offer retry.
      void navigator.serviceWorker.getRegistration("/").then(reg=>reg?.pushManager.getSubscription())
        .then(sub=>{if(active&&!sub)setShow(true);}).catch(()=>{if(active)setShow(true);});
    }, 6_000);
    return () => {active=false;window.clearTimeout(timer);};
  }, [isLoading, location.pathname, user?.id]);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(`${DISMISS_PREFIX}${user?.id||"visitor"}`, String(Date.now())); } catch {}
    setShow(false);
  };

  const enable = async () => {
    if(!user?.id){
      dismiss();
      navigate("/auth?returnTo="+encodeURIComponent(location.pathname+location.search));
      return;
    }
    if(busy)return;
    setBusy(true);setProblem("");
    const result=await subscribePushDetailed();
    setBusy(false);
    if(result.ok){toast.success("Notifications enabled");setShow(false);return;}
    setProblem(result.reason);
    toast.error(result.reason);
    // Do not dismiss after failure; users need a clear retry path.
  };

  return (
    <Card className="fixed bottom-4 right-4 z-50 max-w-sm border-primary/30 bg-card p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2"><Bell className="h-5 w-5 text-primary" /></div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold">Get account updates</h4>
          <p className="mt-1 text-xs text-muted-foreground">Sign in and allow browser notifications for application, residence and ResKonnect account updates. If you previously allowed access, you can finish the subscription here.</p>
          {problem&&<p role="alert" className="mt-2 text-xs text-amber-700 dark:text-amber-400">{problem}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void enable()} disabled={busy}>{!user?.id?"Sign in to enable":busy?"Enabling…":pushPermission()==="granted"?"Finish setup":"Enable"}</Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
          </div>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss notification prompt"><X className="h-4 w-4" /></button>
      </div>
    </Card>
  );
}
