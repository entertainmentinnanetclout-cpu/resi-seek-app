import { useEffect, useMemo, useState } from "react";
import { Download, MonitorDown, Share2, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { isNativeApp } from "@/lib/accountRouting";
import { supabase } from "@/integrations/supabase/client";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "rk_pwa_install_dismissed_at_v1";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function detectPlatform() {
  const ua = navigator.userAgent;
  const iPadDesktopMode = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || iPadDesktopMode) return "ios";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  return "other";
}

function isSafari() {
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS/i.test(ua);
}

export default function InstallAppPrompt() {
  const { user } = useAuth();
  const location = useLocation();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  const platform = useMemo(() => detectPlatform(), []);
  const safari = useMemo(() => isSafari(), []);

  const track = (eventType: "pwa_install_prompt" | "pwa_install" | "pwa_install_dismissed", metadata: Record<string, unknown> = {}) => {
    void (supabase as any).from("growth_events").insert({
      user_id: user?.id || null,
      event_type: eventType,
      source: "web",
      entity_type: "pwa",
      metadata: {
        platform,
        route: location.pathname,
        standalone: isStandalone(),
        ...metadata,
      },
    }).then(() => undefined).catch(() => undefined);
  };

  useEffect(() => {
    if (isNativeApp() || isStandalone()) {
      setInstalled(true);
      return;
    }

    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissed && Date.now() - dismissed < DISMISS_MS) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      track("pwa_install", { method: "browser_install" });
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const timer = window.setTimeout(() => {
      const canGuideApple = platform === "ios" || (platform === "mac" && safari);
      if (promptEvent || canGuideApple || /Windows/i.test(navigator.userAgent)) {
        setVisible(true);
        track("pwa_install_prompt", { method: promptEvent ? "native_prompt" : "instructions" });
      }
    }, 8_000);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [platform, safari, promptEvent]);

  if (installed || !visible || isNativeApp()) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    track("pwa_install_dismissed");
    setVisible(false);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      track("pwa_install", { method: "beforeinstallprompt", browser_platform: choice.platform });
      setVisible(false);
    } else {
      track("pwa_install_dismissed", { method: "browser_prompt" });
    }
    setPromptEvent(null);
  };

  const title = promptEvent
    ? "Install ResKonnect"
    : platform === "ios"
      ? "Add ResKonnect to your iPhone or iPad"
      : platform === "mac" && safari
        ? "Add ResKonnect to your Mac Dock"
        : "Install ResKonnect on this computer";

  const instructions = platform === "ios"
    ? <>In Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. ResKonnect will open like an app with its own icon.</>
    : platform === "mac" && safari
      ? <>In Safari, choose <strong>File → Add to Dock</strong>. The installed web app opens in its own window.</>
      : <>Use your browser's <strong>Install app</strong> option in the address bar or browser menu. Chrome and Edge support desktop installation.</>;

  return (
    <Card className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[1600] w-[min(94vw,430px)] -translate-x-1/2 border-primary/25 bg-card/98 p-4 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-4 sm:w-[390px] sm:translate-x-0">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
          {platform === "ios" ? <Share2 className="h-5 w-5 text-primary" /> : platform === "mac" ? <MonitorDown className="h-5 w-5 text-primary" /> : <Download className="h-5 w-5 text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-foreground">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{instructions}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {promptEvent && <Button size="sm" onClick={() => void install()}><Download className="mr-2 h-4 w-4" />Install app</Button>}
            <Button size="sm" variant="outline" onClick={dismiss}>Not now</Button>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Dismiss install prompt">
          <X className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
