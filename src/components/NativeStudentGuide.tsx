import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Compass, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/accountRouting";

type Step = "profile" | "find" | "search" | "applications" | "updates" | "done";
const KEY_PREFIX = "rk_native_student_guide_v1_";
const ORDER: Step[] = ["profile", "find", "search", "applications", "updates", "done"];
const guidance: Record<Exclude<Step, "done">, { title: string; body: string; path: string; selector: string; action: string }> = {
  profile: { title: "Complete your student profile", body: "Your profile and required documents help us process your applications. Finish any missing details first; this guide will resume when you return.", path: "/setup-profile", selector: 'button[aria-label="My profile"], a[href="/profile"], button[data-rk-tour="profile"]', action: "Complete profile" },
  find: { title: "Find your accommodation", body: "Find My Res brings nearby student accommodation, verified listing details and application options together.", path: "/findmyres", selector: 'a[href="/findmyres"], button[data-rk-tour="find"]', action: "Open Find My Res" },
  search: { title: "Search and filter residences", body: "Select your campus, explore suitable accommodation and open a residence to check details and availability before applying.", path: "/findmyres", selector: 'input[placeholder*="Search"], input[aria-label*="Search"], #results', action: "Explore accommodation" },
  applications: { title: "Track your applications", body: "Use My Applications to follow submissions and any new application status or feedback.", path: "/my-applications", selector: 'a[href="/my-applications"], button[data-rk-tour="applications"]', action: "View applications" },
  updates: { title: "Keep up with your updates", body: "The notification bell shows account updates, while the Updates page keeps your notification history.", path: "/dashboard/updates", selector: 'button[aria-label*="notification" i], a[href="/dashboard/updates"]', action: "View updates" },
};

function loadStep(key: string): Step {
  try {
    const stored = localStorage.getItem(key);
    return ORDER.includes(stored as Step) ? stored as Step : "profile";
  } catch { return "profile"; }
}

