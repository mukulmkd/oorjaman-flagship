import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "neutral" | "warning" | "success" | "danger";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  children?: ReactNode;
};

export function Badge({ tone = "neutral", className, children, ...rest }: BadgeProps) {
  const cls = ["web-badge", `web-badge--${tone}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
