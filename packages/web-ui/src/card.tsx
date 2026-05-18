import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
  children?: ReactNode;
};

export function Card({ padded, className, children, ...rest }: CardProps) {
  const isInteractive =
    typeof rest.onClick === "function" ||
    rest.role === "button" ||
    rest.tabIndex !== undefined ||
    (className?.includes("dash-card-clickable") ?? false);
  const cls = ["web-card", padded && "web-card--padded", isInteractive && "web-card--interactive", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
