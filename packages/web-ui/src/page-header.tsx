import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="web-page-header">
      <div className="web-page-header-main">
        <h1 className="web-page-header-title">{title}</h1>
        {subtitle ? <p className="web-page-header-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="web-page-header-actions">{actions}</div> : null}
    </header>
  );
}
