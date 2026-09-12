import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type VerificationStatus = {
  phone?: string;
  phone_verified?: boolean;
  phone_verified_at?: string | null;
  security_level?: string;
  already_verified?: boolean;
  expires_at?: string;
  phone_masked?: string;
  attempts_remaining?: number;
};

type Props = {
  phone?: string | null;
  onVerified?: (status: VerificationStatus) => void;
  compact?: boolean;
};

const normalizePhone = (value = "") => {
  const digits = value.replace(/\D/g, "");
  if (/^27[6-8]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[6-8]\d{8}$/.test(digits)) return `+27${digits.slice(1)}`;
  if (/^[6-8]\d{8}$/.test(digits)) return `+27${digits}`;
  return "";
};

const maskPhone = (value = "") => {
  const normalized = normalizePhone(value);
  return normalized ? `+27 •• ••• ${normalized.slice(-4)}` : "your saved WhatsApp number";
};

async function invokeVerification(action: "status" | "start" | "verify", payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("phone-whatsapp-verification", {
    body: { action, ...payload },
  });

  if (error) {
    let message = "We could not complete phone verification right now.";
    const response = (error as any)?.context;
    if (response?.clone) {
      try {
        const body = await response.clone().json();
        if (typeof body?.message === "string" && body.message.length < 220) message = body.message;
      } catch {
        // Keep the safe client-facing message.
      }
    }
    throw new Error(message);
  }

  if ((data as any)?.error) {
    throw new Error((data as any)?.message || "Phone verification could not be completed.");
  }

  return (data || {}) as VerificationStatus;
}

export default function WhatsAppPhoneVerification({ phone, onVerified, compact = false }: Props) {
  const savedPhone = useMemo(() => normalizePhone(phone || ""), [phone]);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [challengeSent, setChallengeSent] = useState(false);
  const [code, setCode] = useState("");

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const next = await invokeVerification("status");
      setStatus(next);
      if (next.phone_verified) setChallengeSent(false);
    } catch (error) {
      console.warn("Phone verification status unavailable", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const start = async () => {
    if (!savedPhone) {
      toast.error("Save a valid South African phone / WhatsApp number first.");
      return;
    }

    setSending(true);
    try {
      const next = await invokeVerification("start", { phone: savedPhone });
      if (next.phone_verified || next.already_verified) {
        const verifiedStatus = { ...status, ...next, phone_verified: true };
        setStatus(verifiedStatus);
        onVerified?.(verifiedStatus);
        toast.success("WhatsApp number already verified.");
        return;
      }
      setStatus((current) => ({ ...current, ...next }));
      setChallengeSent(true);
      setCode("");
      toast.success("Verification code sent to WhatsApp.");
    } catch (error: any) {
      toast.error(error?.message || "Could not send the WhatsApp verification code.");
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    const cleanCode = code.replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(cleanCode)) {
      toast.error("Enter the 6-digit code sent to WhatsApp.");
      return;
    }

    setVerifying(true);
    try {
      const next = await invokeVerification("verify", { phone: savedPhone, code: cleanCode });
      setStatus(next);
      setChallengeSent(false);
      setCode("");
      onVerified?.(next);
      toast.success("WhatsApp number verified. Contact trust upgraded.");
    } catch (error: any) {
      toast.error(error?.message || "That verification code could not be confirmed.");
    } finally {
      setVerifying(false);
    }
  };

  const verified = Boolean(status?.phone_verified);

  return (
    <div className={`overflow-hidden rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50/80 via-background to-background shadow-sm dark:border-amber-500/30 dark:from-amber-950/15 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#128C7E]">
          {verified ? <CheckCircle2 className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black">{verified ? "WhatsApp verified" : "Verify phone ownership"}</p>
            <span className="rounded-full border border-amber-300/70 bg-amber-100/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
              Security
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {verified
              ? `${maskPhone(status?.phone || savedPhone)} is contact-verified for this account.`
              : `We send a one-time 6-digit code to ${maskPhone(savedPhone)} via WhatsApp.`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking verification status…
        </div>
      ) : verified ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">Contact trust level active</p>
            <p className="text-xs text-muted-foreground">
              {status?.phone_verified_at
                ? `Verified ${new Date(status.phone_verified_at).toLocaleDateString()}.`
                : "Phone ownership has been confirmed."}{" "}
              Verification does not replace stronger MFA for privileged staff actions.
            </p>
          </div>
        </div>
      ) : challengeSent ? (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="whatsapp-security-code" className="text-sm font-semibold">
              WhatsApp verification code
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="whatsapp-security-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="pl-9 text-center text-lg font-black tracking-[0.28em]"
                />
              </div>
              <Button type="button" onClick={() => void verify()} disabled={verifying || code.length !== 6}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Codes expire after 10 minutes and verification attempts are rate-limited.</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => void start()} disabled={sending}>
              {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Resend
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button type="button" className="w-full bg-[#128C7E] text-white hover:bg-[#0f776c]" onClick={() => void start()} disabled={sending || !savedPhone}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
            Send code on WhatsApp
          </Button>
          {!savedPhone && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Save a valid South African phone number before starting verification.</p>}
        </div>
      )}
    </div>
  );
}
