import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const BOOT_KEY = "rk_native_post_login_boot";
const RELEASE = "1.1.2";

export default function NativeStudentHome() {
  const { user, signOut } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const firstName = useMemo(() => {
    const raw = String(summary?.profile?.full_name || user?.user_metadata?.full_name || user?.email || "Student");
    return raw.trim().split(/\s+/)[0] || "Student";
  }, [summary?.profile?.full_name, user?.email, user?.user_metadata?.full_name]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      localStorage.setItem(BOOT_KEY, JSON.stringify({ user_id: user.id, release: RELEASE, status: "rendered", at: Date.now() }));
    } catch {}
    const stableTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(BOOT_KEY, JSON.stringify({ user_id: user.id, release: RELEASE, status: "stable", at: Date.now() }));
      } catch {}
    }, 1800);

    const loadTimer = window.setTimeout(async () => {
      setLoading(true);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      try {
        const query = (supabase as any).rpc("my_reskonnect_command_centre");
        const { data, error } = typeof query?.abortSignal === "function"
          ? await query.abortSignal(controller.signal)
          : await query;
        if (!error && data) setSummary(data);
      } catch (error) {
        console.warn("[NativeStudentHome] summary unavailable safely", error);
      } finally {
        window.clearTimeout(timeout);
        setLoading(false);
      }
    }, 900);

    return () => {
      window.clearTimeout(stableTimer);
      window.clearTimeout(loadTimer);
    };
  }, [user?.id]);

  const applicationCount = Number(summary?.living?.application_count || 0);
  const nextAction = summary?.next_action || null;

  return (
    <main className="min-h-[100dvh] bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 text-foreground">
      <section className="mx-auto max-w-2xl">
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">My ResKonnect · Android</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Good to see you, {firstName}.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Your account is signed in. This Android home is deliberately lightweight so login stays stable while your live ResKonnect data loads safely.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border px-3 py-1.5">Session active</span>
            <span className="rounded-full border px-3 py-1.5">Android {RELEASE}</span>
            <span className="rounded-full border px-3 py-1.5">{loading ? "Syncing…" : "Ready"}</span>
          </div>
        </div>

        {nextAction && (
          <section className="mt-4 rounded-3xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Next best action</p>
            <h2 className="mt-2 text-xl font-black">{nextAction.title || "Continue your journey"}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{nextAction.rationale || "Continue your highest-priority ResKonnect action."}</p>
            <Link to={String(nextAction.action_url || "/my-applications")} className="mt-4 inline-flex rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Continue</Link>
          </section>
        )}

        <section className="mt-4 grid grid-cols-2 gap-3">
          <NativeTile to="/findmyres" title="Find My Res" text="Search verified accommodation" />
          <NativeTile to="/my-applications" title="Applications" text={applicationCount ? applicationCount + " active in your journey" : "Track accommodation applications"} />
          <NativeTile to="/application-assistance" title="Application help" text="Get assistance with applications" />
          <NativeTile to="/student-care" title="Student care" text="Feedback and single-room support" />
          <NativeTile to="/opportunities" title="Opportunities" text="WIL, bursaries and more" />
          <NativeTile to="/ai" title="ResKonnect AI" text="Ask account-aware questions" />
          <NativeTile to="/profile" title="Profile" text="Update your student details" />
          <NativeTile to="/documents" title="Documents" text="Manage your secure files" />
        </section>

        <div className="mt-5 rounded-3xl border bg-card p-4">
          <button type="button" onClick={() => void signOut()} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold">Sign out</button>
        </div>
      </section>
    </main>
  );
}

function NativeTile({ to, title, text }: { to: string; title: string; text: string }) {
  return (
    <Link to={to} className="min-w-0 rounded-3xl border bg-card p-4 shadow-sm active:scale-[.99]">
      <p className="font-black">{title}</p>
      <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{text}</p>
    </Link>
  );
}
