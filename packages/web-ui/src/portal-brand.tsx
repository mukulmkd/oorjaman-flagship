import { BRAND_TAGLINE } from "@oorjaman/config";
import { BrandWordmark } from "./brand-wordmark";

export type PortalPersona = "operations" | "support" | "partner";

const PERSONA_LABEL: Record<PortalPersona, string> = {
  operations: "Operations",
  support: "Support",
  partner: "Partner",
};

type PersonaProps = {
  persona: PortalPersona;
  className?: string;
};

/** Small uppercase persona line (Operations / Support / Partner). */
export function PortalPersonaBadge({ persona, className }: PersonaProps) {
  return (
    <span
      className={["web-brand-persona", `web-brand-persona--${persona}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      {PERSONA_LABEL[persona]}
    </span>
  );
}

type SidebarProps = {
  persona: PortalPersona;
};

/** Compact sidebar mark: icon + wordmark + persona (no tagline). */
export function PortalSidebarBrand({ persona }: SidebarProps) {
  return (
    <div className="web-portal-sidebar-brand">
      <img
        src="/logo-icon.png"
        alt=""
        width={36}
        height={36}
        className="web-portal-sidebar-brand__icon"
        aria-hidden
      />
      <div className="web-portal-sidebar-brand__text">
        <BrandWordmark size="compact" />
        <PortalPersonaBadge persona={persona} />
      </div>
    </div>
  );
}

type LoginProps = {
  persona: PortalPersona;
};

/** Login hero — Big O icon, split wordmark, tagline, and persona pill (all portals). */
export function PortalLoginBrand({ persona }: LoginProps) {
  return (
    <div className="web-portal-login-brand">
      <img
        src="/logo-icon.png"
        alt=""
        width={88}
        height={88}
        className="web-portal-login-brand__icon"
        aria-hidden
      />
      <BrandWordmark size="splash" />
      <p className="web-brand-tagline">{BRAND_TAGLINE}</p>
      <PortalPersonaBadge persona={persona} />
    </div>
  );
}
