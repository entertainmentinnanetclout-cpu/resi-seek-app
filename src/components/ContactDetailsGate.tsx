import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TUT_CAMPUSES } from "@/lib/campuses";
import { toast } from "sonner";
import { Loader2, Phone, ShieldCheck } from "lucide-react";

const phonePattern = /^(\+27|0)[6-8][0-9]{8}$/;

export default function ContactDetailsGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", student_number: "", campus: "" });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase.from("profiles").select("full_name,phone,student_number,campus").eq("id", user.id).maybeSingle();
      if (error) {
        console.error("Contact gate profile load failed", error);
        setLoading(false);
        return;
      }
      const next = {
        full_name: data?.full_name || (user.user_metadata?.full_name as string) || "",
        phone: data?.phone || (user.user_metadata?.phone as string) || "",
        student_number: data?.student_number || (user.user_metadata?.student_number as string) || "",
        campus: data?.campus || (user.user_metadata?.campus as string) || "",
      };
      setForm(next);
      setComplete(Boolean(next.full_name.trim() && next.phone.trim() && next.student_number.trim() && next.campus.trim()));
      setLoading(false);
    };
    void load();
  }, [user]);

  const valid = useMemo(() => Boolean(form.full_name.trim().length >= 2 && phonePattern.test(form.phone.trim()) && form.student_number.trim().length >= 5 && form.campus), [form]);

  const save = async () => {
    if (!user || !valid) {
      toast.error("Please complete all required contact details with a valid South African phone number.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      student_number: form.student_number.trim(),
      campus: form.campus,
      email: user.email || null,
    } as any, { onConflict: "id" });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not save your contact details.");
      return;
    }
    setComplete(true);
    toast.success("Contact details saved. Your ResKonnect profile is ready.");
  };

  if (loading) return <>{children}</>;

  return (
    <>
      {children}
      <Dialog open={!complete}>
        <DialogContent className="max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Phone className="h-6 w-6" /></div>
            <DialogTitle>Complete your contact details</DialogTitle>
            <DialogDescription>ResKonnect requires verified contact details so accommodation reservations, application updates and landlord follow-ups can reach you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="Your full name" /></div>
            <div className="space-y-1.5"><Label>Phone / WhatsApp number *</Label><Input inputMode="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="0821234567" /><p className="text-[11px] text-muted-foreground">Use a South African mobile number that landlords and ResKonnect can reach.</p></div>
            <div className="space-y-1.5"><Label>Student number *</Label><Input value={form.student_number} onChange={(e) => setForm((p) => ({ ...p, student_number: e.target.value }))} placeholder="Student number" /></div>
            <div className="space-y-1.5"><Label>Campus *</Label><Select value={form.campus} onValueChange={(campus) => setForm((p) => ({ ...p, campus }))}><SelectTrigger><SelectValue placeholder="Select your campus" /></SelectTrigger><SelectContent>{TUT_CAMPUSES.map((campus) => <SelectItem key={campus.value} value={campus.value}>{campus.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-primary" />These details are stored on your ResKonnect profile and used for service communication and application/reservation follow-up.</div>
            <Button className="w-full" onClick={() => void save()} disabled={!valid || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save & continue</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
