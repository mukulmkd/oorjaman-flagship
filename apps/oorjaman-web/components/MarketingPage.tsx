import type { ReactNode } from "react";

type Props = {
  title: string;
  lead: string;
  children: ReactNode;
};

export function MarketingPage({ title, lead, children }: Props) {
  return (
    <div className="om-section">
      <div className="om-container" style={{ maxWidth: "48rem" }}>
        <h1 className="om-h1">{title}</h1>
        <p className="om-lead">{lead}</p>
        {children}
      </div>
    </div>
  );
}
