import { ArrowRight, BellRing, BriefcaseBusiness, Building2, FileCheck2, Sparkles, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

/** Fast native-only first paint. All detailed account facts remain in the live command centre below. */
export default function NativeDashboardHighlights() {
  const { user } = useAuth();
  const { unreadCount } = useRealtimeNotifications();
  const name = String(user?.user_metadata?.full_name || "").trim().split(/\s+/)[0];
  const tiles = [
    { title: "Find My Res", detail: "Explore accommodation near your campus", to: "/findmyres", icon: Building2, className: "border-sky-200/60 bg-gradient-to-br from-sky-50 via-white to-cyan-50 text-sky-900 dark:border-sky-500/30 dark:from-sky-500/15 dark:via-card dark:to-cyan-500/10 dark:text-sky-100", iconBg: "bg-sky-600" },
    { title: "My applications", detail: "See progress and feedback", to: "/my-applications", icon: FileCheck2, className: "border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 text-emerald-900 dark:border-emerald-500/30 dark:from-emerald-500/15 dark:via-card dark:to-teal-500/10 dark:text-emerald-100", iconBg: "bg-emerald-600" },
    { title: "Profile & documents", detail: "Keep your information ready", to: "/profile", icon: UserRound, className: "border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 text-violet-900 dark:border-violet-500/30 dark:from-violet-500/15 dark:via-card dark:to-fuchsia-500/10 dark:text-violet-100", iconBg: "bg-violet-600" },
    { title: "Opportunities", detail: "Explore WIL, bursaries and more", to: "/opportunities", icon: BriefcaseBusiness, className: "border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-orange-50 text-amber-900 dark:border-amber-500/30 dark:from-amber-500/15 dark:via-card dark:to-orange-500/10 dark:text-amber-100", iconBg: "bg-amber-600" },
  ];
  return <div className="mx-auto max-w-7xl space-y-4 px-4 pb-2 pt-4 sm:px-6 sm:pt-7 lg:px-8">
    <section className="relative isolate overflow-hidden rounded-[30px] bg-gradient-to-br from-[#094674] via-[#2563eb] to-[#7428bd] p-6 text-white shadow-xl shadow-blue-900/15 sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" /><div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-10 h-52 w-52 rounded-full bg-cyan-300/15 blur-3xl" />
      <div className="relative z-10"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-white/80"><Sparkles className="h-4 w-4 text-cyan-200" />Living • AI • Opportunity</div><h1 className="mt-3 max-w-xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">{name ? `Welcome back, ${name}.` : "Welcome to My ResKonnect."}</h1><p className="mt-3 max-w-lg text-sm leading-6 text-white/85">Your next move starts here. Find a place, follow your applications and stay connected to your campus journey.</p>
      <div className="mt-5 flex flex-wrap gap-2"><Link to="/findmyres" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#164d89] shadow-md transition hover:bg-sky-50">Find accommodation<ArrowRight className="h-4 w-4" /></Link><Link to="/dashboard/updates" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/35 bg-white/10 px-4 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"><BellRing className="h-4 w-4" />{unreadCount ? `${unreadCount} new update${unreadCount === 1 ? "" : "s"}` : "Notifications"}</Link></div></div>
    </section>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{tiles.map(tile => { const Icon = tile.icon; return <Link to={tile.to} key={tile.to} className={`group relative flex min-h-[146px] flex-col justify-between gap-3 rounded-[24px] border p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${tile.className}`}><div className={`grid h-10 w-10 place-items-center rounded-2xl text-white shadow-sm ${tile.iconBg}`}><Icon className="h-5 w-5" /></div><div><h2 className="text-sm font-black sm:text-base">{tile.title}</h2><p className="mt-1 text-xs leading-5 opacity-75">{tile.detail}</p></div><ArrowRight aria-hidden="true" className="absolute right-4 top-5 h-4 w-4 opacity-60 transition group-hover:translate-x-1" /></Link>; })}</div>
  </div>;
}
