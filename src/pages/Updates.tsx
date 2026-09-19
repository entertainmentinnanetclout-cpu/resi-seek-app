import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Bell, CheckCheck, FileText } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import NativeAlertSettings from "@/components/native/NativeAlertSettings";
import NotificationDetail from "@/pages/NotificationDetail";
import { Button } from "@/components/ui/button";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { safeRelativeTime } from "@/lib/safeDates";

export default function Updates() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { notifications, loading, unreadCount, markAllAsRead } = useRealtimeNotifications();
  if (params.has("id")) return <NotificationDetail />;
  return <DashboardLayout><main className="mx-auto max-w-5xl space-y-5 px-4 py-6 pb-24 sm:px-7 sm:py-10">
    <div className="rounded-[28px] border border-primary/15 bg-gradient-to-br from-sky-500/15 via-card to-violet-500/15 p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><Bell className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-[.16em] text-primary">My ResKonnect</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Notifications</h1></div></div>{unreadCount > 0 && <Button variant="outline" className="rounded-full" onClick={() => void markAllAsRead()}><CheckCheck className="mr-2 h-4 w-4" />Mark all read</Button>}</div><p className="mt-3 text-sm text-muted-foreground">Application submissions, status changes, accommodation feedback and account updates appear here in full.</p><p className="mt-3 text-xs font-bold text-primary">{unreadCount} unread · {notifications.length} recent messages</p></div>
    <NativeAlertSettings />
    {loading ? <div role="status" className="rounded-3xl border bg-card p-8 text-center text-muted-foreground">Loading your account updates…</div> : notifications.length === 0 ? <div className="rounded-3xl border bg-card p-10 text-center"><Bell className="mx-auto mb-3 h-10 w-10 text-primary" /><h2 className="font-bold">No notifications yet</h2><p className="mt-2 text-sm text-muted-foreground">Updates about your applications and account will appear here.</p></div> : <section aria-label="Account notifications" className="space-y-3">{notifications.map(n => <button key={n.id} type="button" onClick={() => navigate(`/dashboard/updates?id=${encodeURIComponent(n.id)}`)} className={`group flex w-full items-start gap-3 rounded-3xl border p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:p-5 ${n.is_read ? "bg-card" : "border-primary/25 bg-gradient-to-r from-primary/[.075] to-card"}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-bold">{n.title || "ResKonnect update"}</span>{!n.is_read && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">NEW</span>}</span><span className="mt-1 block line-clamp-2 text-sm leading-6 text-muted-foreground">{n.message || "Open to read your update."}</span><span className="mt-2 block text-xs text-muted-foreground">{n.created_at ? safeRelativeTime(n.created_at) : "Recently"}</span></span><ArrowRight className="mt-2 h-4 w-4 shrink-0 text-primary transition group-hover:translate-x-1" /></button>)}</section>}
  </main></DashboardLayout>;
}
