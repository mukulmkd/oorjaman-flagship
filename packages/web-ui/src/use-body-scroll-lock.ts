import { useEffect } from "react";

const LOCK_ATTR = "data-web-scroll-lock";
const STYLE_ATTR = "data-web-scroll-lock-style";

type SavedScrollStyle = {
  bodyOverflow: string;
  bodyPaddingRight: string;
  htmlOverflow: string;
};

/** Prevent page scroll while overlays are open. Nested callers share one lock count. */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return;

    const root = document.documentElement;
    const body = document.body;
    const prevCount = Number(root.getAttribute(LOCK_ATTR) || "0");
    const nextCount = prevCount + 1;
    root.setAttribute(LOCK_ATTR, String(nextCount));

    if (nextCount === 1) {
      const saved: SavedScrollStyle = {
        bodyOverflow: body.style.overflow,
        bodyPaddingRight: body.style.paddingRight,
        htmlOverflow: root.style.overflow,
      };
      root.setAttribute(STYLE_ATTR, JSON.stringify(saved));
      const scrollbarGap = window.innerWidth - root.clientWidth;
      body.style.overflow = "hidden";
      root.style.overflow = "hidden";
      if (scrollbarGap > 0) {
        body.style.paddingRight = `${scrollbarGap}px`;
      }
    }

    return () => {
      const current = Number(root.getAttribute(LOCK_ATTR) || "1");
      const remaining = Math.max(0, current - 1);
      if (remaining === 0) {
        let saved: SavedScrollStyle = {
          bodyOverflow: "",
          bodyPaddingRight: "",
          htmlOverflow: "",
        };
        try {
          const raw = root.getAttribute(STYLE_ATTR);
          if (raw) saved = JSON.parse(raw) as SavedScrollStyle;
        } catch {
          /* ignore */
        }
        body.style.overflow = saved.bodyOverflow;
        body.style.paddingRight = saved.bodyPaddingRight;
        root.style.overflow = saved.htmlOverflow;
        root.removeAttribute(LOCK_ATTR);
        root.removeAttribute(STYLE_ATTR);
      } else {
        root.setAttribute(LOCK_ATTR, String(remaining));
      }
    };
  }, [locked]);
}
