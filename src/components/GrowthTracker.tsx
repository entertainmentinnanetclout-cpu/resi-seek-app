import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getVisitorId } from "@/lib/referrals/referralStorage";

const CREATOR_ID_KEY = "reskonnect_creator_id";
const CREATOR_CODE_KEY = "reskonnect_creator_code";

/** First-party analytics + durable Creator Partner attribution. */
const GrowthTracker = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryCreatorId = params.get("creator");
    const queryCode = params.get("ref");
    if (queryCreatorId) localStorage.setItem(CREATOR_ID_KEY, queryCreatorId);
    if (queryCode && queryCreatorId) localStorage.setItem(CREATOR_CODE_KEY, queryCode);

    const timer = window.setTimeout(async () => {
      const creatorId = queryCreatorId || localStorage.getItem(CREATOR_ID_KEY);
      const creatorCode = localStorage.getItem(CREATOR_CODE_KEY);
      const visitorId = getVisitorId();
      try {
        await (supabase as any).from("growth_events").insert({
          user_id: user?.id || null,
          event_type: "page_view",
          source: "web",
          creator_id: creatorId || null,
          metadata: { visitor_id: visitorId, path: location.pathname, search: location.search, referrer: document.referrer || null },
        });
      } catch {
        // Analytics must never block the product experience while migrations deploy.
      }

      if (user?.id && creatorId) {
        try {
          await (supabase as any).rpc("attribute_creator", {
            _creator_id: creatorId,
            _referral_code: creatorCode || null,
            _session_id: visitorId,
            _source: "creator_campaign",
          });
        } catch {
          // Attribution also remains in localStorage until the database layer is available.
        }
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search, user?.id]);

  return null;
};

export default GrowthTracker;
