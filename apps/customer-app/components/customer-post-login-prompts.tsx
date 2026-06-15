import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type CustomerPostLoginPromptsContextValue = {
  /** False while the session address gate modal is open — blocks notification permission prompts. */
  backgroundPromptsAllowed: boolean;
  releaseBackgroundPrompts: () => void;
};

const CustomerPostLoginPromptsCtx = createContext<CustomerPostLoginPromptsContextValue | null>(null);

export function CustomerPostLoginPromptsProvider({
  children,
  initiallyAllowed,
}: {
  children: ReactNode;
  initiallyAllowed: boolean;
}) {
  const [backgroundPromptsAllowed, setBackgroundPromptsAllowed] = useState(initiallyAllowed);

  const releaseBackgroundPrompts = useCallback(() => {
    setBackgroundPromptsAllowed(true);
  }, []);

  const value = useMemo(
    () => ({ backgroundPromptsAllowed, releaseBackgroundPrompts }),
    [backgroundPromptsAllowed, releaseBackgroundPrompts],
  );

  return (
    <CustomerPostLoginPromptsCtx.Provider value={value}>{children}</CustomerPostLoginPromptsCtx.Provider>
  );
}

export function useCustomerPostLoginPrompts(): CustomerPostLoginPromptsContextValue {
  const ctx = useContext(CustomerPostLoginPromptsCtx);
  if (!ctx) {
    return {
      backgroundPromptsAllowed: true,
      releaseBackgroundPrompts: () => {},
    };
  }
  return ctx;
}
