import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface AppMessage {
  id: string;
  application_id: string;
  sender_type: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
}

const Messages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: apps } = await supabase
        .from('applications')
        .select('id')
        .eq('user_id', user.id);
      const ids = (apps || []).map(a => a.id);
      if (!ids.length) { if (!cancelled) { setMessages([]); setLoading(false); } return; }
      const { data } = await supabase
        .from('application_messages')
        .select('id, application_id, sender_type, body, created_at, read_at')
        .in('application_id', ids)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled) { setMessages((data || []) as AppMessage[]); setLoading(false); }
    })();

    const channel = supabase
      .channel('user-messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'application_messages' },
        () => { /* trigger refresh */ setLoading(true); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user]);

  return (
    <DashboardLayout>
      <SEO
        title="Your Messages | ResKonnect"
        description="Communicate with residence administrators and get updates on your applications."
      />
      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Messages</h1>
            <p className="text-muted-foreground">
              Communicate with residence administrators
            </p>
          </div>
          {loading ? (
            <Card><CardContent className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            </CardContent></Card>
          ) : messages.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Messages Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Once you apply for a residence, replies from administrators will appear here.
                </p>
                <Button asChild variant="default"><Link to="/find">Find Residences</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {messages.map(m => (
                <Card key={m.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {m.sender_type || 'message'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                    <Link
                      to={`/applications`}
                      className="text-xs text-primary hover:underline mt-2 inline-block"
                    >
                      View application →
                    </Link>
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
