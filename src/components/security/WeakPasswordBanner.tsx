import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { readWeakPassword, type WeakPasswordSignal } from "@/lib/passwordSecurity";
import { useNavigate } from "react-router-dom";

export default function WeakPasswordBanner({ returnTo }: { returnTo?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [signal, setSignal] = useState<WeakPasswordSignal | null>(null);

  useEffect(() => {
    setSignal(readWeakPassword(user?.id));
  }, [user?.id]);

  if (!user || !signal) return null;

  const target = `/reset-password?returnTo=${encodeURIComponent(returnTo || "/dashboard")}`;

  return (
    <div className="border-b border-amber-300/60 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-amber-500/15 p-2">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-black">Your account is signed in, but this password should be replaced.</p>
            <p className="mt-0.5 text-xs leading-5 opacity-80">
              ResKonnect did not block your existing account. Supabase flagged the password as weak or previously exposed, so changing it is strongly recommended.
            </p>
          </div>
        </div>
        <Button size="sm" className="shrink-0 gap-2 bg-amber-950 text-white hover:bg-amber-900 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200" onClick={() => navigate(target)}>
          <ShieldCheck className="h-4 w-4" />
          Secure password
        </Button>
      </div>
    </div>
  );
}
