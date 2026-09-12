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
import { CheckCircle2, Loader2, MessageCircleMore, Phone, ShieldCheck } from "lucide-react";

const phonePattern = /^(\+27|0)[6-8][0-9]{8}$/;
const idPattern = /^\d{13}$/;
const STAGE_OPTIONS = [
  ["university_student", "University student"],
  ["tvet_student", "TVET student"],
  ["matriculant", "Matriculant / Grade 12"],
  ["private_applicant", "Private college / other applicant"],
  ["other", "Other"],
] as const;

export default function ContactDetailsGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coreComplete, setCoreComplete] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [authProvider, setAuthProvider] = useState("email");
  const [emailVerified, setEmailVerified] = useState(false);
  const [identifierType, setIdentifierType] = useState<"student_number" | "identity_number">("student_number");
  const [form, setForm] = useState({ full_name: "", phone: "", student_number: "", identity_number: "", campus: "", applicant_stage: "university_student" });
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("full_name,phone,student_number,identity_number,campus,applicant_stage,phone_verified_at,auth_provider,email_verified_at,security_level")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Contact gate profile load failed", error);
        setLoading(false);
        return;
      }

      const next = {
        full_name: data?.full_name || (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || "",
        phone: data?.phone || (user.user_metadata?.phone as string) || "",
        student_number: data?.student_number || (user.user_metadata?.student_number as string) || "",
        identity_number: data?.identity_number || (user.user_metadata?.identity_number as string) || "",
        campus: data?.campus || (user.user_metadata?.campus as string) || "",
        applicant_stage: data?.applicant_stage || (user.user_metadata?.applicant_stage as string) || "university_student",
      };

      const useId = Boolean(next.identity_number && !next.student_number) || ["tvet_student", "matriculant"].includes(next.applicant_stage);
      const hasCore = Boolean(next.full_name.trim() && phonePattern.test(next.phone.trim()) && next.campus.trim() && (next.student_number.trim() || idPattern.test(next.identity_number.trim())));

      setIdentifierType(useId ? "identity_number" : "student_number");
      setForm(next);
      setCoreComplete(hasCore);
      setPhoneVerified(Boolean(data?.phone_verified_at));
      setAuthProvider(data?.auth_provider || String(user.app_metadata?.provider || "email"));
      setEmailVerified(Boolean(data?.email_verified_at || user.email_confirmed_at));
      setLoading(false);
    };
    void load();
  }, [user]);

  const validIdentifier = identifierType === "student_number" ? form.student_number.trim().length >= 5 : idPattern.test(form.identity_number.trim());
  const valid = useMemo(
    () => Boolean(form.full_name.trim().length >= 2 && phonePattern.test(form.phone.trim()) && validIdentifier && form.campus && form.applicant_stage),
    [form, validIdentifier],
  );

  const startVerification = async (phone = form.phone) => {
    setSendingCode(true);
    setCode("");
    const { data, error } = await supabase.functions.invoke("phone-whatsapp-verification", {
      body: { action: "start", phone: phone.trim() },
    });
    setSendingCode(false);

    if (error || data?.error) {
      const message = data?.message || error?.message || "Could not send the WhatsApp verification code.";
      toast.error(message);
      return false;
    }

    if (data?.already_verified) {
      setPhoneVerified(true);
      toast.success("Your WhatsApp number is already verified.");
      return true;
    }

    setMaskedPhone(data?.phone_masked || "your WhatsApp number");
    setCodeSent(true);
    toast.success("Verification code sent to WhatsApp.");
    return true;
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the 6-digit code sent to WhatsApp.");
      return;
    }
    setVerifyingCode(true);
    const { data, error } = await supabase.functions.invoke("phone-whatsapp-verification", {
      body: { action: "verify", phone: form.phone.trim(), code },
    });
    setVerifyingCode(false);

    if (error || data?.error || !data?.phone_verified) {
      const message = data?.message || error?.message || "The verification code was not accepted.";
      toast.error(message);
      setCode("");
      return;
    }

    setPhoneVerified(true);
    setCode("");
    toast.success("WhatsApp number verified. Your contact identity is secured.");
  };

  const save = async () => {
    if (!user || !valid) {
      toast.error(identifierType === "identity_number"
        ? "Please enter all required details and a valid 13-digit South African ID number."
        : "Please complete all required contact details with a valid student number and South African phone number.");
      return;
    }

    setSaving(true);
    const { error } = await (supabase as any).from("profiles").upsert({
      id: user.id,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      student_number: identifierType === "student_number" ? form.student_number.trim() : null,
      identity_number: identifierType === "identity_number" ? form.identity_number.trim() : null,
      campus: form.campus,
      applicant_stage: form.applicant_stage,
      email: user.email || "",
    }, { onConflict: "id" });
    setSaving(false);

    if (error) {
      toast.error(error.message || "Could not save your contact details.");
      return;
    }

    setCoreComplete(true);
    setPhoneVerified(false);
    toast.success("Profile saved. One security step remains.");
    await startVerification(form.phone);
  };

  if (loading) return <>{children}</>;

  const open = !coreComplete || !phoneVerified;

  return (
    <>
      {children}
      <Dialog open={open}>
        <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          {!coreComplete ? (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Phone className="h-6 w-6" /></div>
                <DialogTitle>Complete your ResKonnect identity</DialogTitle>
                <DialogDescription>
                  We use your verified sign-in identity plus the minimum institutional details needed for accommodation, applications and student services.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {(authProvider === "google" || emailVerified) && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    <div><p className="text-sm font-bold">{authProvider === "google" ? "Google identity connected" : "Email identity verified"}</p><p className="text-[11px] text-muted-foreground">{user?.email}</p></div>
                  </div>
                )}

                <div className="space-y-1.5"><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="Your full name" /></div>
                <div className="space-y-1.5"><Label>Phone / WhatsApp number *</Label><Input inputMode="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="0821234567" /></div>
                <div className="space-y-1.5"><Label>I am a *</Label><Select value={form.applicant_stage} onValueChange={(applicant_stage) => { setForm((p) => ({ ...p, applicant_stage })); if (["tvet_student","matriculant"].includes(applicant_stage) && !form.student_number) setIdentifierType("identity_number"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STAGE_OPTIONS.map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1.5"><Button type="button" size="sm" variant={identifierType === "student_number" ? "default" : "ghost"} onClick={() => setIdentifierType("student_number")}>Student number</Button><Button type="button" size="sm" variant={identifierType === "identity_number" ? "default" : "ghost"} onClick={() => setIdentifierType("identity_number")}>SA ID</Button></div>

                {identifierType === "student_number"
                  ? <div className="space-y-1.5"><Label>Student number *</Label><Input value={form.student_number} onChange={(e) => setForm((p) => ({ ...p, student_number: e.target.value }))} placeholder="Student number" /></div>
                  : <div className="space-y-1.5"><Label>South African ID number *</Label><Input inputMode="numeric" maxLength={13} value={form.identity_number} onChange={(e) => setForm((p) => ({ ...p, identity_number: e.target.value.replace(/\D/g, "").slice(0,13) }))} placeholder="13-digit ID number" /><p className="text-[11px] text-muted-foreground">Use this option when you do not yet have a student number.</p></div>}

                <div className="space-y-1.5"><Label>Campus / study context *</Label><Select value={form.campus} onValueChange={(campus) => setForm((p) => ({ ...p, campus }))}><SelectTrigger><SelectValue placeholder="Select campus or applicant context" /></SelectTrigger><SelectContent>{TUT_CAMPUSES.map((campus) => <SelectItem key={campus.value} value={campus.value}>{campus.label}</SelectItem>)}<SelectItem value="TVET / College applicant">TVET / College applicant</SelectItem><SelectItem value="Not yet selected">Matriculant — campus not yet selected</SelectItem><SelectItem value="Private / Other institution">Private / Other institution</SelectItem></SelectContent></Select></div>

                <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-primary" />ResKonnect does not request your Gmail, Drive, contacts or unrelated Google data. Institutional identifiers remain protected profile information.</div>
                <Button className="w-full" onClick={() => void save()} disabled={!valid || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save & verify WhatsApp</Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"><MessageCircleMore className="h-6 w-6" /></div>
                <DialogTitle>Verify your WhatsApp number</DialogTitle>
                <DialogDescription>
                  This one-time verification confirms that you control the contact number used for applications, reservations and service updates.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">WhatsApp verification</p><p className="mt-1 text-xs text-muted-foreground">{maskedPhone || form.phone}</p></div><ShieldCheck className="h-5 w-5 text-primary" /></div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">Codes expire after 10 minutes. Requests and failed attempts are rate-limited to protect your account from bots and credential abuse.</p>
                </div>

                {!codeSent ? (
                  <Button className="w-full" onClick={() => void startVerification()} disabled={sendingCode}>{sendingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send code on WhatsApp</Button>
                ) : (
                  <>
                    <div className="space-y-2"><Label>6-digit WhatsApp code</Label><Input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g,"").slice(0,6))} onKeyDown={(e) => { if (e.key === "Enter") void verifyCode(); }} className="h-14 text-center text-xl font-black tracking-[0.35em]" placeholder="000000" /></div>
                    <Button className="w-full" onClick={() => void verifyCode()} disabled={verifyingCode || code.length !== 6}>{verifyingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify & continue</Button>
                    <Button variant="ghost" className="w-full" onClick={() => void startVerification()} disabled={sendingCode}>{sendingCode ? "Sending…" : "Resend code"}</Button>
                  </>
                )}

                <button type="button" onClick={() => { setCoreComplete(false); setCodeSent(false); setCode(""); }} className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground">Use a different number</button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
