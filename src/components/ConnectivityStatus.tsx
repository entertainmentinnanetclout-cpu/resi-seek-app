import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export default function ConnectivityStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      toast.success("ResKonnect is back online");
      window.dispatchEvent(new Event("rk-reconnected"));
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
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[3000] flex min-h-10 items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-xs font-bold text-slate-950 shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      You're offline. ResKonnect will keep your session and reconnect automatically; live account data may be unavailable until your connection returns.
    </div>
  );
}
