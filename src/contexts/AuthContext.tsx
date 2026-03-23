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
  staffRole: StaffRole;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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

  // Check staff role OUTSIDE auth callbacks
  useEffect(() => {
    let cancelled = false;

    const checkRole = async () => {
      if (!sessionChecked) return;
      if (!user) {
        setIsAdmin(false);
        setStaffRole(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const { data, error } = await supabase.rpc("get_user_staff_role", {
          _user_id: user.id,
        });

        if (cancelled) return;
        if (error) throw error;

        const role = (data as string | null) as StaffRole;
        console.log("[AuthContext] Role check:", { email: user.email, userId: user.id, resolvedRole: role });
        setStaffRole(role);
        setIsAdmin(role === 'admin');
      } catch (e) {
        console.error("[AuthContext] Role check failed:", e, { email: user.email, userId: user.id });
        if (!cancelled) {
          setIsAdmin(false);
          setStaffRole(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    checkRole();

    return () => { cancelled = true; };
  }, [user?.id, sessionChecked]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setStaffRole(null);
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, staffRole, signOut }}>
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
