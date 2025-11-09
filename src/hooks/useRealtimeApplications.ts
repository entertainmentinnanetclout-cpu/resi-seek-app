import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type User } from "@supabase/supabase-js";

export function useRealtimeApplications(user: User | null) {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setApplications([]);
      return;
    }

    // 🧩 Fetch user applications
    const fetchApplications = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("applications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setApplications(data || []);
      } catch (err: any) {
        console.error("Error fetching applications:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // 🟢 Initial fetch
    fetchApplications();

    // 🟣 Subscribe to realtime updates
    const channel = supabase
      .channel(`realtime-applications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("📡 Application change received:", payload);
          fetchApplications();
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log(`✅ Subscribed to realtime updates for user ${user.id}`);
          setError(null);
        }
        if (status === "CHANNEL_ERROR") {
          console.error("❌ Subscription error:", err);
          setError("Subscription error occurred.");
        }
        if (status === "TIMED_OUT") {
          console.warn("⚠️ Subscription timed out.");
          setError("Realtime connection timed out.");
        }
      });

    // 🟡 Allow manual refresh from anywhere
    const handleManualRefresh = () => {
      console.log("🔄 Manual refresh triggered");
      fetchApplications();
    };
    window.addEventListener("refreshApplications", handleManualRefresh);

    // 🧹 Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("refreshApplications", handleManualRefresh);
    };
  }, [user]);

  return { applications, loading, error };
}
