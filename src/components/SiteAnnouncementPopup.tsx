import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, CalendarDays, Megaphone, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BRAND } from "@/constants/brand";
import { supabase } from "@/integrations/supabase/client";

type Announcement = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string;
  badge: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  graphic_variant: string | null;
  dismissible: boolean;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
};

const dismissalKey = (item: Announcement) => `reskonnect_update_dismissed:${item.id}:${item.updated_at}`;

const isCurrentlyScheduled = (item: Announcement, now: number) => {
  const starts = item.starts_at ? new Date(item.starts_at).getTime() : Number.NEGATIVE_INFINITY;
  const ends = item.ends_at ? new Date(item.ends_at).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(starts) || starts === Number.NEGATIVE_INFINITY
    ? now >= starts && now <= ends
    : false;
};

export default function SiteAnnouncementPopup() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let revealTimer: number | undefined;

    const load = async () => {
      const db = supabase as any;
      const { data, error } = await db
        .from("site_announcements")
        .select("id,title,subtitle,body,badge,cta_label,cta_url,image_url,graphic_variant,dismissible,starts_at,ends_at,updated_at")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(20);

      if (cancelled || error || !data?.length) return;

      const now = Date.now();
      const current = (data as Announcement[]).find((item) => isCurrentlyScheduled(item, now));
      if (!current) return;
      if (current.dismissible !== false && localStorage.getItem(dismissalKey(current))) return;

      setAnnouncement(current);
      revealTimer = window.setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, 650);
    };

    load().catch(() => undefined);
    return () => {
      cancelled = true;
      if (revealTimer) window.clearTimeout(revealTimer);
    };
  }, []);

  const isInternal = useMemo(() => Boolean(announcement?.cta_url?.startsWith("/")), [announcement?.cta_url]);
  const is2027Graphic = announcement?.graphic_variant === "reskonnect_2027" || /2027/.test(`${announcement?.badge || ""} ${announcement?.title || ""}`);

  if (!announcement || !visible) return null;

  const dismiss = () => {
    if (announcement.dismissible !== false) localStorage.setItem(dismissalKey(announcement), "1");
    setVisible(false);
  };

  const cta = announcement.cta_label && announcement.cta_url ? (
    isInternal ? (
      <Button asChild className="h-10 rounded-xl px-4 text-sm font-bold sm:h-11 sm:px-5" onClick={dismiss}>
        <Link to={announcement.cta_url}>{announcement.cta_label}<ArrowRight className="ml-2 h-4 w-4" /></Link>
      </Button>
    ) : (
      <Button asChild className="h-10 rounded-xl px-4 text-sm font-bold sm:h-11 sm:px-5" onClick={dismiss}>
        <a href={announcement.cta_url} target="_blank" rel="noreferrer">{announcement.cta_label}<ArrowRight className="ml-2 h-4 w-4" /></a>
      </Button>
    )
  ) : null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-2.5 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={announcement.title}>
      <div className="relative max-h-[calc(100dvh-1.25rem)] w-full max-w-[calc(100vw-1.25rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/20 bg-background shadow-2xl sm:max-h-[90vh] sm:max-w-xl sm:rounded-[28px]">
        {announcement.dismissible !== false && (
          <button onClick={dismiss} className="absolute right-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur transition hover:bg-black/45 sm:right-3 sm:top-3 sm:h-9 sm:w-9" aria-label="Close update">
            <X className="h-4 w-4" />
          </button>
        )}

        {announcement.image_url ? (
          <div className="relative h-36 overflow-hidden bg-muted sm:h-52">
            <img src={announcement.image_url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <img src={BRAND.logos.full} alt={BRAND.name} className="absolute bottom-3 left-3 h-9 w-auto rounded-lg bg-white/90 p-1.5 object-contain shadow sm:bottom-5 sm:left-5 sm:h-12 sm:rounded-xl sm:p-2" />
          </div>
        ) : (
          <div className="relative min-h-36 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-violet p-4 text-primary-foreground sm:min-h-52 sm:p-6">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/15 bg-white/10" />
            <div className="absolute -bottom-24 -left-12 h-56 w-56 rounded-full border border-white/10 bg-white/5" />
            <div className="absolute right-12 top-12 h-20 w-20 rotate-12 rounded-3xl border border-white/20 bg-white/10" />
            <div className="relative flex h-full min-h-28 flex-col justify-between sm:min-h-40">
              <img src={BRAND.logos.full} alt={BRAND.name} className="h-9 w-fit max-w-[180px] rounded-lg bg-white/95 p-1.5 object-contain shadow-lg sm:h-12 sm:max-w-[220px] sm:rounded-xl sm:p-2" />
              <div className="mt-6 flex items-end justify-between gap-3 sm:mt-10 sm:gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75 sm:text-xs sm:tracking-[0.22em]">{is2027Graphic ? "Living · 2027 intake" : "ResKonnect · platform update"}</p>
                  <p className="mt-1.5 text-2xl font-black leading-none sm:mt-2 sm:text-4xl">{is2027Graphic ? <>Reserve early.<br />Move smarter.</> : <>Stay informed.<br />Stay connected.</>}</p>
                </div>
                <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/10 sm:flex">
                  {is2027Graphic ? <CalendarDays className="h-8 w-8" /> : <Megaphone className="h-8 w-8" />}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 sm:p-7">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Badge className="rounded-full px-2.5 py-0.5 text-[9px] font-black tracking-wide sm:px-3 sm:py-1 sm:text-[10px]">{announcement.badge || "RESKONNECT UPDATE"}</Badge>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground sm:text-xs"><BellRing className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Latest update</span>
          </div>
          <h2 className="mt-3 text-xl font-black tracking-tight sm:mt-4 sm:text-3xl">{announcement.title}</h2>
          {announcement.subtitle && <p className="mt-1 text-sm font-semibold text-primary sm:text-base">{announcement.subtitle}</p>}
          <p className="mt-2.5 text-[13px] leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-6">{announcement.body}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-6">
            {cta}
            {announcement.dismissible !== false && <Button variant="ghost" className="h-10 rounded-xl px-3 text-sm sm:h-11 sm:px-4" onClick={dismiss}>Not now</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}