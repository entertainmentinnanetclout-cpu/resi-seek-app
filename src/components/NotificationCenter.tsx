import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, FileText, Home, Info, AlertCircle, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { cn } from "@/lib/utils";
import { safeRelativeTime } from "@/lib/safeDates";

export default function NotificationCenter() {
  const { notifications, unreadCount, markAllAsRead, loading } = useRealtimeNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const typeIcon = (type: string) => type.includes("application") ? FileText : type === "residence" ? Home : type === "alert" ? AlertCircle : Info;
  const openNotice = (id: string) => { setOpen(false); navigate(`/dashboard/updates?id=${encodeURIComponent(id)}`); };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}><Bell className="h-5 w-5" />{unreadCount > 0 && <Badge variant="destructive" className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-[10px]">{unreadCount > 9 ? "9+" : unreadCount}</Badge>}</Button></PopoverTrigger>
    <PopoverContent align="end" className="w-[min(90vw,22rem)] p-0">
      <div className="flex items-center justify-between gap-2 border-b p-4"><div><h2 className="font-bold">Your notifications</h2><p className="text-xs text-muted-foreground">{unreadCount ? `${unreadCount} unread` : "All caught up"}</p></div>{unreadCount > 0 && <Button variant="ghost" size="sm" onClick={() => void markAllAsRead()}><CheckCheck className="mr-1 h-4 w-4" />Read all</Button>}</div>
      <ScrollArea className="max-h-[min(58dvh,24rem)]"><div className="divide-y">
        {loading ? <p role="status" className="p-6 text-center text-sm text-muted-foreground">Loading updates…</p> : notifications.length === 0 ? <div className="p-8 text-center"><Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">No notifications yet</p></div> : notifications.slice(0, 20).map(n => { const Icon = typeIcon(n.type || ""); return <button type="button" key={n.id} className={cn("flex w-full gap-3 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", !n.is_read && "border-l-[3px] border-l-primary bg-primary/[.045]")} onClick={() => openNotice(n.id)} aria-label={`Read full notification: ${n.title || "ResKonnect update"}`}><Icon className="mt-1 h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className={cn("block truncate text-sm", !n.is_read && "font-bold")}>{n.title || "ResKonnect update"}</span><span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{n.message || "Open to view the update."}</span><span className="mt-2 block text-[11px] text-muted-foreground">{n.created_at ? safeRelativeTime(n.created_at) : "Recently"}</span></span><ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /></button>; })}
      </div></ScrollArea>
      <div className="border-t p-2"><Button variant="ghost" className="w-full justify-between rounded-xl" onClick={() => { setOpen(false); navigate("/dashboard/updates"); }}>Open notification centre<ArrowUpRight className="h-4 w-4" /></Button></div>
    </PopoverContent>
  </Popover>;
}
