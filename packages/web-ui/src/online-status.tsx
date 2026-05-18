import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { OFFLINE_SCREEN_MESSAGE, OFFLINE_SCREEN_TITLE } from "@oorjaman/api";
import { Button } from "./button";
import "./offline-screen.css";

type OnlineStatusContextValue = {
  online: boolean;
  recheck: () => void;
};

const OnlineStatusContext = createContext<OnlineStatusContextValue | null>(null);

function readBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function OnlineStatusProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(readBrowserOnline);

  const recheck = useCallback(() => {
    setOnline(readBrowserOnline());
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const value = useMemo(() => ({ online, recheck }), [online, recheck]);

  return <OnlineStatusContext.Provider value={value}>{children}</OnlineStatusContext.Provider>;
}

export function useOnlineStatus(): OnlineStatusContextValue {
  const ctx = useContext(OnlineStatusContext);
  if (!ctx) {
    throw new Error("useOnlineStatus must be used within OnlineStatusProvider");
  }
  return ctx;
}

/** Full-screen offline state for Vite dashboard apps. */
export function WebOfflineGate({ children }: { children: ReactNode }) {
  const { online, recheck } = useOnlineStatus();

  if (online) {
    return children;
  }

  return (
    <div className="web-offline-screen" role="alert" aria-live="polite">
      <div className="web-offline-card">
        <div className="web-offline-icon" aria-hidden>
          <span className="web-offline-icon-bar" />
          <span className="web-offline-icon-bar web-offline-icon-bar--mid" />
          <span className="web-offline-icon-bar web-offline-icon-bar--low" />
        </div>
        <h1 className="web-offline-title">{OFFLINE_SCREEN_TITLE}</h1>
        <p className="web-offline-message">{OFFLINE_SCREEN_MESSAGE}</p>
        <Button type="button" variant="primary" onClick={recheck}>
          Try again
        </Button>
      </div>
    </div>
  );
}
