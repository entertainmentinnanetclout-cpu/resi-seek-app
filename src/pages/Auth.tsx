import SEO from "@/components/SEO";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Chrome, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND } from "@/constants/brand";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, EXTERNAL_SUPABASE_ANON_KEY, externalFunctionUrl } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/lib/authErrors";
import { TUT_CAMPUSES } from "@/lib/campuses";
import { attachReferralToUser } from "@/lib/referrals/referralApi";
import { clearPendingApplication, clearPendingRecruiter, readPendingApplication, readPendingRecruiter, readReferral } from "@/lib/referrals/referralStorage";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Must contain an uppercase letter").regex(/[a-z]/, "Must contain a lowercase letter").regex(/[0-9]/, "Must contain a number");
const phoneSchema = z.string().regex(/^(\+27|0)[6-8][0-9]{8}$/, "Enter a valid South African mobile number");
const idSchema = z.string().regex(/^\d{13}$/, "Enter a valid 13-digit South African ID number");

const APPLICANT_STAGES = [
  ["university_student", "University student"],
  ["tvet_student", "TVET student"],
  ["matriculant", "Matriculant / Grade 12"],
  ["private_applicant", "Private college / other applicant"],
  ["other", "Other"],
] as const;

const HEARD_ABOUT_US_OPTIONS = [
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["facebook", "Facebook"],
  ["whatsapp", "WhatsApp"],
  ["youtube", "YouTube"],
  ["x_twitter", "X / Twitter"],
  ["linkedin", "LinkedIn"],
  ["snapchat", "Snapchat"],
  ["threads", "Threads"],
  ["telegram", "Telegram"],
  ["reddit", "Reddit"],
  ["pinterest", "Pinterest"],
  ["google_search", "Google / Search engine"],
  ["tut_campus", "TUT / Campus"],
  ["event_activation", "Event / Activation"],
  ["friend_word_of_mouth", "Friend / Word of mouth"],
  ["residence_landlord", "Residence / Landlord"],
  ["recruiter", "Recruiter / ResKonnect ambassador"],
  ["other", "Other"],
] as const;

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading, isGodMode, staffRole, isRecruiter, isPendingRecruiter } = useAuth();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampus, setSelectedCampus] = useState("");
  const [applicantStage, setApplicantStage] = useState("university_student");
  const [identifierType, setIdentifierType] = useState<"student_number" | "identity_number">("student_number");
  const [heardAboutUs, setHeardAboutUs] = useState("");
  const returnTo = searchParams.get("returnTo");
  const refCode = searchParams.get("ref");

  useEffect(() => {
    if (["tvet_student", "matriculant"].includes(applicantStage)) setIdentifierType("identity_number");
  }, [applicantStage]);

  useEffect(() => {
    if (authLoading || !user) return;
    const timer = setTimeout(async () => {
      const ref = readReferral();
      if (ref?.sessionId) { try { await attachReferralToUser(ref.sessionId); } catch {} }

      if (isGodMode) return navigate("/admin", { replace: true });
      if (staffRole === "tvet_lead") return navigate("/tvet-dashboard", { replace: true });
      if (staffRole && ["residence_admin", "building_admin", "office_admin"].includes(staffRole)) return navigate("/residence", { replace: true });

      const hasRecruiterIntent = readPendingRecruiter();
      if (hasRecruiterIntent || isRecruiter || isPendingRecruiter) {
        clearPendingRecruiter();
        return navigate(isRecruiter ? "/recruit/dashboard" : "/recruit/apply", { replace: true });
      }

      const pendingApp = readPendingApplication();
      if (pendingApp?.residence_id) {
        clearPendingApplication();
        try {
          const { data: existing } = await supabase.from("applications").select("id").eq("user_id", user.id).eq("residence_id", pendingApp.residence_id).maybeSingle();
          if (!existing) {
            const { data: inserted, error: insErr } = await supabase.from("applications").insert({
              user_id: user.id,
              residence_id: pendingApp.residence_id,
              status: "submitted",
              institution_type: (pendingApp as any).institution_type || "university",
            } as any).select("id").maybeSingle();
            if (!insErr && inserted?.id && (pendingApp.referral_code || pendingApp.referral_session_id)) {
              const { captureApplicationReferral } = await import("@/lib/referrals/referralApi");
              await captureApplicationReferral(inserted.id, pendingApp.referral_code || null, pendingApp.referral_session_id || null, "student_recruitment");
            }
          }
        } catch (e) { console.warn("auto-submit application failed", e); }
        return navigate(pendingApp.current_route || `/res/${pendingApp.residence_id}`, { replace: true });
      }
      navigate(returnTo || "/dashboard", { replace: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [user, authLoading, isGodMode, staffRole, isRecruiter, isPendingRecruiter, navigate, returnTo]);

  const identifierLabel = identifierType === "identity_number" ? "South African ID number" : "Student number";
  const campusOptions = useMemo(() => [
    ...TUT_CAMPUSES.map((campus) => ({ value: campus.value, label: campus.label })),
    { value: "TVET / College applicant", label: "TVET / College applicant" },
    { value: "Not yet selected", label: "Matriculant — campus not yet selected" },
    { value: "Private / Other institution", label: "Private / Other institution" },
  ], []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const email = z.string().email("Enter a valid email address").parse(String(form.get("email") || ""));
      const password = String(form.get("password") || "");
      if (isLogin) {
        z.string().min(1, "Password is required").parse(password);
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
        toast.success("Welcome back!");
      } else {
        const fullName = z.string().min(2, "Enter your full name").parse(String(form.get("fullName") || ""));
        passwordSchema.parse(password);
        const confirmPassword = String(form.get("confirmPassword") || "");
        if (password !== confirmPassword) throw new Error("Passwords don't match");
        const phoneNumber = phoneSchema.parse(String(form.get("phoneNumber") || ""));
        if (!selectedCampus) throw new Error("Select your campus or applicant context");
        if (!heardAboutUs) throw new Error("Select where you heard about ResKonnect");
        const identifierRaw = String(form.get("identifier") || "").trim();
        if (identifierType === "identity_number") idSchema.parse(identifierRaw);
        else z.string().min(5, "Enter a valid student number").parse(identifierRaw);
        const recruiterReference = heardAboutUs === "recruiter" ? String(form.get("recruiterReference") || "").trim() : "";

        const metadata = {
          full_name: fullName,
          phone: phoneNumber,
          campus: selectedCampus,
          applicant_stage: applicantStage,
          student_number: identifierType === "student_number" ? identifierRaw : null,
          identity_number: identifierType === "identity_number" ? identifierRaw : null,
          heard_about_us: heardAboutUs,
          recruiter_reference: recruiterReference || null,
        };
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth`, data: metadata },
        });
        if (signupError) throw signupError;

        if (refCode && data.user?.id) {
          try {
            await fetch(externalFunctionUrl("referral-capture"), {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: EXTERNAL_SUPABASE_ANON_KEY },
              body: JSON.stringify({ code: refCode, referred_user_id: data.user.id }),
            });
          } catch (e) { console.warn("referral capture failed", e); }
        }
        toast.success("Account created. Check your email if verification is required.");
        if (!data.session) setIsLogin(true);
      }
    } catch (err: any) {
      const message = err instanceof z.ZodError ? err.issues[0]?.message : getAuthErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}` } });
    if (oauthError) { toast.error(getAuthErrorMessage(oauthError)); setIsLoading(false); }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-4 py-10 sm:px-6">
      <SEO title="Sign In or Create Account | ResKonnect" description="Access accommodation, applications, reservations and opportunities through your ResKonnect account." />
      <div className="mx-auto w-full max-w-md">
        <div className="text-center"><img src={BRAND.logos.full} alt={BRAND.name} className="mx-auto h-16 w-auto object-contain" /><h1 className="mt-6 text-3xl font-black">{isLogin ? "Sign in to ResKonnect" : "Create your ResKonnect account"}</h1><p className="mt-2 text-sm text-muted-foreground">Accommodation, applications and opportunity — connected.</p></div>
        <Card className="mt-7 shadow-xl"><CardContent className="p-6 sm:p-8">
          {error && <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && <div className="space-y-2"><Label htmlFor="fullName">Full name *</Label><Input id="fullName" name="fullName" required autoComplete="name" placeholder="Your full name" /></div>}
            <div className="space-y-2"><Label htmlFor="email">Email address *</Label><Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></div>

            {!isLogin && <>
              <div className="space-y-2"><Label>I am a *</Label><Select value={applicantStage} onValueChange={setApplicantStage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{APPLICANT_STAGES.map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1.5"><Button type="button" size="sm" variant={identifierType === "student_number" ? "default" : "ghost"} onClick={() => setIdentifierType("student_number")}>Student number</Button><Button type="button" size="sm" variant={identifierType === "identity_number" ? "default" : "ghost"} onClick={() => setIdentifierType("identity_number")}>SA ID</Button></div>
              <div className="space-y-2"><Label htmlFor="identifier">{identifierLabel} *</Label><Input id="identifier" name="identifier" inputMode={identifierType === "identity_number" ? "numeric" : "text"} maxLength={identifierType === "identity_number" ? 13 : undefined} required placeholder={identifierType === "identity_number" ? "13-digit ID number" : "Student number"} /><p className="text-[11px] text-muted-foreground">TVET students and matriculants can use an SA ID when they do not yet have a student number.</p></div>
              <div className="space-y-2"><Label>Campus / study context *</Label><Select value={selectedCampus} onValueChange={setSelectedCampus}><SelectTrigger><SelectValue placeholder="Select campus or context" /></SelectTrigger><SelectContent>{campusOptions.map((campus) => <SelectItem key={campus.value} value={campus.value}>{campus.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="phoneNumber">Phone / WhatsApp number *</Label><Input id="phoneNumber" name="phoneNumber" inputMode="tel" required placeholder="0821234567" /></div>
              <div className="space-y-2">
                <Label>Where did you hear about us? *</Label>
                <Select value={heardAboutUs} onValueChange={setHeardAboutUs}>
                  <SelectTrigger><SelectValue placeholder="Select a source" /></SelectTrigger>
                  <SelectContent>{HEARD_ABOUT_US_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">This helps us understand which ResKonnect channels are reaching students.</p>
              </div>
              {heardAboutUs === "recruiter" && (
                <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                  <Label htmlFor="recruiterReference">Recruiter / ambassador name or code</Label>
                  <Input id="recruiterReference" name="recruiterReference" defaultValue={refCode || ""} placeholder="Name or recruiter code (if known)" maxLength={120} />
                  <p className="text-[11px] text-muted-foreground">Optional. If you were given a recruiter link or code, enter it here.</p>
                </div>
              )}
            </>}

            <div className="space-y-2"><Label htmlFor="password">Password *</Label><Input id="password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required placeholder="••••••••" /></div>
            {!isLogin && <><div className="space-y-2"><Label htmlFor="confirmPassword">Confirm password *</Label><Input id="confirmPassword" name="confirmPassword" type="password" required placeholder="••••••••" /></div><div className="flex items-start gap-3"><Checkbox id="terms" required /><Label htmlFor="terms" className="-mt-1 text-sm leading-6 text-muted-foreground">I agree to the <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy Policy</a>.</Label></div></>}
            <Button type="submit" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isLogin ? "Sign In" : "Create Account"}</Button>
          </form>

          {isLogin && <><div className="relative my-5"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or continue with</span></div></div><Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isLoading}><Chrome className="mr-2 h-5 w-5" />Sign in with Google</Button></>}
          <button type="button" onClick={() => { setIsLogin((v) => !v); setError(null); }} className="mt-5 w-full text-center text-sm font-semibold text-primary hover:underline">{isLogin ? "New here? Create an account" : "Already have an account? Sign in"}</button>
        </CardContent></Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">{BRAND.tagline}</p>
      </div>
    </div>
  );
};

export default Auth;
