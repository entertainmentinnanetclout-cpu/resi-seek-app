import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AppStaffRole, GOD_MODE_ROLES } from "@/lib/constants/roles";
import { AdminDepartmentKey } from "@/lib/adminDepartments";
import { unregisterNativePushToken } from "@/lib/nativePush";
import { useQueryClient } from "@tanstack/react-query";

export type StaffRole = AppStaffRole | null;
export type TumeloPartnerRole = "owner" | "strategist" | "viewer" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  accessError: boolean;
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
  const [accessError, setAccessError] = useState(false);
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
  const queryClient = useQueryClient();
  const accessRequestRef = useRef(0);
  const accessAbortRef = useRef<AbortController | null>(null);
  const [accessFailureCount, setAccessFailureCount] = useState(0);
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
    let mounted = true;
    let authEventReceived = false;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      currentUserIdRef.current = nextSession?.user?.id ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setSessionChecked(true);
    };

    const initAuth = async () => {
      try {
        const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();
        // A transient Auth/DB failure is not proof that the user signed out.
        if (sessionError) throw sessionError;
        if (!authEventReceived) applySession(existingSession);
      } catch (error) {
        console.error("[AuthContext] Initial session restore failed safely:", error);
        // Do not overwrite a previously delivered session with a fabricated
        // signed-out state when the Auth API/database is temporarily unavailable.
        // The focus/online reconciler may recover the persisted session later.
      } finally {
        if (mounted) setSessionChecked(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      authEventReceived = true;
      const nextUserId = nextSession?.user?.id ?? null;
      const identityChanged = currentUserIdRef.current !== nextUserId;
      if (identityChanged) {
        accessAbortRef.current?.abort(new DOMException("Account changed", "AbortError"));
        accessAbortRef.current = null;
        accessRequestRef.current += 1;
        setAccessFailureCount(0);
        queryClient.clear();
        clearAccessState();
        setAccessError(false);
      }
      currentUserIdRef.current = nextUserId;

      // Token refreshes keep the UI mounted. Only an identity boundary re-runs
      // access resolution and temporarily blocks protected routing.
      if (identityChanged && nextSession) setIsLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setSessionChecked(true);

      if (!nextSession && event === "SIGNED_OUT") {
        accessAbortRef.current?.abort(new DOMException("Signed out", "AbortError"));
        accessAbortRef.current = null;
        accessRequestRef.current += 1;
        identitySyncUserRef.current = null;
        clearAccessState();
        setAccessError(false);
        setIsLoading(false);
      }
    });

    void initAuth();

    return () => {
      mounted = false;
      accessAbortRef.current?.abort(new DOMException("Auth provider unmounted", "AbortError"));
      accessAbortRef.current = null;
      subscription.unsubscribe();
    };
  }, [clearAccessState, queryClient]);

  // Android/WebView can suspend JavaScript for long periods. Reconcile the
  // persisted Supabase session when the app becomes visible, without
  // launching a competing manual refresh request.
  useEffect(() => {
    let active = true;
    let reconciling = false;
    const reconcile = async () => {
      if (document.visibilityState === "hidden" || reconciling) return;
      reconciling = true;
      try {
        const { data: { session: current }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        if (!current) {
          currentUserIdRef.current = null;
          setSession(null);
          setUser(null);
          setSessionChecked(true);
          clearAccessState();
          setAccessError(false);
          setIsLoading(false);
          return;
        }

        // getSession refreshes tokens when necessary; the browser client also
        // handles foreground auto-refresh. Avoid a second manual refresh call
        // on every app focus, which can contend for one-use refresh tokens
        // when PostgreSQL/Auth is degraded.
        currentUserIdRef.current = current.user.id;
        setSession(current);
        setUser(current.user);
        setSessionChecked(true);
      } catch (error) {
        // A transient network failure must never log a user out. Persisted
        // session state remains authoritative until Supabase reports SIGNED_OUT.
        console.warn("[AuthContext] Session resume check unavailable:", error);
      } finally {
        reconciling = false;
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

  // Identity enrichment is nonessential to credential validation. Run only
  // after the authenticated access-context RPC has succeeded, and defer it
  // briefly so it cannot compete with the critical sign-in database work.
  useEffect(() => {
    const userId = session?.user?.id;
    const accessToken = session?.access_token;
    if (!userId || !accessToken || !sessionChecked || isLoading || accessError ||
        identitySyncUserRef.current === userId) return;

    const timer = window.setTimeout(() => {
      if (identitySyncUserRef.current === userId || !navigator.onLine) return;
      identitySyncUserRef.current = userId;
      void supabase.functions.invoke("identity-sync", {
        body: {},
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(({ error }) => {
        if (error) {
          identitySyncUserRef.current = null;
          console.warn("[AuthContext] Deferred identity sync unavailable:", error.message);
        }
      }).catch((error) => {
        identitySyncUserRef.current = null;
        console.warn("[AuthContext] Deferred identity sync unavailable:", error);
      });
    }, 8_000);

    return () => window.clearTimeout(timer);
  }, [session?.user?.id, session?.access_token, sessionChecked, isLoading, accessError]);

  const userId = user?.id;
  const checkStatus = useCallback(async () => {
    if (!sessionChecked) return;
    const requestId = ++accessRequestRef.current;
    accessAbortRef.current?.abort(new DOMException("Superseded by a newer account check", "AbortError"));
    accessAbortRef.current = null;
    if (!userId) {
      clearAccessState();
      setAccessError(false);
      setAccessFailureCount(0);
      setIsLoading(false);
      return;
    }

    // Keep a previous failure visible while a retry is in progress. Users
    // must still see Retry / Sign in options, not a brand-new blank spinner.
    setIsLoading(true);
    const controller = new AbortController();
    accessAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(
      new DOMException("Account permissions timed out. Your session remains saved.", "TimeoutError")
    ), 29_000);
    try {
      const { data, error } = await (supabase as any).rpc("get_my_access_context").abortSignal(controller.signal);
      if (requestId !== accessRequestRef.current || currentUserIdRef.current !== userId) return;
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data) ||
        typeof (data as AccessContext).is_student !== "boolean") {
        throw new Error("The account permissions service returned an incomplete result.");
      }
      const access = data as AccessContext;

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
      setAccessFailureCount(0);
      setAccessError(false);
    } catch (error) {
      if (requestId !== accessRequestRef.current || currentUserIdRef.current !== userId) return;
      // Preserve both the authenticated session and the last successfully
      // resolved access context. Clearing roles on a transient network failure
      // can misroute staff/partners into student surfaces. Route guards fail
      // closed while accessError is true and expose an explicit retry instead.
      console.warn("[AuthContext] Account check temporarily unavailable; retry is scheduled:", error);
      setAccessFailureCount(count => Math.min(count + 1, 12));
      setAccessError(true);
    } finally {
      window.clearTimeout(timeout);
      if (accessAbortRef.current === controller) accessAbortRef.current = null;
      if (requestId === accessRequestRef.current) setIsLoading(false);
    }
  }, [clearAccessState, sessionChecked, userId]);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  // Background recovery is bounded and resumes on network return, app focus,
  // or the visible Retry action. We never infer a role from a cached identity
  // or bypass get_my_access_context when permission verification is unavailable.
  useEffect(() => {
    if (!accessError || !userId) return;
    const retry = () => {
      if (!isLoading && document.visibilityState !== "hidden" && navigator.onLine)
        void checkStatus();
    };
    // Retry even if browser navigator.onLine never fires an event: browsers
    // commonly report "online" while DNS, PostgREST or a DB pool is saturated.
    // Small per-client jitter avoids thousands of failed access checks
    // retrying in lockstep when a shared database outage clears.
    const delay = Math.min(3_000 * Math.pow(2, Math.min(accessFailureCount, 4)), 60_000) + Math.floor(Math.random() * 1_600);
    const timer = window.setTimeout(retry, delay);
    window.addEventListener("online", retry);
    window.addEventListener("rk-reconnected", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", retry);
      window.removeEventListener("rk-reconnected", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [accessError, accessFailureCount, checkStatus, userId, isLoading]);

  const signOut = async () => {
    // Detach this physical installation from the current account before the
    // auth token is revoked. Bound the cleanup so weak mobile data can never
    // trap the user on a logout spinner; token ownership is also reclaimed
    // atomically by the next signed-in account during registration.
    await Promise.race([
      unregisterNativePushToken(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
    ]).catch(() => undefined);

    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    accessAbortRef.current?.abort(new DOMException("Signed out", "AbortError"));
    accessAbortRef.current = null;
    accessRequestRef.current += 1;
    currentUserIdRef.current = null;
    identitySyncUserRef.current = null;
    setUser(null);
    setSession(null);
    clearAccessState();
    setAccessError(false);
    setIsLoading(false);
    navigate("/auth", { replace: true });
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      accessError,
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
