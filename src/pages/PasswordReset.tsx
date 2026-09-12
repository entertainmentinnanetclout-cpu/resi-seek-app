import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/constants/brand";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { clearWeakPassword } from "@/lib/passwordSecurity";
import { getAuthErrorMessage } from "@/lib/authErrors";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/[0-9]/, "Include at least one number");

const safeLocalReturnPath = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

export default function PasswordReset() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const returnTo = useMemo(() => safeLocalReturnPath(searchParams.get("returnTo")) || "/dashboard", [searchParams]);
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const requestReset = async () => {
    const parsed = z.string().email("Enter a valid email address").safeParse(email.trim());
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth?mode=password-reset&returnTo=${encodeURIComponent(returnTo)}`;
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });
      if (error) throw error;
      setEmailSent(true);
      toast.success("If this email is registered, a secure password reset link has been sent.");
    } catch (error) {
      toast.error(getAuthErrorMessage(error, "Could not send a password reset email."));
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast.error("Open the secure link from your reset email first.");
      return;
    }

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Choose a stronger password.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      clearWeakPassword(user.id);
      setPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully. Your account remains signed in.");
      navigate(returnTo, { replace: true });
    } catch (error) {
      toast.error(getAuthErrorMessage(error, "Could not update your password."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <SEO title="Secure Your Password | ResKonnect" description="Securely update or recover your ResKonnect password." noIndex />
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src={BRAND.logos.full} alt={BRAND.name} className="mx-auto h-14 w-auto object-contain" />
          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
            <ShieldCheck className="h-3.5 w-3.5" /> Account security
          </div>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>{user ? "Choose a new password" : "Reset your password"}</CardTitle>
            <CardDescription>
              {user
                ? "You are already authenticated. Updating the password here does not delete your account, profile or application history."
                : "Enter your account email and we will send a secure recovery link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <form onSubmit={updatePassword} className="space-y-4">
                <div className="rounded-xl border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                  <KeyRound className="mr-1.5 inline h-4 w-4 text-primary" />
                  Existing users are not forced out when leaked-password protection is enabled. This page lets you replace a flagged password safely.
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  <p className="text-[11px] text-muted-foreground">Use 8+ characters with uppercase, lowercase and a number. Supabase will also reject known leaked passwords.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirm new password</Label>
                  <Input id="confirm-new-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update password
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">Email address</Label>
                  <Input id="recovery-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                </div>
                <Button className="w-full" onClick={() => void requestReset()} disabled={busy || emailSent}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  {emailSent ? "Recovery email sent" : "Send secure reset link"}
                </Button>
                {emailSent && <p className="text-center text-xs text-muted-foreground">Check your inbox and open the latest ResKonnect recovery link on this device.</p>}
              </div>
            )}

            <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => navigate(user ? returnTo : "/auth", { replace: true })}>
              {user ? "Keep current password for now" : "Back to sign in"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
