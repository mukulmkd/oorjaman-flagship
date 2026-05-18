import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { HelpSupportModal } from "./help-support-modal";

export type HelpSupportContext = {
  booking_id?: string | null;
  subscription_id?: string | null;
  service_address_id?: string | null;
  category_slug?: string | null;
};

type HelpSupportState = {
  openHelp: (context?: HelpSupportContext) => void;
  closeHelp: () => void;
};

const Ctx = createContext<HelpSupportState | null>(null);

export function HelpSupportProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [context, setContext] = useState<HelpSupportContext | undefined>();

  const openHelp = useCallback((ctx?: HelpSupportContext) => {
    setContext(ctx);
    setVisible(true);
  }, []);

  const closeHelp = useCallback(() => {
    setVisible(false);
  }, []);

  const value = useMemo(() => ({ openHelp, closeHelp }), [openHelp, closeHelp]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <HelpSupportModal visible={visible} context={context} onClose={closeHelp} />
    </Ctx.Provider>
  );
}

export function useHelpSupport(): HelpSupportState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useHelpSupport must be used within HelpSupportProvider");
  }
  return ctx;
}
