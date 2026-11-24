-- Reuse RG11-governed site announcements for promotional residence campaigns.
-- Content, URL, approval, publication, audience and scheduling remain governed
-- by existing site_announcements RLS and executive-approval triggers.
ALTER TABLE public.site_announcements
 ADD COLUMN IF NOT EXISTS display_surface text NOT NULL DEFAULT 'modal',
 ADD COLUMN IF NOT EXISTS width_px integer NOT NULL DEFAULT 440,
 ADD COLUMN IF NOT EXISTS poster_only boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS show_frequency text NOT NULL DEFAULT 'once_per_day',
 ADD COLUMN IF NOT EXISTS residence_id uuid REFERENCES public.residences(id) ON DELETE SET NULL;

ALTER TABLE public.site_announcements
 DROP CONSTRAINT IF EXISTS site_announcements_display_surface_check,
 ADD CONSTRAINT site_announcements_display_surface_check
 CHECK (display_surface IN ('modal','corner'));
ALTER TABLE public.site_announcements
 DROP CONSTRAINT IF EXISTS site_announcements_width_px_check,
 ADD CONSTRAINT site_announcements_width_px_check
 CHECK (width_px BETWEEN 280 AND 760);
ALTER TABLE public.site_announcements
 DROP CONSTRAINT IF EXISTS site_announcements_show_frequency_check,
 ADD CONSTRAINT site_announcements_show_frequency_check
 CHECK (show_frequency IN ('once_per_session','once_per_day','once_per_campaign'));

CREATE INDEX IF NOT EXISTS site_announcements_active_surface_priority_idx
 ON public.site_announcements(display_surface,priority DESC,starts_at)
 WHERE is_active=true;

COMMENT ON COLUMN public.site_announcements.width_px IS
 'Admin-customizable maximum width, clamped to the viewport and height on mobile.';
COMMENT ON COLUMN public.site_announcements.poster_only IS
 'Use the uploaded artwork at native aspect ratio, without cropping or duplicating embedded poster copy.';
COMMENT ON COLUMN public.site_announcements.show_frequency IS
 'Per-visitor suppression policy, never a guarantee of one exposure across browsers/devices.';
COMMENT ON COLUMN public.site_announcements.residence_id IS
 'Optional context for individually promoted residences, without implying availability or a paid contract.';
