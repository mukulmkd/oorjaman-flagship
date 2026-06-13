import { BrandWordmark } from "./brand-wordmark";

type Props = {
  label?: string;
};

/** Branded full-screen loader for portal session checks and route gates. */
export function PortalLoadingScreen({ label = "Loading…" }: Props) {
  return (
    <div className="web-portal-loading" role="status" aria-live="polite" aria-busy="true">
      <img src="/logo-icon.png" alt="" width={52} height={52} className="web-portal-loading__icon" aria-hidden />
      <BrandWordmark size="compact" />
      <p className="web-portal-loading__label">{label}</p>
      <div className="web-portal-loading__track" aria-hidden>
        <div className="web-portal-loading__fill" />
      </div>
    </div>
  );
}
