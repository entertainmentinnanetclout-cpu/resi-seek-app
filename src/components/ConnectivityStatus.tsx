import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { recordMobileRuntime } from "@/lib/runtimeTelemetry";

type ConnectivityMode = "online" | "offline" | "degraded";

export default function ConnectivityStatus() {
  const [mode, setMode] = useState<ConnectivityMode>(() => navigator.onLine ? "online" : "offline");

  useEffect(() => {
    if (!navigator.onLine) void recordMobileRuntime("offline_boot", "connectivity.initial");

    const onOnline = () => {
      setMode("online");
      toast.success("ResKonnect is back online");
      window.dispatchEvent(new Event("rk-reconnected"));
      void recordMobileRuntime("reconnected", "connectivity.online");
    };
    const onOffline = () => setMode("offline");
    const onDegraded = () => {
      if (navigator.onLine) setMode("degraded");
    };
    const onRecovered = () => {
      if (navigator.onLine) {
        setMode("online");
        window.dispatchEvent(new Event("rk-reconnected"));
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("rk-network-degraded", onDegraded as EventListener);
    window.addEventListener("rk-network-recovered", onRecovered as EventListener);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("rk-network-degraded", onDegraded as EventListener);
      window.removeEventListener("rk-network-recovered", onRecovered as EventListener);
    };
  }, []);

  if (mode === "online") return null;

  const offline = mode === "offline";
  const retry = () => {
    window.dispatchEvent(new Event("rk-reconnected"));
    toast.message(offline ? "Waiting for a network connection…" : "Retrying live ResKonnect data…");
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[3000] flex min-h-10 items-center justify-center gap-2 bg-amber-500 px-3 pb-2 pt-[max(.5rem,env(safe-area-inset-top))] text-center text-xs font-bold text-slate-950 shadow-lg"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        {offline
          ? "You're offline. Your session is kept safely; live account data will return when the connection does."
          : "Your connection is slow or unstable. Live requests will time out safely instead of loading forever."}
      </span>
      <button
        type="button"
        onClick={retry}
        className="ml-1 inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-slate-950/25 bg-white/35 px-2.5 py-1 font-black hover:bg-white/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}
