import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getVisitorId } from "@/lib/referrals/referralStorage";

/** Lightweight first-party analytics for the ResKonnect Growth Command Centre. */
const GrowthTracker = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const creatorId = new URLSearchParams(location.search).get("creator");
        await (supabase as any).from("growth_events").insert({
          user_id: user?.id || null,
          event_type: "page_view",
          source: "web",
          creator_id: creatorId || null,
          metadata: {
            visitor_id: getVisitorId(),
            path: location.pathname,
            search: location.search,
            referrer: document.referrer || null,
          },
        });
      } catch {
        // Analytics must never block the product experience while migrations deploy.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search, user?.id]);

  return null;
};

export default GrowthTracker;
