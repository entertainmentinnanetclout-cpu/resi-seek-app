import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  const [authReady, setAuthReady] = useState(false);

  const roleCheckAbortRef = useRef<AbortController | null>(null);
  const lastRoleCheckUserIdRef = useRef<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    // 1) Listen FIRST (sync callback only)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthReady(true);
    });

    // 2) Then get current session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!mounted) return;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Role check (kept OUTSIDE auth callbacks to avoid auth deadlocks)
  useEffect(() => {
    if (!authReady) return;

    // Cancel any in-flight role check
    roleCheckAbortRef.current?.abort();
    const abort = new AbortController();
    roleCheckAbortRef.current = abort;

    const run = async () => {
      // Not logged in
      if (!user) {
        lastRoleCheckUserIdRef.current = null;
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      // Avoid duplicate calls for the same user id
      if (lastRoleCheckUserIdRef.current === user.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const { data, error } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });

        if (abort.signal.aborted) return;
        if (error) throw error;

        lastRoleCheckUserIdRef.current = user.id;
        setIsAdmin(Boolean(data));
      } catch {
        // Fail closed: if we can't verify admin, treat as non-admin
        lastRoleCheckUserIdRef.current = user.id;
        setIsAdmin(false);
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    };

    run();

    return () => {
      abort.abort();
    };
  }, [authReady, user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    lastRoleCheckUserIdRef.current = null;
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
