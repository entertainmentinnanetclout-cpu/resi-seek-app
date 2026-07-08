import { createContext, useContext, useEffect, useState, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export type StaffRole = 'admin' | 'operations_lead' | 'commerce_lead' | 'growth_lead' | 'system_operator' | 'support_agent' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  isRecruiter: boolean;
  isPendingRecruiter: boolean;
  isStudent: boolean;
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
  const [isRecruiter, setIsRecruiter] = useState(false);
  const [isPendingRecruiter, setIsPendingRecruiter] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const [staffRole, setStaffRole] = useState<StaffRole>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const navigate = useNavigate();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (existingSession) {
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
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setSessionChecked(true);
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
      setStaffRole(null);
      setIsRecruiter(false);
      setIsPendingRecruiter(false);
      setIsStudent(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Check Staff Role
      const { data: roleData, error: roleError } = await supabase.rpc("get_user_staff_role", {
        _user_id: user.id,
      });
      if (roleError) throw roleError;
      const role = (roleData as string | null) as StaffRole;
      setStaffRole(role);
      setIsAdmin(role === 'admin');

      // 2. Check Recruiter Status & Student Profile in parallel
      const [recruiterRes, pendingRes, profileRes] = await Promise.all([
        supabase.from("referral_agents" as any).select("status").eq("user_id", user.id).eq("program_key", "student_recruitment").maybeSingle(),
        supabase.from("recruiter_applications" as any).select("status").eq("user_id", user.id).eq("program_key", "student_recruitment").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("profiles").select("student_number").eq("id", user.id).maybeSingle()
      ]);

      setIsRecruiter((recruiterRes.data as any)?.status === 'approved');
      setIsPendingRecruiter((pendingRes.data as any)?.status === 'pending');
      setIsStudent(!!profileRes.data?.student_number);

      console.log("[AuthContext] Status check:", {
        email: user.email,
        resolvedRole: role,
        isRecruiter: (recruiterRes.data as any)?.status === 'approved',
        isPendingRecruiter: (pendingRes.data as any)?.status === 'pending',
        isStudent: !!profileRes.data?.student_number
      });
    } catch (e) {
      console.error("[AuthContext] Status check failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [user?.id, sessionChecked]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setStaffRole(null);
    setIsRecruiter(false);
    setIsPendingRecruiter(false);
    setIsStudent(false);
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{
      user, session, isLoading, isAdmin, isRecruiter, isPendingRecruiter, isStudent, staffRole, signOut, refreshProfile: checkStatus
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
