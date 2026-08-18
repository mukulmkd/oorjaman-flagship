"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  /** Extra delay in ms after entering view */
  delayMs?: number;
  as?: "div" | "section" | "li" | "article";
};

/**
 * Subtle scroll-triggered reveal. Respects prefers-reduced-motion
 * (elements stay visible with no animation).
 */
export function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
  as: Tag = "div",
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      el.classList.add("om-reveal--visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          window.setTimeout(() => {
            entry.target.classList.add("om-reveal--visible");
          }, delayMs);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delayMs]);

  return (
    <Tag
      ref={ref as never}
      className={`om-reveal ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}
