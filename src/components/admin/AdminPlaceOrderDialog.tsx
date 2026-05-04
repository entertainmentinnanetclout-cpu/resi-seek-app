import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  product: { id: string; name: string; price: number; store_id?: string } | null;
}

const AdminPlaceOrderDialog = ({ open, onClose, product }: Props) => {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");
  const [qty, setQty] = useState("1");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("cod");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const q = (supabase as any).from("profiles").select("id, full_name, email").limit(15);
      const { data } = search
        ? await q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
        : await q.order("created_at", { ascending: false });
      setStudents(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [search, open]);

  const submit = async () => {
    if (!product || !studentId) { toast.error("Pick a student"); return; }
    setSaving(true);
    try {
      const quantity = Math.max(1, parseInt(qty || "1", 10));
      const total = Number(product.price) * quantity;
      const orderNumber = `ADM-${Date.now().toString(36).toUpperCase()}`;
      const { data: order, error } = await (supabase as any)
        .from("shop_orders")
        .insert({
          user_id: studentId,
          order_number: orderNumber,
          total_amount: total,
          status: "pending",
          payment_status: "pending",
          payment_method: method,
          delivery_address: address,
          delivery_phone: phone,
          notes: notes || `Placed by admin for ${product.name}`,
        })
        .select("id")
        .single();
      if (error) throw error;
      await (supabase as any).from("shop_order_items").insert({
        order_id: order.id,
        product_id: product.id,
        store_id: product.store_id ?? null,
        quantity,
        unit_price: product.price,
      });
      toast.success("Order placed for student");
      onClose();
    } catch (e: any) {
      toast.error(`Failed: ${e.message || e}`);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Place Order on Behalf</DialogTitle>
          <DialogDescription>{product?.name} · R{Number(product?.price ?? 0).toFixed(2)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Student (search by name or email)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." />
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="Pick a student" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name || s.email} — {s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Qty</Label><Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div>
              <Label>Payment</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cod">Cash on Delivery</SelectItem>
                  <SelectItem value="eft">EFT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Delivery address</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !studentId}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
              Place Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPlaceOrderDialog;