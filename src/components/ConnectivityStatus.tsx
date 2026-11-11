import { useEffect, useState } from "react";
import { RefreshCw, WifiOff, ServerOff } from "lucide-react";
import { toast } from "sonner";
import { recordMobileRuntime } from "@/lib/runtimeTelemetry";

type ConnectivityMode = "online" | "offline" | "degraded" | "auth-service";

export default function ConnectivityStatus() {
  const [mode, setMode] = useState<ConnectivityMode>(() => navigator.onLine ? "online" : "offline");

  useEffect(() => {
    if (!navigator.onLine) void recordMobileRuntime("offline_boot", "connectivity.initial");

    const onOnline = () => {
      setMode((current) => current === "auth-service" ? current : "online");
      toast.success("ResKonnect is back online");
      window.dispatchEvent(new Event("rk-reconnected"));
      void recordMobileRuntime("reconnected", "connectivity.online");
    };
    const onOffline = () => setMode("offline");
    const onDegraded = () => {
      if (navigator.onLine) setMode((current) => current === "auth-service" ? current : "degraded");
    };
    const onRecovered = () => {
      if (navigator.onLine) {
        setMode((current) => current === "auth-service" ? current : "online");
        window.dispatchEvent(new Event("rk-reconnected"));
      }
    };

    const onAuthServiceDown = () => {
      if (navigator.onLine) setMode("auth-service");
    };
    const onAuthServiceRecovered = () => {
      if (navigator.onLine) setMode((current) => current === "auth-service" ? "online" : current);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("rk-network-degraded", onDegraded as EventListener);
    window.addEventListener("rk-network-recovered", onRecovered as EventListener);
    window.addEventListener("rk-auth-service-degraded", onAuthServiceDown as EventListener);
    window.addEventListener("rk-auth-service-recovered", onAuthServiceRecovered as EventListener);
    // Used by the responsive browser gate to avoid racing a simulated offline event with hydration.
    document.documentElement.dataset.rkConnectivityReady = "true";
    return () => {
      delete document.documentElement.dataset.rkConnectivityReady;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("rk-network-degraded", onDegraded as EventListener);
      window.removeEventListener("rk-network-recovered", onRecovered as EventListener);
      window.removeEventListener("rk-auth-service-degraded", onAuthServiceDown as EventListener);
      window.removeEventListener("rk-auth-service-recovered", onAuthServiceRecovered as EventListener);
    };
  }, []);

  if (mode === "online") return null;

  const offline = mode === "offline";
  const authUnavailable = mode === "auth-service";
  const retry = () => {
    window.dispatchEvent(new Event("rk-reconnected"));
    toast.message(offline ? "Waiting for a network connection…" : authUnavailable ? "Rechecking live services. Sign-in still requires the authentication server." : "Retrying live ResKonnect data…");
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[3000] flex min-h-10 items-center justify-center gap-2 bg-amber-500 px-3 pb-2 pt-[max(.5rem,env(safe-area-inset-top))] text-center text-xs font-bold text-slate-950 shadow-lg"
    >
      {authUnavailable ? <ServerOff className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
      <span>
        {offline
          ? "You're offline. Your session is kept safely; live account data will return when the connection does."
          : authUnavailable
            ? "ResKonnect sign-in is temporarily unavailable on the server. Your connection may be fine; do not reset your password."
            : "ResKonnect's live service is not responding. Check your connection and retry; your existing session is preserved where possible."}
      </span>
      <button
        type="button"
        onClick={retry}
        className="ml-1 inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-slate-950/25 bg-white/35 px-2.5 py-1 font-black hover:bg-white/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry connection
      </button>
    </div>
  );
}
