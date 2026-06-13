import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import { colors } from "@oorjaman/config";

import "./portal-base.css";
import "./brand.css";
import "./portal-dashboard.css";
import "./portal-login.css";
import "./portal-loading.css";
import "./web-ui.css";

/**
 * Maps `@oorjaman/config` semantic colors to CSS variables consumed by `.web-*` classes.
 */
export function ThemeRoot({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--wb-bg", colors.background);
    r.style.setProperty("--wb-fg", colors.foreground);
    r.style.setProperty("--wb-muted", colors.muted);
    r.style.setProperty("--wb-muted-fg", colors.mutedForeground);
    r.style.setProperty("--wb-border", colors.border);
    r.style.setProperty("--wb-card", colors.card);
    r.style.setProperty("--wb-elevated", colors.elevated);
    r.style.setProperty("--wb-primary", colors.primary);
    r.style.setProperty("--wb-primary-fg", colors.primaryForeground);
    r.style.setProperty("--wb-primary-muted", colors.primaryMuted);
    r.style.setProperty("--wb-primary-border", colors.primaryBorder);
    r.style.setProperty("--wb-accent", colors.accent);
    r.style.setProperty("--wb-accent-fg", colors.accentForeground);
    r.style.setProperty("--wb-ring", colors.ring);
    r.style.setProperty("--wb-destructive", colors.destructive);
    r.style.setProperty("--wb-destructive-fg", colors.destructiveForeground);
    r.style.setProperty("--wb-card-shadow", "0 1px 2px rgb(15 41 56 / 0.06)");
  }, []);

  return children;
}
