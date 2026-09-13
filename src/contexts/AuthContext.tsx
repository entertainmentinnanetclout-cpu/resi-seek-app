import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AppStaffRole, GOD_MODE_ROLES } from "@/lib/constants/roles";
import { AdminDepartmentKey } from "@/lib/adminDepartments";

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
  adminDepartments: AdminDepartmentKey[];
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

type AccessContext = {
  staff_role?: string | null;
  admin_departments?: string[] | null;
  is_recruiter?: boolean | null;
  is_pending_recruiter?: boolean | null;
  is_student?: boolean | null;
  is_tumelo_partner?: boolean | null;
  tumelo_partner_role?: TumeloPartnerRole;
};

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
  const [adminDepartments, setAdminDepartments] = useState<AdminDepartmentKey[]>([]);
  const [sessionChecked, setSessionChecked] = useState(false);
  const navigate = useNavigate();
  const initRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const identitySyncUserRef = useRef<string | null>(null);

  const clearAccessState = useCallback(() => {
    setIsAdmin(false);
    setIsGodMode(false);
    setStaffRole(null);
    setAdminDepartments([]);
    setIsRecruiter(false);
    setIsPendingRecruiter(false);
    setIsStudent(false);
    setIsTumeloPartner(false);
    setTumeloPartnerRole(null);
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      currentUserIdRef.current = nextSession?.user?.id ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setSessionChecked(true);
    };

    const initAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        applySession(existingSession);
      } catch (error) {
        console.error("[AuthContext] Initial session restore failed safely:", error);
        applySession(null);
      } finally {
        if (mounted) setSessionChecked(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      const nextUserId = nextSession?.user?.id ?? null;
      const identityChanged = currentUserIdRef.current !== nextUserId;
      currentUserIdRef.current = nextUserId;

      // Token refreshes keep the UI mounted. Only an identity boundary re-runs
      // access resolution and temporarily blocks protected routing.
      if (identityChanged && nextSession) setIsLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setSessionChecked(true);

      if (!nextSession && event === "SIGNED_OUT") {
        clearAccessState();
        setIsLoading(false);
      }
    });

    void initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearAccessState]);

  // Android/WebView can suspend JavaScript for long periods. Reconcile the
  // persisted Supabase session when the app becomes visible and proactively
  // refresh tokens that are close to expiry.
  useEffect(() => {
    let active = true;
    const reconcile = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const { data: { session: current } } = await supabase.auth.getSession();
        if (!active) return;
        if (!current) {
          currentUserIdRef.current = null;
          setSession(null);
          setUser(null);
          setSessionChecked(true);
          clearAccessState();
          setIsLoading(false);
          return;
        }

        const expiresAtMs = Number(current.expires_at || 0) * 1000;
        if (expiresAtMs && expiresAtMs - Date.now() < 120_000) {
          const { data, error } = await supabase.auth.refreshSession(current);
          if (error) throw error;
          if (active && data.session) {
            currentUserIdRef.current = data.session.user.id;
            setSession(data.session);
            setUser(data.session.user);
          }
          return;
        }

        currentUserIdRef.current = current.user.id;
        setSession(current);
        setUser(current.user);
        setSessionChecked(true);
      } catch (error) {
        // A transient network failure must never log a user out. Persisted
        // session state remains authoritative until Supabase reports SIGNED_OUT.
        console.warn("[AuthContext] Session resume check unavailable:", error);
      }
    };

    const onVisibility = () => { if (document.visibilityState === "visible") void reconcile(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", reconcile);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", reconcile);
    };
  }, [clearAccessState]);

  useEffect(() => {
    const userId = session?.user?.id;
    const accessToken = session?.access_token;
    if (!userId || !accessToken || identitySyncUserRef.current === userId) return;

    identitySyncUserRef.current = userId;
    void supabase.functions.invoke("identity-sync", {
      body: {},
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(({ error }) => {
      if (error) {
        identitySyncUserRef.current = null;
        console.warn("[AuthContext] Identity sync failed safely:", error.message);
      }
    }).catch((error) => {
      identitySyncUserRef.current = null;
      console.warn("[AuthContext] Identity sync unavailable:", error);
    });
  }, [session?.user?.id, session?.access_token]);

  const checkStatus = useCallback(async () => {
    if (!sessionChecked) return;
    if (!user) {
      clearAccessState();
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_my_access_context");
      if (error) throw error;
      const access = (data || {}) as AccessContext;

      const role = (access.staff_role || null) as StaffRole;
      const departments = Array.isArray(access.admin_departments) ? access.admin_departments as AdminDepartmentKey[] : [];
      const resolvedTumeloRole = access.tumelo_partner_role || null;
      const partnershipOnly = Boolean(access.is_tumelo_partner || resolvedTumeloRole);
      const isGod = Boolean(role && (GOD_MODE_ROLES as readonly string[]).includes(role));

      setStaffRole(role);
      setAdminDepartments(departments);
      setIsGodMode(isGod);
      setIsAdmin(isGod);
      setTumeloPartnerRole(resolvedTumeloRole);
      setIsTumeloPartner(partnershipOnly);
      setIsRecruiter(Boolean(access.is_recruiter));
      setIsPendingRecruiter(Boolean(access.is_pending_recruiter));
      setIsStudent(!partnershipOnly && Boolean(access.is_student));
    } catch (error) {
      // Preserve the authenticated session but fail closed on privileged roles.
      console.error("[AuthContext] Access context failed safely:", error);
      clearAccessState();
    } finally {
      setIsLoading(false);
    }
  }, [clearAccessState, sessionChecked, user]);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const signOut = async () => {
    await supabase.auth.signOut();
    currentUserIdRef.current = null;
    identitySyncUserRef.current = null;
    setUser(null);
    setSession(null);
    clearAccessState();
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
      adminDepartments,
      signOut,
      refreshProfile: checkStatus,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
