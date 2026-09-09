import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Loader2, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  children: React.ReactNode;
}

type GateState = "checking" | "enroll" | "verify" | "ready" | "error";

type EnrolledFactor = {
  id: string;
  status?: string;
  friendly_name?: string | null;
};

type Enrollment = {
  id: string;
  totp?: {
    qr_code?: string;
    secret?: string;
    uri?: string;
  };
};

function normalizeQr(value?: string | null) {
  if (!value) return null;
  if (value.startsWith("data:image")) return value;
  if (value.trim().startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
  }
  return value;
}

function readAal(accessToken?: string | null): "aal1" | "aal2" | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded));
    return decoded?.aal === "aal2" ? "aal2" : decoded?.aal === "aal1" ? "aal1" : null;
  } catch {
    return null;
  }
}

export default function GodModeMfaGate({ children }: Props) {
  const { session } = useAuth();
  const tokenAal = useMemo(() => readAal(session?.access_token), [session?.access_token]);
  const [state, setState] = useState<GateState>(() => tokenAal === "aal2" ? "ready" : "checking");
  const [factor, setFactor] = useState<EnrolledFactor | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const verifySession = useCallback(async () => {
    // A signed Supabase access token already carries the authoritative AAL claim.
    // Backend RLS/RPC policies still enforce AAL2, so this optimization only
    // prevents unnecessary UI challenges and does not weaken authorization.
    if (readAal(session?.access_token) === "aal2") {
      setState("ready");
      setErrorMessage(null);
      return;
    }

    setState("checking");
    setErrorMessage(null);

    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;
    if (aal?.currentLevel === "aal2") {
      setState("ready");
      return;
    }

    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) throw factorError;

    const totp = ((factors as any)?.totp || []) as EnrolledFactor[];
    const verified = totp.find((entry) => entry.status === "verified") || null;
    if (verified) {
      setFactor(verified);
      setState("verify");
      return;
    }

    // Existing unverified factors cannot safely resume because the shared secret
    // is not returned again. Clear them before generating a fresh enrollment.
    for (const pending of totp.filter((entry) => entry.status !== "verified")) {
      try { await supabase.auth.mfa.unenroll({ factorId: pending.id }); } catch { /* best effort */ }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "ResKonnect God Mode",
    });
    if (error) throw error;
    setEnrollment(data as Enrollment);
    setFactor({ id: data.id, status: "unverified", friendly_name: "ResKonnect God Mode" });
    setState("enroll");
  }, [session?.access_token]);

  useEffect(() => {
    if (tokenAal === "aal2") {
      setState("ready");
      setErrorMessage(null);
      return;
    }

    let active = true;
    verifySession().catch((error) => {
      if (!active) return;
      console.error("[GodModeMfaGate] MFA initialization failed", error);
      setErrorMessage(error?.message || "Two-factor authentication could not initialize.");
      setState("error");
    });
    return () => { active = false; };
  }, [tokenAal, verifySession]);

  const submitCode = async () => {
    if (!factor?.id || !/^\d{6}$/.test(code)) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code,
      });
      if (error) throw error;

      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aal?.currentLevel !== "aal2") throw new Error("The session was not promoted to AAL2.");

      setCode("");
      setState("ready");
      toast.success("God Mode unlocked with two-factor authentication.");
    } catch (error: any) {
      setCode("");
      setErrorMessage(error?.message || "The verification code was not accepted.");
      toast.error("Two-factor verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/auth");
  };

  const qrCode = useMemo(() => normalizeQr(enrollment?.totp?.qr_code), [enrollment?.totp?.qr_code]);
  const secret = enrollment?.totp?.secret || "";

  if (state === "ready") return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:grid sm:place-items-center">
      <Card className="mx-auto w-full max-w-lg border-white/10 bg-slate-900 text-white shadow-2xl">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-300"><ShieldCheck className="h-6 w-6" /></div>
            <Badge className="border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">GOD MODE · AAL2 REQUIRED</Badge>
          </div>
          <div>
            <CardTitle className="text-2xl font-black text-white">Two-factor authentication</CardTitle>
            <CardDescription className="mt-2 text-slate-300">Privileged ResKonnect administration requires a password/session plus a time-based authenticator code.</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {state === "checking" && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" />Checking your security level…</div>
          )}

          {state === "enroll" && (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2"><Smartphone className="h-5 w-5 text-cyan-300" /><p className="font-bold">1. Add ResKonnect to your authenticator</p></div>
                <p className="mb-4 text-sm text-slate-300">Scan the QR code using Google Authenticator, Microsoft Authenticator, Authy, 1Password or another TOTP app.</p>
                {qrCode && <div className="mx-auto w-fit rounded-2xl bg-white p-3"><img src={qrCode} alt="ResKonnect God Mode authenticator QR code" className="h-52 w-52" /></div>}
                {secret && (
                  <div className="mt-4 rounded-xl bg-slate-950 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Manual setup secret</p>
                    <div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs text-cyan-200">{secret}</code><button type="button" onClick={() => { void navigator.clipboard.writeText(secret); toast.success("Secret copied"); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10" aria-label="Copy setup secret"><Copy className="h-4 w-4" /></button></div>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 font-bold">2. Enter the current 6-digit code</p>
                <div className="flex gap-2"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => { if (event.key === "Enter") void submitCode(); }} placeholder="000000" className="h-12 border-white/15 bg-white text-center text-xl font-black tracking-[0.35em] text-slate-950" /><Button onClick={() => void submitCode()} disabled={busy || code.length !== 6} className="h-12 bg-cyan-500 px-5 font-black text-slate-950 hover:bg-cyan-400">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}</Button></div>
              </div>
            </>
          )}

          {state === "verify" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-cyan-300" /><p className="font-bold">Authenticator challenge</p></div><p className="mt-2 text-sm text-slate-300">Open your authenticator app and enter the current six-digit ResKonnect code.</p></div>
              <div className="flex gap-2"><Input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => { if (event.key === "Enter") void submitCode(); }} placeholder="000000" className="h-12 border-white/15 bg-white text-center text-xl font-black tracking-[0.35em] text-slate-950" /><Button onClick={() => void submitCode()} disabled={busy || code.length !== 6} className="h-12 bg-cyan-500 px-5 font-black text-slate-950 hover:bg-cyan-400">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}</Button></div>
            </div>
          )}

          {state === "error" && (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4"><p className="font-bold text-red-200">2FA could not initialize</p><p className="mt-1 text-sm text-red-100/80">{errorMessage}</p><Button variant="outline" onClick={() => void verifySession()} className="mt-4 border-white/20 bg-white/5 text-white hover:bg-white/10">Retry</Button></div>
          )}

          {errorMessage && state !== "error" && <p className="text-sm text-red-300">{errorMessage}</p>}

          <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400"><span>God Mode remains locked until AAL2 is verified.</span><button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-1.5 font-bold text-slate-200 hover:text-white"><LogOut className="h-3.5 w-3.5" />Sign out</button></div>
        </CardContent>
      </Card>
    </div>
  );
}
