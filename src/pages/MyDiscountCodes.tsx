import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Percent } from "lucide-react";

export default function MyDiscountCodes() {
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [codes, setCodes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", discount_type: "percent", discount_value: 10, min_order_amount: 0, max_uses: "", expires_at: "" });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: s } = await supabase.from("stores").select("id").eq("user_id", user.id).maybeSingle();
      if (!s) return;
      setStoreId(s.id);
      const { data } = await supabase.from("discount_codes" as any).select("*").eq("store_id", s.id).order("created_at", { ascending: false });
      setCodes(data || []);
    })();
  }, [user]);

  const refresh = async () => {
    if (!storeId) return;
    const { data } = await supabase.from("discount_codes" as any).select("*").eq("store_id", storeId).order("created_at", { ascending: false });
    setCodes(data || []);
  };

  const create = async () => {
    if (!storeId || !form.code.trim()) { toast.error("Code is required"); return; }
    const { error } = await supabase.from("discount_codes" as any).insert({
      code: form.code.trim().toUpperCase(),
      scope: "store",
      store_id: storeId,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_order_amount: Number(form.min_order_amount) || 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null,
      created_by: user?.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Code created");
    setOpen(false);
    setForm({ code: "", discount_type: "percent", discount_value: 10, min_order_amount: 0, max_uses: "", expires_at: "" });
    refresh();
  };

  const remove = async (id: string) => {
    await supabase.from("discount_codes" as any).delete().eq("id", id);
    toast.success("Deleted"); refresh();
  };
  const toggle = async (id: string, active: boolean) => {
    await supabase.from("discount_codes" as any).update({ is_active: !active } as any).eq("id", id);
    refresh();
  };

  if (!storeId) return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Create a store first.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <SEO title="My Discount Codes" description="Manage discount codes for your store." />
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Percent className="w-7 h-7 text-primary" />My Discount Codes</h1>
            <p className="text-muted-foreground">Codes that buyers apply at checkout for your store.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />New code</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create discount code</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} placeholder="STUDENT10" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <Select value={form.discount_type} onValueChange={(v) => setForm({...form, discount_type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="percent">Percent (%)</SelectItem><SelectItem value="amount">Amount (R)</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Value</Label><Input type="number" value={form.discount_value} onChange={(e) => setForm({...form, discount_value: Number(e.target.value)})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Min order (R)</Label><Input type="number" value={form.min_order_amount} onChange={(e) => setForm({...form, min_order_amount: Number(e.target.value)})} /></div>
                  <div><Label>Max uses</Label><Input type="number" value={form.max_uses} onChange={(e) => setForm({...form, max_uses: e.target.value})} placeholder="Unlimited" /></div>
                </div>
                <div><Label>Expires at</Label><Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({...form, expires_at: e.target.value})} /></div>
                <Button className="w-full" onClick={create}>Create code</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card><CardContent className="p-0">
          {codes.length === 0 ? <p className="text-center py-8 text-muted-foreground">No codes yet</p> : (
            <div className="divide-y">
              {codes.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono font-bold text-lg">{c.code}</p>
                    <p className="text-xs text-muted-foreground">{c.discount_type === "percent" ? `${c.discount_value}% off` : `R${c.discount_value} off`} · used {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Active" : "Disabled"}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => toggle(c.id, c.is_active)}>{c.is_active ? "Disable" : "Enable"}</Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}