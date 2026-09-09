import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type DeletionRequest = {
  id: string;
  status: "requested" | "processing" | "cancelled" | "completed";
  requested_at: string;
  updated_at: string;
};

export default function AccountDeletion() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user?.id) {
      setChecking(false);
      setRequest(null);
      return;
    }

    setChecking(true);
    void (supabase as any)
      .from("account_deletion_requests")
      .select("id,status,requested_at,updated_at")
      .eq("user_id", user.id)
      .in("status", ["requested", "processing"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }: any) => {
        if (!active) return;
        if (error) console.warn("[AccountDeletion] status check failed", error);
        setRequest(data || null);
        setChecking(false);
      });

    return () => { active = false; };
  }, [authLoading, user?.id]);

  const submitRequest = async () => {
    if (!user?.id) return;
    if (confirmation.trim().toUpperCase() !== "DELETE") {
      toast.error('Type DELETE to confirm the request.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("request_account_deletion", {
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      setRequest({
        id: data.id,
        status: data.status,
        requested_at: data.requested_at,
        updated_at: data.requested_at,
      });
      setConfirmation("");
      toast.success("Account deletion request submitted.");
    } catch (error: any) {
      console.error("[AccountDeletion] request failed", error);
      toast.error(error?.message || "Could not submit the account deletion request.");
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("cancel_account_deletion_request");
      if (error) throw error;
      if (!data?.cancelled) throw new Error("This deletion request can no longer be cancelled online.");
      setRequest(null);
      toast.success("Account deletion request cancelled.");
    } catch (error: any) {
      toast.error(error?.message || "Could not cancel the deletion request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Delete ResKonnect Account | Account & Data Deletion"
        description="Request deletion of your ResKonnect account and associated personal data, subject to lawful retention requirements."
      />
      <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-5"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive"><Trash2 className="h-6 w-6" /></div>
              <Badge variant="outline"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Privacy & account control</Badge>
            </div>
            <CardTitle className="mt-3 text-3xl">Delete your ResKonnect account</CardTitle>
            <CardDescription className="text-sm leading-relaxed">This page is available on the public website as well as inside ResKonnect so you can request deletion without reinstalling the app.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 p-5 sm:p-7">
            <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              <p className="font-bold text-foreground">What the request covers</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Your ResKonnect account and personal profile data.</li>
                <li>User-owned documents and data that can lawfully be deleted.</li>
                <li>Associated application/account data where ResKonnect is permitted to delete it.</li>
              </ul>
              <p className="mt-3">Some records may need to be retained or de-identified for legal, fraud-prevention, accounting, dispute-resolution or regulatory obligations. ResKonnect will not retain personal data merely to keep the account active after a completed deletion request.</p>
            </div>

            {checking || authLoading ? (
              <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking account status…</div>
            ) : !user ? (
              <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-bold">Sign in to identify the account</p><p className="mt-1 text-sm text-muted-foreground">For security, we need you to sign in to the ResKonnect account you want deleted. You can do that from the web; the Android app is not required.</p></div></div>
                <Button asChild><Link to="/auth">Sign in to continue</Link></Button>
              </div>
            ) : request ? (
              <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" /><div><p className="font-bold">Deletion request {request.status === "processing" ? "is being processed" : "received"}</p><p className="mt-1 text-sm text-muted-foreground">Requested {new Date(request.requested_at).toLocaleString("en-ZA")}. You can return to this page to check the request state.</p></div></div>
                {request.status === "requested" && <Button variant="outline" disabled={loading} onClick={() => void cancelRequest()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Cancel deletion request</Button>}
              </div>
            ) : (
              <div className="space-y-5">
                <div><p className="font-bold">Signed in as</p><p className="text-sm text-muted-foreground">{user.email}</p></div>
                <div><label htmlFor="deletion-reason" className="text-sm font-semibold">Reason (optional)</label><Textarea id="deletion-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tell us why you are leaving, if you want to." className="mt-2 min-h-24" /></div>
                <div><label htmlFor="delete-confirmation" className="text-sm font-semibold">Type DELETE to confirm</label><Input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" placeholder="DELETE" className="mt-2" /></div>
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-muted-foreground">Submitting this form creates a formal deletion request. It does not instantly erase records that may be needed for lawful retention or an active transaction. Once processing begins, online cancellation may no longer be available.</div>
                <Button variant="destructive" disabled={loading || confirmation.trim().toUpperCase() !== "DELETE"} onClick={() => void submitRequest()} className="w-full sm:w-auto">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Request account deletion</Button>
              </div>
            )}

            <div className="flex flex-wrap gap-3 border-t pt-5 text-sm"><Link to="/privacy" className="font-semibold text-primary hover:underline">Privacy Policy</Link><Link to="/terms" className="font-semibold text-primary hover:underline">Terms</Link><Link to="/" className="font-semibold text-primary hover:underline">ResKonnect home</Link></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
