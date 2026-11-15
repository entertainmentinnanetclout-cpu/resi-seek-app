import { useEffect, useRef, useState } from "react";

/**
 * SEC-15/16 — Cloudflare Turnstile for password sign-in, sign-up and recovery.
 * The widget is inert until a PUBLIC site key is provided at build time.
 * Never put a Cloudflare Turnstile secret in VITE_ variables.
 */
const SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
export const authCaptchaConfigured = SITE_KEY.length > 0;

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    theme: "auto";
    action: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
    "timeout-callback": () => void;
  }) => string;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi };
let widgetLoader: Promise<TurnstileApi> | null = null;

function getTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser required for security verification"));
  const client = (window as TurnstileWindow).turnstile;
  if (client) return Promise.resolve(client);
  if (!widgetLoader) {
    widgetLoader = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.referrerPolicy = "no-referrer";
      script.onload = () => {
        const api = (window as TurnstileWindow).turnstile;
        if (!api) {
          reject(new Error("Security verification could not initialize"));
          return;
        }
        resolve(api);
      };
      script.onerror = () => reject(new Error("Security verification could not load"));
      document.head.appendChild(script);
    }).catch((error) => {
      widgetLoader = null;
      throw error;
    });
  }
  return widgetLoader;
}

/**
 * Use this exact helper on EVERY public password-based Auth API invocation.
 * If Turnstile has been configured but no valid token exists, fail closed
 * BEFORE making any request to Supabase Auth.
 */
export function requireAuthCaptchaToken(captchaToken: string | null): { captchaToken?: string } {
  if (!authCaptchaConfigured) return {};
  if (!captchaToken || !captchaToken.trim()) {
    throw new Error("Complete the security verification before continuing.");
  }
  return { captchaToken };
}

type AuthBotChallengeProps = {
  action: "auth_student" | "auth_recruiter" | "auth_residence" | "auth_recovery";
  onTokenChange: (token: string | null) => void;
};

/**
 * Mount with a changing React key after each Auth request so single-use
 * tokens cannot be reused for signup, login or recovery. Expiry/timeout/error
 * clears the token immediately; no proof is stored persistently.
 */
export default function AuthBotChallenge({ action, onTokenChange }: AuthBotChallengeProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onTokenChange);
  const [problem, setProblem] = useState<string | null>(null);
  onChangeRef.current = onTokenChange;

  useEffect(() => {
    if (!authCaptchaConfigured) return;
    let active = true;
    let widget: { api: TurnstileApi; id: string } | null = null;
    const invalidate = () => {
      if (!active) return;
      onChangeRef.current(null);
    };
    const mount = async () => {
      try {
        const api = await getTurnstile();
        if (!active || !hostRef.current) return;
        const id = api.render(hostRef.current, {
          sitekey: SITE_KEY,
          theme: "auto",
          action,
          callback: (token) => {
            if (!active) return;
            setProblem(null);
            onChangeRef.current(token);
          },
          "expired-callback": invalidate,
          "timeout-callback": invalidate,
          "error-callback": () => {
            invalidate();
            setProblem("Security verification was interrupted. Refresh this page to try again.");
          },
        });
        widget = { api, id };
      } catch {
        if (!active) return;
        invalidate();
        setProblem("Security verification is unavailable. Check your connection and refresh this page.");
      }
    };
    void mount();
    return () => {
      active = false;
      onChangeRef.current(null);
      if (widget) {
        try { widget.api.remove(widget.id); } catch { /* stale widget */ }
      }
    };
  }, [action]);

  if (!authCaptchaConfigured) return null;

  return (
    <div className="space-y-1" aria-label="Account security verification">
      <div ref={hostRef} className="min-h-[65px]" />
      {problem && <p role="alert" className="text-xs text-destructive">{problem}</p>}
      <p className="text-[11px] text-muted-foreground">
        Complete the security verification to protect your account from automated abuse.
      </p>
    </div>
  );
}
