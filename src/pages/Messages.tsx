import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface AppMessage {
  id: string;
  application_id: string;
  sender_type: string | null;
  message: string;
  created_at: string;
}

const Messages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const loadMessages = useCallback(async () => {
    if (!user?.id) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const { data: apps, error: appsError } = await (supabase as any)
        .from("applications")
        .select("id")
        .eq("user_id", user.id)
        .abortSignal(controller.signal);
      if (appsError) throw appsError;

      const ids = (apps || []).map((app: any) => app.id);
      if (!ids.length) {
        setMessages([]);
        return;
      }

      const { data, error: messageError } = await (supabase as any)
        .from("application_messages")
        .select("id, application_id, sender_type, message, created_at")
        .in("application_id", ids)
        .order("created_at", { ascending: false })
        .limit(50)
        .abortSignal(controller.signal);
      if (messageError) throw messageError;
      setMessages((data || []) as AppMessage[]);
    } catch (err: any) {
      if (controller.signal.aborted) {
        setError("Messages took too long to refresh. Check your connection and try again.");
      } else {
        setError(err?.message || "Messages are temporarily unavailable.");
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadMessages();

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => void loadMessages(), 500);
    };

    const channel = supabase
      .channel(`user-messages-${user?.id || "anonymous"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "application_messages" },
        scheduleRefresh,
      )
      .subscribe();

    const onReconnect = () => scheduleRefresh();
    window.addEventListener("rk-reconnected", onReconnect);

    return () => {
      requestRef.current?.abort();
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      window.removeEventListener("rk-reconnected", onReconnect);
      void supabase.removeChannel(channel);
    };
  }, [loadMessages, user?.id]);

  return (
    <DashboardLayout>
      <SEO
        title="Your Messages | ResKonnect"
        description="Communicate with residence administrators and get updates on your applications."
      />
      <div className="p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Messages</h1>
              <p className="mt-2 text-muted-foreground">Communicate with residence administrators</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadMessages()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>

          {error && (
            <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div><p className="font-bold">Messages need a connection refresh</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div>
                </div>
                <Button type="button" variant="outline" onClick={() => void loadMessages()} disabled={loading}>Try again</Button>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <Card><CardContent className="p-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Loading your messages…</p>
            </CardContent></Card>
          ) : messages.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">No Messages Yet</h3>
                <p className="mb-6 text-muted-foreground">Once you apply for a residence, replies from administrators will appear here.</p>
                <Button asChild><Link to="/find">Find Residences</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <Card key={message.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{message.sender_type || "message"}</span>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{message.message}</p>
                    <Link to="/applications" className="mt-2 inline-block text-xs text-primary hover:underline">View application →</Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
