import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function ConnectivityBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[2200] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-xs font-bold text-slate-950 shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      You are offline. Cached ResKonnect screens remain available; live applications, maps and updates will reconnect automatically.
    </div>
  );
}
