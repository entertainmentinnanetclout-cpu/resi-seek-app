import { createContext, useContext, useEffect, useState, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const navigate = useNavigate();
  const initRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initRef.current) return;
    initRef.current = true;

    let mounted = true;

    const initAuth = async () => {
      try {
        // Get existing session FIRST
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (existingSession) {
          setSession(existingSession);
          setUser(existingSession.user);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        if (mounted) {
          setSessionChecked(true);
        }
      }
    };

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      
      // Update state synchronously
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      
      // Mark session as checked after first auth state change
      setSessionChecked(true);
    });

    // Initialize
    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Check admin role OUTSIDE auth callbacks to avoid deadlocks/races
  useEffect(() => {
    let cancelled = false;

    const checkRole = async () => {
      // Wait for session check to complete
      if (!sessionChecked) return;
      
      // Not logged in
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      // Keep loading true while checking role
      setIsLoading(true);

      try {
        const { data, error } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });

        if (cancelled) return;
        if (error) throw error;

        setIsAdmin(Boolean(data));
      } catch (e) {
        // Fail closed
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    checkRole();

    return () => {
      cancelled = true;
    };
  }, [user?.id, sessionChecked]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, signOut }}>
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
