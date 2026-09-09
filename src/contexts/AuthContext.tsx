import { createContext, useContext, useEffect, useState, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AppStaffRole, GOD_MODE_ROLES } from "@/lib/constants/roles";

export type StaffRole = AppStaffRole | null;
export type TumeloPartnerRole = "owner" | "strategist" | "viewer" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  isGodMode: boolean;
  isRecruiter: boolean;
  isPendingRecruiter: boolean;
  isStudent: boolean;
  isTumeloPartner: boolean;
  tumeloPartnerRole: TumeloPartnerRole;
  staffRole: StaffRole;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGodMode, setIsGodMode] = useState(false);
  const [isRecruiter, setIsRecruiter] = useState(false);
  const [isPendingRecruiter, setIsPendingRecruiter] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const [isTumeloPartner, setIsTumeloPartner] = useState(false);
  const [tumeloPartnerRole, setTumeloPartnerRole] = useState<TumeloPartnerRole>(null);
  const [staffRole, setStaffRole] = useState<StaffRole>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const navigate = useNavigate();
  const initRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (existingSession) {
          currentUserIdRef.current = existingSession.user.id;
          setSession(existingSession);
          setUser(existingSession.user);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        if (mounted) setSessionChecked(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      const nextUserId = nextSession?.user?.id ?? null;
      const identityChanged = currentUserIdRef.current !== nextUserId;
      currentUserIdRef.current = nextUserId;

      // TOKEN_REFRESHED is a normal background security event. It must update the
      // tokens without tearing down the authenticated UI or remounting MFA gates.
      // Only an actual identity/session boundary blocks the app for role resolution.
      if (identityChanged && nextSession) setIsLoading(true);

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setSessionChecked(true);

      if (!nextSession && event === "SIGNED_OUT") {
        setIsLoading(false);
      }
    });

    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkStatus = async () => {
    if (!sessionChecked) return;
    if (!user) {
      setIsAdmin(false);
      setIsGodMode(false);
      setStaffRole(null);
      setIsRecruiter(false);
      setIsPendingRecruiter(false);
      setIsStudent(false);
      setIsTumeloPartner(false);
      setTumeloPartnerRole(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [roleRes, recruiterRes, pendingRes, profileRes, tumeloRoleRes] = await Promise.all([
        supabase.rpc("get_user_staff_role", { _user_id: user.id }),
        supabase.from("referral_agents" as any).select("status").eq("user_id", user.id).eq("program_key", "student_recruitment").maybeSingle(),
        supabase.from("recruiter_applications" as any).select("status").eq("user_id", user.id).eq("program_key", "student_recruitment").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("profiles").select("student_number").eq("id", user.id).maybeSingle(),
        (supabase as any).rpc("get_my_partnership_role", { p_slug: "tumelo-career-education" }),
      ]);

      if (roleRes.error) throw roleRes.error;
      if (tumeloRoleRes.error && String(tumeloRoleRes.error?.code || "") !== "PGRST202") throw tumeloRoleRes.error;

      const role = (roleRes.data as string | null) as StaffRole;
      setStaffRole(role);

      const isGod = !!role && (GOD_MODE_ROLES as readonly string[]).includes(role);
      setIsGodMode(isGod);
      setIsAdmin(isGod);

      const resolvedTumeloRole = (tumeloRoleRes.data as TumeloPartnerRole) || null;
      const partnershipOnly = !!resolvedTumeloRole;
      setTumeloPartnerRole(resolvedTumeloRole);
      setIsTumeloPartner(partnershipOnly);

      setIsRecruiter((recruiterRes.data as any)?.status === "approved");
      setIsPendingRecruiter((pendingRes.data as any)?.status === "pending");
      // Partnership ownership is authoritative. Even if an old profile value is
      // accidentally reintroduced, the account never becomes a student in-app.
      const resolvedStudent = !partnershipOnly && !!profileRes.data?.student_number;
      setIsStudent(resolvedStudent);

      console.log("[AuthContext] Status check:", {
        email: user.email,
        resolvedRole: role,
        tumeloPartnerRole: resolvedTumeloRole,
        isRecruiter: (recruiterRes.data as any)?.status === "approved",
        isPendingRecruiter: (pendingRes.data as any)?.status === "pending",
        isStudent: resolvedStudent,
      });
    } catch (e) {
      console.error("[AuthContext] Status check failed:", e);
      setIsTumeloPartner(false);
      setTumeloPartnerRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [user?.id, sessionChecked]);

  const signOut = async () => {
    await supabase.auth.signOut();
    currentUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsGodMode(false);
    setStaffRole(null);
    setIsRecruiter(false);
    setIsPendingRecruiter(false);
    setIsStudent(false);
    setIsTumeloPartner(false);
    setTumeloPartnerRole(null);
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isAdmin,
      isGodMode,
      isRecruiter,
      isPendingRecruiter,
      isStudent,
      isTumeloPartner,
      tumeloPartnerRole,
      staffRole,
      signOut,
      refreshProfile: checkStatus,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
