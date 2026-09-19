import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { nativeForegroundAlert } from "@/lib/nativeNotifications";

export interface AccountNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
type Snapshot = { notifications: AccountNotification[]; unreadCount: number; loading: boolean };
type Listener = (snapshot: Snapshot) => void;
const EMPTY: Snapshot = { notifications: [], unreadCount: 0, loading: false };
const stores = new Map<string, {
  snapshot: Snapshot; listeners: Set<Listener>; channel: ReturnType<typeof supabase.channel> | null;
  request: Promise<void> | null; seen: Set<string>;
}>();
function storeFor(userId: string) {
  let store = stores.get(userId);
  if (!store) {
    store = { snapshot: { notifications: [], unreadCount: 0, loading: true }, listeners: new Set<Listener>(), channel: null, request: null, seen: new Set<string>() };
    stores.set(userId, store);
  }
  return store;
}
function publish(userId: string, next: Snapshot) {
  const store = storeFor(userId);
  store.snapshot = next;
  store.listeners.forEach(listener => listener(next));
}
async function load(userId: string, force = false) {
  const store = storeFor(userId);
  if (store.request) return store.request;
  if (!force && !store.snapshot.loading && store.snapshot.notifications.length) return;
  const request = (async () => {
    const { data, error } = await supabase.from("notifications")
      .select("id,user_id,type,title,message,is_read,metadata,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (error) { console.error("Notifications could not load", error); publish(userId, { ...store.snapshot, loading: false }); return; }
    const notifications = (data || []) as AccountNotification[];
    notifications.forEach(n => store.seen.add(n.id));
    publish(userId, { notifications, unreadCount: notifications.filter(n => !n.is_read).length, loading: false });
  })();
  store.request = request;
  try { await request; } finally { store.request = null; }
}
function connect(userId: string) {
  const store = storeFor(userId);
  if (store.channel) return;
  store.channel = supabase.channel(`rk-account-notices-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, payload => {
      if (payload.eventType === "DELETE") { void load(userId, true); return; }
      const next = payload.new as AccountNotification;
      if (!next?.id || next.user_id !== userId) return;
      const already = store.seen.has(next.id);
      store.seen.add(next.id);
      const rows = [next, ...store.snapshot.notifications.filter(n => n.id !== next.id)]
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 100);
      publish(userId, { notifications: rows, unreadCount: rows.filter(n => !n.is_read).length, loading: false });
      if (payload.eventType === "INSERT" && !already && !next.is_read) {
        const path = `/dashboard/updates?id=${encodeURIComponent(next.id)}`;
        toast.info(next.title || "New ResKonnect update", { description: "Open to read the complete account message.", action: { label: "Open", onClick: () => window.location.assign(path) } });
        void nativeForegroundAlert(userId, next.id);
      }
    }).subscribe(status => { if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") void load(userId, true); });
  void load(userId, true);
}
async function mark(userId: string, id?: string) {
  const store = storeFor(userId);
  const target = id ? store.snapshot.notifications.find(n => n.id === id) : null;
  if (id && (!target || target.is_read)) return;
  const query = supabase.from("notifications").update({ is_read: true }).eq("user_id", userId);
  const { error } = await (id ? query.eq("id", id) : query.eq("is_read", false));
  if (error) { console.error("Notification read update failed", error); return; }
  const notifications = store.snapshot.notifications.map(n => !id || n.id === id ? { ...n, is_read: true } : n);
  publish(userId, { ...store.snapshot, notifications, unreadCount: notifications.filter(n => !n.is_read).length });
}
export function useRealtimeNotifications() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const [snapshot, setSnapshot] = useState<Snapshot>(() => userId ? storeFor(userId).snapshot : EMPTY);
  useEffect(() => {
    if (!userId) { setSnapshot(EMPTY); return; }
    const store = storeFor(userId);
    setSnapshot(store.snapshot);
    store.listeners.add(setSnapshot);
    connect(userId);
    return () => {
      store.listeners.delete(setSnapshot);
      if (store.listeners.size === 0) {
        const channel = store.channel;
        store.channel = null;
        if (channel) void supabase.removeChannel(channel);
        stores.delete(userId);
      }
    };
  }, [userId]);
  const markAsRead = useCallback((id: string) => userId ? mark(userId, id) : Promise.resolve(), [userId]);
  const markAllAsRead = useCallback(() => userId ? mark(userId) : Promise.resolve(), [userId]);
  const refetch = useCallback(() => userId ? load(userId, true) : Promise.resolve(), [userId]);
  return { ...snapshot, markAsRead, markAllAsRead, refetch };
}
