import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, X, FileText, ShieldCheck } from "lucide-react";
import { getSignedUrl } from "@/lib/storage/signedUrl";

export const AdminSellerApprovalsContent = () => {
  const [stores, setStores] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [docUrl, setDocUrl] = useState<string | null>(null);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("stores")
      .select("*")
      .in("kyc_status", ["pending", "rejected"])
      .order("kyc_submitted_at", { ascending: false });
    const enriched = await Promise.all((data || []).map(async (s: any) => {
      const { data: p } = await supabase.from("profiles").select("full_name,email,phone").eq("id", s.user_id).maybeSingle();
      return { ...s, owner: p };
    }));
    setStores(enriched);
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (s: any) => {
    setSelected(s); setReason("");
    if (s.verification_doc_url) {
      try {
        const url = await getSignedUrl("seller-kyc", s.verification_doc_url, 900);
        setDocUrl(url);
      } catch {
        setDocUrl(null);
      }
    } else setDocUrl(null);
  };

  const approve = async () => {
    if (!selected) return;
    const { error } = await supabase.from("stores").update({ kyc_status: "approved", verified: true, is_active: true, kyc_reviewed_at: new Date().toISOString() } as any).eq("id", selected.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("seller_kyc_log" as any).insert({ store_id: selected.id, action: "approved" } as any);
    toast.success("Seller approved"); setSelected(null); load();
  };
  const reject = async () => {
    if (!selected || !reason.trim()) { toast.error("Provide a reason"); return; }
    const { error } = await supabase.from("stores").update({ kyc_status: "rejected", verified: false, kyc_rejection_reason: reason, kyc_reviewed_at: new Date().toISOString() } as any).eq("id", selected.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("seller_kyc_log" as any).insert({ store_id: selected.id, action: "rejected", notes: reason } as any);
    toast.success("Seller rejected"); setSelected(null); load();
  };

  return (
    <>
      <SEO title="Seller Approvals | Admin" description="Review and approve student seller KYC applications" />
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><ShieldCheck className="w-7 h-7 text-primary" />Seller KYC Approvals</h1>
          <p className="text-muted-foreground">Review and approve student seller applications.</p>
        </div>
        <Card><CardHeader><CardTitle>Pending ({stores.filter(s => s.kyc_status === "pending").length})</CardTitle></CardHeader><CardContent>
          {stores.length === 0 ? <p className="text-center py-8 text-muted-foreground">No pending applications</p> : (
            <div className="space-y-2">
              {stores.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-semibold">{s.store_name}</p>
                    <p className="text-xs text-muted-foreground">{s.owner?.full_name} · {s.owner?.email} · {s.campus || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.kyc_status === "pending" ? "secondary" : "destructive"}>{s.kyc_status}</Badge>
                    <Button size="sm" onClick={() => openDetail(s)}>Review</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selected?.store_name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Owner:</strong> {selected.owner?.full_name}</div>
                <div><strong>Email:</strong> {selected.owner?.email}</div>
                <div><strong>ID:</strong> {selected.id_number}</div>
                <div><strong>Student #:</strong> {selected.student_number}</div>
                <div><strong>WhatsApp:</strong> {selected.contact_whatsapp}</div>
                <div><strong>Campus:</strong> {selected.campus}</div>
                <div className="col-span-2"><strong>Payout:</strong> {selected.payout_method} · {selected.payout_bank_name} · {selected.payout_account_holder} · {selected.payout_account_number}</div>
              </div>
              {docUrl && (
                <div className="border rounded p-2"><a href={docUrl} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1"><FileText className="w-4 h-4" />View verification document</a></div>
              )}
              <div>
                <Textarea placeholder="Rejection reason (required to reject)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="destructive" onClick={reject}><X className="w-4 h-4 mr-2" />Reject</Button>
                <Button onClick={approve}><Check className="w-4 h-4 mr-2" />Approve</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const AdminSellerApprovals = () => <AdminLayout><AdminSellerApprovalsContent /></AdminLayout>;
export default AdminSellerApprovals;