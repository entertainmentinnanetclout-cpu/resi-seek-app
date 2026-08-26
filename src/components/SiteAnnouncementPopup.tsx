import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, CalendarDays, X } from "lucide-react";
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
  updated_at: string;
};

const dismissalKey = (item: Announcement) => `reskonnect_update_dismissed:${item.id}:${item.updated_at}`;

export default function SiteAnnouncementPopup() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const db = supabase as any;
      const { data, error } = await db
        .from("site_announcements")
        .select("id,title,subtitle,body,badge,cta_label,cta_url,image_url,graphic_variant,dismissible,updated_at")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || error || !data) return;
      if (data.dismissible !== false && localStorage.getItem(dismissalKey(data))) return;
      setAnnouncement(data);
      window.setTimeout(() => { if (!cancelled) setVisible(true); }, 650);
    };
    load().catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const isInternal = useMemo(() => Boolean(announcement?.cta_url?.startsWith("/")), [announcement?.cta_url]);
  if (!announcement || !visible) return null;

  const dismiss = () => {
    if (announcement.dismissible !== false) localStorage.setItem(dismissalKey(announcement), "1");
    setVisible(false);
  };

  const cta = announcement.cta_label && announcement.cta_url ? (
    isInternal ? (
      <Button asChild className="h-11 rounded-xl px-5 font-bold" onClick={dismiss}>
        <Link to={announcement.cta_url}>{announcement.cta_label}<ArrowRight className="ml-2 h-4 w-4" /></Link>
      </Button>
    ) : (
      <Button asChild className="h-11 rounded-xl px-5 font-bold" onClick={dismiss}>
        <a href={announcement.cta_url} target="_blank" rel="noreferrer">{announcement.cta_label}<ArrowRight className="ml-2 h-4 w-4" /></a>
      </Button>
    )
  ) : null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={announcement.title}>
      <div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-white/20 bg-background shadow-2xl">
        {announcement.dismissible !== false && (
          <button onClick={dismiss} className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur transition hover:bg-black/40" aria-label="Close update">
            <X className="h-4 w-4" />
          </button>
        )}

        {announcement.image_url ? (
          <div className="relative h-52 overflow-hidden bg-muted">
            <img src={announcement.image_url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <img src={BRAND.logos.full} alt={BRAND.name} className="absolute bottom-5 left-5 h-12 w-auto rounded-xl bg-white/90 p-2 object-contain shadow" />
          </div>
        ) : (
          <div className="relative min-h-52 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-violet p-6 text-primary-foreground">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/15 bg-white/10" />
            <div className="absolute -bottom-24 -left-12 h-56 w-56 rounded-full border border-white/10 bg-white/5" />
            <div className="absolute right-12 top-12 h-20 w-20 rotate-12 rounded-3xl border border-white/20 bg-white/10" />
            <div className="relative flex h-full min-h-40 flex-col justify-between">
              <img src={BRAND.logos.full} alt={BRAND.name} className="h-12 w-fit max-w-[220px] rounded-xl bg-white/95 p-2 object-contain shadow-lg" />
              <div className="mt-10 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">Living · 2027 intake</p>
                  <p className="mt-2 text-3xl font-black leading-none sm:text-4xl">Reserve early.<br />Move smarter.</p>
                </div>
                <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/10 sm:flex">
                  <CalendarDays className="h-8 w-8" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full px-3 py-1 text-[10px] font-black tracking-wide">{announcement.badge || "RESKONNECT UPDATE"}</Badge>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><BellRing className="h-3.5 w-3.5" /> Latest update</span>
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">{announcement.title}</h2>
          {announcement.subtitle && <p className="mt-1 font-semibold text-primary">{announcement.subtitle}</p>}
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{announcement.body}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            {cta}
            {announcement.dismissible !== false && <Button variant="ghost" className="h-11 rounded-xl" onClick={dismiss}>Not now</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
