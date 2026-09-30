import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { recordMobileRuntime } from "@/lib/runtimeTelemetry";

export default function ConnectivityStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if (!navigator.onLine) void recordMobileRuntime("offline_boot", "connectivity.initial");
    const onOnline = () => {
      setOnline(true);
      toast.success("ResKonnect is back online");
      window.dispatchEvent(new Event("rk-reconnected"));
      void recordMobileRuntime("reconnected", "connectivity.online");
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[3000] flex min-h-10 items-center justify-center gap-2 bg-amber-500 px-4 pb-2 pt-[max(.5rem,env(safe-area-inset-top))] text-center text-xs font-bold text-slate-950 shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      You're offline. ResKonnect will keep your session and reconnect automatically; live account data may be unavailable until your connection returns.
    </div>
  );
}
