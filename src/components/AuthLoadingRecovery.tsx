import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AuthLoadingRecovery({
  message = "Loading your ResKonnect account…",
  onRetry,
  showRecoveryImmediately = false,
}: {
  message?: string;
  onRetry?: () => void | Promise<void>;
  showRecoveryImmediately?: boolean;
}) {
  const navigate = useNavigate();
  const [slow, setSlow] = useState(showRecoveryImmediately);

  useEffect(() => {
    if (showRecoveryImmediately) {
      setSlow(true);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [showRecoveryImmediately]);

  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">{message}</p>
        {slow && (
          <div className="mt-6 space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-sm leading-6 text-muted-foreground">
              {offline
                ? "This device is offline. Your saved session is being kept and live account checks will resume when the connection returns."
                : "The account check is taking longer than expected. ResKonnect will not keep you on this loader indefinitely."}
            </p>
            {offline && <div className="flex items-center justify-center gap-2 text-sm font-semibold"><WifiOff className="h-4 w-4" />Waiting for connection</div>}
            {!offline && onRetry && (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
                onClick={() => void onRetry()}
              >
                <RefreshCw className="h-4 w-4" />Retry account check
              </button>
            )}
            <button type="button" className="w-full rounded-full border px-5 py-3 text-sm font-semibold" onClick={() => window.location.reload()}>
              Reload ResKonnect
            </button>
            <button type="button" className="w-full px-5 py-2 text-sm font-semibold text-muted-foreground" onClick={() => navigate("/auth", { replace: true })}>
              Open sign-in and account options
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
