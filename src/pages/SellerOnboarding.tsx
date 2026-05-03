import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TUT_CAMPUSES } from "@/lib/campuses";
import { Loader2, Upload, ShieldCheck, ChevronRight, ChevronLeft, FileCheck2, Store as StoreIcon } from "lucide-react";

const TOTAL_STEPS = 4;

export default function SellerOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const docRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [existingStore, setExistingStore] = useState<any>(null);

  const [form, setForm] = useState({
    store_name: "",
    store_description: "",
    campus: "",
    contact_whatsapp: "",
    contact_email: "",
    id_number: "",
    student_number: "",
    payout_method: "bank",
    payout_bank_name: "",
    payout_account_number: "",
    payout_account_holder: "",
    payout_branch_code: "",
    terms_accepted: false,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("stores").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setExistingStore(data);
        setForm((f) => ({
          ...f,
          store_name: data.store_name || "",
          store_description: data.store_description || "",
          campus: data.campus || "",
          contact_whatsapp: data.contact_whatsapp || "",
          contact_email: data.contact_email || user.email || "",
        }));
      } else {
        setForm((f) => ({ ...f, contact_email: user.email || "" }));
      }
      setLoading(false);
    })();
  }, [user]);

  const upload = async (file: File, folder: string, bucket: string) => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${folder}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) { console.error(error); return null; }
    if (bucket === "store-assets") {
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }
    return path; // private
  };

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const validateStep = () => {
    if (step === 1 && !form.store_name.trim()) return "Store name is required";
    if (step === 2 && (!form.id_number.trim() || !form.student_number.trim())) return "ID and student number are required";
    if (step === 3 && (!form.payout_account_holder.trim() || !form.payout_account_number.trim())) return "Payout details are required";
    if (step === 4 && !form.terms_accepted) return "You must accept the seller terms";
    if (step === 4 && !docFile && !existingStore?.verification_doc_url) return "Verification document is required";
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    next();
  };

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    if (!user) return;
    setSubmitting(true);
    try {
      let logoUrl = existingStore?.store_logo_url || null;
      let docPath = existingStore?.verification_doc_url || null;
      if (logoFile) logoUrl = await upload(logoFile, "logo", "store-assets");
      if (docFile) docPath = await upload(docFile, "id_doc", "seller-kyc");

      const payload: any = {
        user_id: user.id,
        store_name: form.store_name.trim(),
        store_description: form.store_description.trim() || null,
        campus: form.campus || null,
        contact_whatsapp: form.contact_whatsapp.trim() || null,
        contact_email: form.contact_email.trim() || null,
        store_logo_url: logoUrl,
        id_number: form.id_number.trim(),
        student_number: form.student_number.trim(),
        payout_method: form.payout_method,
        payout_bank_name: form.payout_bank_name.trim() || null,
        payout_account_number: form.payout_account_number.trim(),
        payout_account_holder: form.payout_account_holder.trim(),
        payout_branch_code: form.payout_branch_code.trim() || null,
        verification_doc_url: docPath,
        terms_accepted_at: new Date().toISOString(),
        kyc_status: "pending",
        kyc_submitted_at: new Date().toISOString(),
        verified: false,
      };

      let storeId = existingStore?.id;
      if (existingStore) {
        const { error } = await supabase.from("stores").update(payload).eq("id", existingStore.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("stores").insert(payload).select("id").single();
        if (error) throw error;
        storeId = data.id;
      }

      await supabase.from("seller_kyc_log" as any).insert({
        store_id: storeId,
        action: existingStore ? "resubmitted" : "submitted",
        actor_id: user.id,
      } as any);

      toast.success("Application submitted! We'll review within 24–48h.");
      navigate("/my-store");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardLayout><div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <SEO title="Become a Seller | ResKonnect" description="Apply to sell on the ResKonnect student marketplace." />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-full bg-primary/10"><StoreIcon className="w-7 h-7 text-primary" /></div>
            <h1 className="text-2xl sm:text-3xl font-bold">Become a Seller</h1>
            <p className="text-muted-foreground">Sell to fellow students. Get paid weekly. Earn extra via referrals.</p>
            {existingStore?.kyc_status === "rejected" && (
              <Badge variant="destructive">Previous submission rejected — please update and resubmit</Badge>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {step} of {TOTAL_STEPS}</span>
              <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
            </div>
            <Progress value={(step / TOTAL_STEPS) * 100} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{["Store basics","Identity","Payout details","Verification & terms"][step-1]}</CardTitle>
              <CardDescription>{[
                "Tell buyers who you are.",
                "We need your ID & student number for KYC.",
                "Where to pay your earnings.",
                "Upload proof and accept the seller agreement.",
              ][step-1]}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label>Store name *</Label>
                    <Input value={form.store_name} onChange={(e) => setForm({...form, store_name: e.target.value})} placeholder="e.g. Soshanguve Sneakers" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea rows={3} value={form.store_description} onChange={(e) => setForm({...form, store_description: e.target.value})} placeholder="What you sell and why students should buy" />
                  </div>
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                    <Button type="button" variant="outline" onClick={() => logoRef.current?.click()}><Upload className="w-4 h-4 mr-2" />{logoFile ? logoFile.name : (existingStore?.store_logo_url ? "Replace logo" : "Upload logo")}</Button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Campus</Label>
                      <Select value={form.campus} onValueChange={(v) => setForm({...form, campus: v})}>
                        <SelectTrigger><SelectValue placeholder="Select campus" /></SelectTrigger>
                        <SelectContent>{TUT_CAMPUSES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp number</Label>
                      <Input value={form.contact_whatsapp} onChange={(e) => setForm({...form, contact_whatsapp: e.target.value})} placeholder="27712345678" />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label>SA ID Number *</Label>
                    <Input value={form.id_number} onChange={(e) => setForm({...form, id_number: e.target.value})} placeholder="13 digits" maxLength={13} />
                  </div>
                  <div className="space-y-2">
                    <Label>Student Number *</Label>
                    <Input value={form.student_number} onChange={(e) => setForm({...form, student_number: e.target.value})} placeholder="e.g. 21XXXXXXXX" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact email *</Label>
                    <Input type="email" value={form.contact_email} onChange={(e) => setForm({...form, contact_email: e.target.value})} />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="space-y-2">
                    <Label>Payout method</Label>
                    <Select value={form.payout_method} onValueChange={(v) => setForm({...form, payout_method: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bank account (EFT)</SelectItem>
                        <SelectItem value="ewallet">eWallet / cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.payout_method === "bank" && (
                    <>
                      <div className="space-y-2"><Label>Bank name</Label><Input value={form.payout_bank_name} onChange={(e) => setForm({...form, payout_bank_name: e.target.value})} placeholder="Capitec / FNB / Standard Bank…" /></div>
                      <div className="space-y-2"><Label>Branch code</Label><Input value={form.payout_branch_code} onChange={(e) => setForm({...form, payout_branch_code: e.target.value})} /></div>
                    </>
                  )}
                  <div className="space-y-2"><Label>Account holder *</Label><Input value={form.payout_account_holder} onChange={(e) => setForm({...form, payout_account_holder: e.target.value})} /></div>
                  <div className="space-y-2"><Label>{form.payout_method === "bank" ? "Account number *" : "Cell number *"}</Label><Input value={form.payout_account_number} onChange={(e) => setForm({...form, payout_account_number: e.target.value})} /></div>
                </>
              )}

              {step === 4 && (
                <>
                  <div className="space-y-2">
                    <Label>Verification document *</Label>
                    <p className="text-xs text-muted-foreground">Upload a clear photo of your SA ID, driver's licence, or student card.</p>
                    <input ref={docRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                    <Button type="button" variant="outline" onClick={() => docRef.current?.click()}>
                      <FileCheck2 className="w-4 h-4 mr-2" />{docFile ? docFile.name : (existingStore?.verification_doc_url ? "Replace document" : "Upload document")}
                    </Button>
                  </div>
                  <div className="rounded-md border p-4 bg-muted/30 space-y-2 text-sm">
                    <p className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Seller Agreement</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                      <li>You confirm products you list are legal and authentic.</li>
                      <li>ResKonnect charges a 10% platform fee per sale (configurable).</li>
                      <li>Orders must be fulfilled within 48 hours of confirmation.</li>
                      <li>Repeated cancellations or counterfeit listings will lead to suspension.</li>
                      <li>Payouts are processed weekly on Fridays.</li>
                    </ul>
                  </div>
                  <label className="flex items-start gap-2">
                    <Checkbox checked={form.terms_accepted} onCheckedChange={(v) => setForm({...form, terms_accepted: !!v})} />
                    <span className="text-sm">I have read and accept the seller agreement.</span>
                  </label>
                </>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" disabled={step === 1} onClick={prev}><ChevronLeft className="w-4 h-4 mr-2" />Back</Button>
                {step < TOTAL_STEPS ? (
                  <Button onClick={handleNext}>Next<ChevronRight className="w-4 h-4 ml-2" /></Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : <>Submit for review</>}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}