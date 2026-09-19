import { useEffect, useState } from "react";
import { BellRing, BellOff, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { isNativeApp } from "@/lib/accountRouting";
import { disableForegroundAlerts, enableForegroundAlerts, foregroundAlertsEnabled } from "@/lib/nativeNotifications";

/** Foreground local device alerts are opt-in; background push needs a configured FCM transport. */
export default function NativeAlertSettings() {
  const { user } = useAuth();
  const id = user?.id || "";
  const [enabled, setEnabled] = useState(() => Boolean(id && foregroundAlertsEnabled(id)));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setEnabled(Boolean(id && foregroundAlertsEnabled(id))); }, [id]);
  if (!isNativeApp() || !id) return null;
  const toggle = async () => {
    if (enabled) { disableForegroundAlerts(id); setEnabled(false); toast.success("On-device alerts paused"); return; }
    setBusy(true);
    const ok = await enableForegroundAlerts(id);
    setBusy(false);
    setEnabled(ok);
    if (!ok) toast.error("Allow notifications for ResKonnect in Android App settings, then try again.");
    else toast.success("On-device alerts enabled while ResKonnect is open");
  };
  return <section className="rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-card to-violet-500/10 p-4 sm:p-6">
    <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><BellRing className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 className="font-black">Android device alerts</h2><p className="mt-1 text-sm text-muted-foreground">Choose whether ResKonnect can display a phone notification for new account updates while the app is open.</p></div></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-bold text-muted-foreground">{enabled ? "On-device alerts enabled" : "On-device alerts disabled"}</span><Button type="button" variant={enabled ? "outline" : "default"} disabled={busy} onClick={() => void toggle()}>{enabled ? <BellOff className="mr-2 h-4 w-4" /> : <BellRing className="mr-2 h-4 w-4" />}{busy ? "Requesting permission…" : enabled ? "Turn off" : "Enable alerts"}</Button></div>
    <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" />Background and closed-app alerts require Firebase Cloud Messaging configuration and are not implied by this setting. Your complete message always stays in the in-app inbox.</p>
  </section>;
}
