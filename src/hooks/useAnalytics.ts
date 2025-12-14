import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type EventType = "view" | "click" | "apply" | "favorite" | "whatsapp_click" | "compare";

const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem("rk_session_id");
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("rk_session_id", sessionId);
  }
  return sessionId;
};

export const useAnalytics = () => {
  const { user } = useAuth();

  const trackEvent = useCallback(
    async (residenceId: string, eventType: EventType) => {
      try {
        await supabase.from("residence_analytics").insert({
          residence_id: residenceId,
          event_type: eventType,
          user_id: user?.id || null,
          session_id: getSessionId(),
        });
      } catch (error) {
        // Silently fail - analytics shouldn't break the app
        console.debug("Analytics tracking failed:", error);
      }
    },
    [user]
  );

  return { trackEvent };
};

export default useAnalytics;
