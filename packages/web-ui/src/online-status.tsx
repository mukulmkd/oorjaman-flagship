import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

/** Confirm before showing the gate. Chrome's `offline` event is often a false positive. */
const OFFLINE_CONFIRM_DELAY_MS = 2500;
const OFFLINE_RETRY_MS = 5000;
const PROBE_TIMEOUT_MS = 4000;

/**
 * Reachability of this origin. Do not trust `navigator.onLine` alone: Chromium
 * uses Google's connectivity check, which many ISPs, DNS filters, and ad
 * blockers fail, so dashboards stay stuck on "You're offline" while Vercel and
 * Supabase are reachable.
 *
 * Any HTTP response (including 404) means the network path works.
 */
async function probeOriginReachable(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const url = new URL("/favicon.png", window.location.origin);
    url.searchParams.set("_online", String(Date.now()));
    await fetch(url.href, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export function OnlineStatusProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearConfirmTimer = useCallback(() => {
    if (confirmTimer.current) {
      clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
  }, []);

  const goOnline = useCallback(() => {
    clearConfirmTimer();
    setOnline(true);
  }, [clearConfirmTimer]);

  const confirmOffline = useCallback(() => {
    if (confirmTimer.current) return;
    confirmTimer.current = setTimeout(() => {
      confirmTimer.current = null;
      void probeOriginReachable().then((reachable) => {
        if (!reachable) setOnline(false);
      });
    }, OFFLINE_CONFIRM_DELAY_MS);
  }, []);

  const recheck = useCallback(() => {
    clearConfirmTimer();
    void probeOriginReachable().then((reachable) => setOnline(reachable));
  }, [clearConfirmTimer]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      void probeOriginReachable().then((reachable) => {
        if (reachable) goOnline();
        else confirmOffline();
      });
    }

    const onOnline = () => goOnline();
    const onOffline = () => confirmOffline();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearConfirmTimer();
    };
  }, [confirmOffline, goOnline, clearConfirmTimer]);

  useEffect(() => {
    if (online) return;
    const id = window.setInterval(() => {
      void probeOriginReachable().then((reachable) => {
        if (reachable) goOnline();
      });
    }, OFFLINE_RETRY_MS);
    return () => window.clearInterval(id);
  }, [online, goOnline]);

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

/** Full-screen offline overlay for Vite dashboard apps. Children stay mounted. */
export function WebOfflineGate({ children }: { children: ReactNode }) {
  const { online, recheck } = useOnlineStatus();

  return (
    <>
      {children}
      {online ? null : (
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
      )}
    </>
  );
}
