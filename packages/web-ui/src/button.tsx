import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const cls = ["web-btn", `web-btn--${variant}`, `web-btn--${size}`, className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} disabled={disabled ?? loading} {...rest}>
      {loading ? <span className="web-spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}