export default function NativeStudentGuide() {
  const auth = useAuth();
  const { user, isStudent } = auth;
  const native = isNativeApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, loading } = useRealtimeProfile(native && isStudent ? user : null);
  const key = `${KEY_PREFIX}${user?.id || ""}`;
  const [step, setStep] = useState<Step>("done");
  const [dismissed, setDismissed] = useState(false);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [documents, setDocuments] = useState<string[]>([]);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [blockingDialog, setBlockingDialog] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setStep(user ? loadStep(key) : "done");
    setDismissed(false);
    setDocumentsLoaded(false);
    setDocuments([]);
  }, [key, user?.id]);

  useEffect(() => {
    if (!user || !native || !isStudent) return;
    let mounted = true;
    void supabase.from("documents").select("document_type").eq("user_id", user.id).then(({ data }) => {
      if (!mounted) return;
      setDocuments((data || []).map((row: any) => String(row.document_type)));
      setDocumentsLoaded(true);
    }).catch(() => { if (mounted) setDocumentsLoaded(true); });
    return () => { mounted = false; };
  }, [user?.id, native, isStudent]);

  const profileMissing = useMemo(() => {
    if (!profile) return true;
    const p = profile as any;
    const academic = ["university_student", "tvet_student"].includes(String(p.applicant_stage || "university_student"));
    return !p.full_name || !p.phone || !p.campus || !(p.student_number || p.identity_number)
      || !documents.includes("id") || (academic && !documents.includes("registration"));
  }, [profile, documents]);

  useEffect(() => {
    if (!native || !user || !isStudent || loading || !documentsLoaded || step !== "profile" || profileMissing) return;
    const next: Step = "find";
    setStep(next);
    try { localStorage.setItem(key, next); } catch { /* optional */ }
  }, [native, user?.id, isStudent, loading, documentsLoaded, step, profileMissing, key]);

  useEffect(() => {
    if (!native || !user || !isStudent || step === "done" || dismissed) { setRect(null); return; }
    const refresh = () => {
      const dialogOpen = Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
      setBlockingDialog(dialogOpen);
      if (dialogOpen || pathname === "/auth") { setRect(null); return; }
      const current = guidance[step];
      const target = document.querySelector(current.selector);
      if (target) {
        const bounds = target.getBoundingClientRect();
        setRect(bounds.width && bounds.height ? bounds : null);
      } else setRect(null);
    };
    const id = window.setTimeout(refresh, 300);
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: false });
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    return () => { window.clearTimeout(id); observer.disconnect(); window.removeEventListener("resize", refresh); window.removeEventListener("scroll", refresh, true); };
  }, [native, user?.id, isStudent, step, dismissed, pathname]);

  const persist = (next: Step) => {
    setStep(next);
    try { localStorage.setItem(key, next); } catch { /* optional */ }
  };
  const next = () => persist(ORDER[Math.min(ORDER.indexOf(step) + 1, ORDER.length - 1)]);
  const enabled = native && Boolean(user && isStudent) && step !== "done" && !dismissed && !blockingDialog && pathname !== "/auth" && !loading && documentsLoaded;
  const current = step === "done" ? null : guidance[step];

  if (!native || !user || !isStudent) return null;
  return <>
    {!enabled && step !== "done" && dismissed && pathname === "/dashboard" && <button type="button" onClick={() => setDismissed(false)} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[1300] inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg"><Compass className="h-4 w-4" />Resume guide</button>}
    {step === "done" && pathname === "/dashboard" && <button type="button" onClick={() => { persist("profile"); setDismissed(false); }} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[1300] rounded-full border bg-card px-3 py-2 text-xs font-semibold shadow-sm">App guide</button>}
    {enabled && current && <div role="dialog" aria-modal="true" aria-label="ResKonnect app guide" className="fixed inset-0 z-[5000]" style={{ pointerEvents: "none" }}>
      <div className="absolute inset-0 bg-slate-950/70" style={rect ? { clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${Math.max(0,rect.left-6)}px ${Math.max(0,rect.top-6)}px, ${Math.max(0,rect.left-6)}px ${Math.min(window.innerHeight,rect.bottom+6)}px, ${Math.min(window.innerWidth,rect.right+6)}px ${Math.min(window.innerHeight,rect.bottom+6)}px, ${Math.min(window.innerWidth,rect.right+6)}px ${Math.max(0,rect.top-6)}px, ${Math.max(0,rect.left-6)}px ${Math.max(0,rect.top-6)}px)` } : undefined} />
      {rect && <div className="absolute rounded-xl border-2 border-cyan-300 shadow-[0_0_0_5px_rgba(103,232,249,.22)]" style={{ left: Math.max(0,rect.left-6), top: Math.max(0,rect.top-6), width: rect.width+12, height: rect.height+12 }} />}
      <section className="absolute left-4 right-4 mx-auto max-w-sm rounded-2xl border border-primary/30 bg-card p-5 text-card-foreground shadow-2xl" style={{ pointerEvents: "auto", top: rect && rect.bottom + 235 < window.innerHeight ? Math.max(12, rect.bottom + 18) : undefined, bottom: rect && rect.bottom + 235 < window.innerHeight ? undefined : "max(1rem,env(safe-area-inset-bottom))" }}>
        <div className="flex items-start justify-between gap-3"><p className="text-xs font-black uppercase tracking-widest text-primary">Your app guide · {ORDER.indexOf(step)+1} of 5</p><button type="button" aria-label="Close guide" onClick={() => setDismissed(true)}><X className="h-5 w-5" /></button></div>
        <h2 className="mt-2 text-lg font-black">{current.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{current.body}</p>
        {step === "profile" && profileMissing && <p className="mt-2 text-xs font-semibold text-amber-700">Complete the required profile details and documents to continue.</p>}
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => { setActive(true); navigate(current.path); if (step === "find" || step === "applications" || step === "updates") next(); if (step === "search") next(); window.setTimeout(() => setActive(false), 350); }} disabled={active} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">{current.action}</button>{step !== "profile" && <button type="button" className="rounded-xl border px-3 py-2.5 text-sm font-semibold" onClick={next}>Next</button>}<button type="button" className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground" onClick={() => { persist("done"); setDismissed(false); }}>Skip guide</button></div>
      </section>
    </div>}
  </>;
}
