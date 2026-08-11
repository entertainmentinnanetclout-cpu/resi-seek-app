import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { UserIntent } from "@/lib/intent/userIntentTypes";
import { hasIntent } from "@/lib/intent/userIntentTypes";
import { clearIntent, loadIntent, saveIntent } from "@/lib/intent/userIntentAdapter";

interface UserIntentContextValue {
  intent: UserIntent;
  hasIntent: boolean;
  setIntent: (patch: Partial<UserIntent>) => void;
  completeGuide: (patch?: Partial<UserIntent>) => void;
  skipGuide: () => void;
  resetIntent: () => void;
}

const UserIntentContext = createContext<UserIntentContextValue | undefined>(undefined);

export const UserIntentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [intent, setIntentState] = useState<UserIntent>({});

  useEffect(() => {
    setIntentState(loadIntent());
  }, []);

  const setIntent = useCallback((patch: Partial<UserIntent>) => {
    setIntentState((prev) => saveIntent({ ...prev, ...patch }));
  }, []);

  const completeGuide = useCallback((patch: Partial<UserIntent> = {}) => {
    setIntentState((prev) =>
      saveIntent({ ...prev, ...patch, completed_guide: true, skipped_guide: false })
    );
  }, []);

  const skipGuide = useCallback(() => {
    setIntentState((prev) => saveIntent({ ...prev, skipped_guide: true, completed_guide: false }));
  }, []);

  const resetIntent = useCallback(() => {
    clearIntent();
    setIntentState({});
  }, []);

  const value = useMemo(
    () => ({ intent, hasIntent: hasIntent(intent), setIntent, completeGuide, skipGuide, resetIntent }),
    [intent, setIntent, completeGuide, skipGuide, resetIntent]
  );

  return <UserIntentContext.Provider value={value}>{children}</UserIntentContext.Provider>;
};

export function useUserIntent(): UserIntentContextValue {
  const ctx = useContext(UserIntentContext);
  if (!ctx) {
    throw new Error("useUserIntent must be used within a UserIntentProvider");
  }
  return ctx;
}

export default UserIntentProvider;
