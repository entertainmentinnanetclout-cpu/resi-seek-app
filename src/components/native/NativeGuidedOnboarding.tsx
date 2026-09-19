import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Compass, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";

const STEP_COUNT = 4;
const STORAGE_VERSION = "rk_native_guide_v1_";
type Saved = { step: number; paused: boolean; complete: boolean };
const readSaved = (key: string): Saved | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Number.isInteger(saved.step)) return null;
    return { step: Math.max(0, Math.min(STEP_COUNT - 1, saved.step)), paused: Boolean(saved.paused), complete: Boolean(saved.complete) };
  } catch { return null; }
};
const writeSaved = (key: string, state: Saved) => {
  try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* optional storage */ }
};
const profileNeedsAttention = (profile: any) => !profile || ["full_name", "phone", "campus", "course", "year_of_study"].some(key => !String(profile[key] ?? "").trim());

/** Android-only guided walk-through; does not replace the existing profile-completion gate. */
export default function NativeGuidedOnboarding() {
  const { user, isStudent } = useAuth();
  const { profile, loading } = useRealtimeProfile(user);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const key = user ? `${STORAGE_VERSION}${user.id}` : "";
  const [saved, setSaved] = useState<Saved>({ step: 0, paused: true, complete: false });
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!user || !isStudent) return;
    const prior = readSaved(key);
    setSaved(prior ?? { step: 0, paused: pathname !== "/dashboard", complete: false });
    setReady(true);
  }, [key, isStudent, user?.id]);
  useEffect(() => { if (ready && key) writeSaved(key, saved); }, [key, ready, saved]);
  useEffect(() => {
    if (!ready || saved.paused || saved.complete) return;
    // If the existing mandatory profile form is open, it has priority. Never put
    // an onboarding overlay above another modal or interfere with typing/saving.
    const update = () => setBlocked(Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-rk-guide-suppress="true"]')));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "data-rk-guide-suppress"] });
    return () => observer.disconnect();
  }, [ready, saved.paused, saved.complete, pathname]);

  const active = ready && Boolean(user && isStudent) && !saved.paused && !saved.complete && !blocked;
  useEffect(() => {
    if (!active) return;
    const selectTarget = () => {
      const selector = saved.step === 0
        ? 'button[aria-label="Open navigation"], aside nav, header button:has([data-slot="avatar"]), main'
        : saved.step === 1 ? 'main form, main'
        : saved.step === 2 ? 'main input[type="search"], main input[placeholder], main'
        : 'main';
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) { setRect(null); return; }
      const bounds = node.getBoundingClientRect();
      setRect(bounds.width > 0 && bounds.height > 0 ? bounds : null);
    };
    selectTarget();
    window.addEventListener("resize", selectTarget);
    window.addEventListener("scroll", selectTarget, true);
    const interval = window.setInterval(selectTarget, 650);
    return () => { window.removeEventListener("resize", selectTarget); window.removeEventListener("scroll", selectTarget, true); window.clearInterval(interval); };
  }, [active, pathname, saved.step]);

  const next = useCallback(() => {
    if (saved.step === 0) {
      if (!loading && profileNeedsAttention(profile)) {
        setSaved(previous => ({ ...previous, step: 1 }));
        navigate("/profile");
      } else {
        setSaved(previous => ({ ...previous, step: 2 }));
        navigate("/findmyres");
      }
    } else if (saved.step === 1) {
      setSaved(previous => ({ ...previous, step: 2 }));
      navigate("/findmyres");
    } else if (saved.step === 2) {
      setSaved(previous => ({ ...previous, step: 3 }));
      navigate("/my-applications");
    } else {
      setSaved({ step: STEP_COUNT - 1, paused: false, complete: true });
    }
  }, [saved.step, loading, profile, navigate]);
  if (!user || !isStudent || !ready) return null;

  if (!active) {
    if (blocked || (saved.step === 0 && pathname !== "/dashboard")) return null;
    return pathname === "/dashboard" ? <button type="button" onClick={() => setSaved({ step: 0, paused: false, complete: false })} className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 z-[110] flex min-h-10 items-center gap-2 rounded-full border bg-card/95 px-3 text-xs font-bold text-foreground shadow-lg backdrop-blur" aria-label="Resume native app guide"><Compass className="h-4 w-4 text-primary" />App guide</button> : null;
  }

  const steps = [
    { title: "Welcome to My ResKonnect", text: "This is your complete dashboard. Start by checking your profile so accommodation and application updates are accurate.", cta: !loading && profileNeedsAttention(profile) ? "Set up my profile" : "Find accommodation" },
    { title: "Complete your profile", text: "Fill in any missing personal, campus and course information. Upload any requested documents using your existing profile form. Save your changes before continuing.", cta: "Find accommodation" },
    { title: "Find My Res", text: "Use the campus and location filters to explore accommodation near you. Open a listing to see details, then apply when you are ready.", cta: "Show my applications" },
    { title: "Track your applications", text: "This page is where you follow applications and updates. You can return to Find My Res from the side navigation at any time.", cta: "Finish guide" },
  ];
  const current = steps[saved.step];
  const vw = window.innerWidth, vh = window.innerHeight;
  const padding = 7;
  const left = rect ? Math.max(0, rect.left - padding) : vw * 0.1;
  const top = rect ? Math.max(0, rect.top - padding) : vh * 0.12;
  const right = rect ? Math.min(vw, rect.right + padding) : vw * 0.9;
  const bottom = rect ? Math.min(vh, rect.bottom + padding) : vh * 0.55;
  const shade = "rgba(4,13,33,0.77)";
  const panel = (style: React.CSSProperties) => <div aria-hidden="true" className="fixed z-[2000]" style={{ background: shade, ...style }} />;

  return <div role="dialog" aria-modal="false" aria-label="ResKonnect app guide" className="pointer-events-none fixed inset-0 z-[2000]">
    {panel({ left: 0, top: 0, right: 0, height: top })}
    {panel({ left: 0, top, width: left, height: Math.max(0, bottom - top) })}
    {panel({ left: right, right: 0, top, height: Math.max(0, bottom - top) })}
    {panel({ left: 0, right: 0, top: bottom, bottom: 0 })}
    <div className="fixed z-[2001] rounded-2xl border-2 border-cyan-300 shadow-[0_0_0_5px_rgba(34,211,238,.12)]" style={{ pointerEvents: "none", top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }} />
    <section className="pointer-events-auto fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[2002] w-[min(94vw,390px)] -translate-x-1/2 rounded-[24px] border border-primary/20 bg-card p-5 text-foreground shadow-2xl" aria-live="polite">
      <div className="mb-3 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-widest text-primary">Step {saved.step + 1} of {STEP_COUNT}</span><button type="button" onClick={() => setSaved(previous => ({ ...previous, paused: true }))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted" aria-label="Pause the guide"><X className="h-4 w-4" /></button></div>
      <h2 className="text-lg font-black">{current.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{current.text}</p>
      <div className="mt-5 flex items-center justify-between gap-3"><button type="button" onClick={() => setSaved({ step: STEP_COUNT - 1, paused: false, complete: true })} className="min-h-10 px-2 text-xs font-bold text-muted-foreground">Skip guide</button><button type="button" onClick={next} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">{current.cta}<ArrowRight className="h-4 w-4" /></button></div>
    </section>
  </div>;
}
