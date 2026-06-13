import { brandColors } from "@oorjaman/config";

type Props = {
  size?: "splash" | "compact";
  className?: string;
};

/** Split-colour OorjaMan wordmark (web portals + marketing). */
export function BrandWordmark({ size = "splash", className }: Props) {
  const sizeClass = size === "compact" ? "web-brand-wordmark--compact" : "web-brand-wordmark--splash";
  return (
    <span className={["web-brand-wordmark", sizeClass, className].filter(Boolean).join(" ")}>
      <span className="web-brand-wordmark__oorja">Oorja</span>
      <span className="web-brand-wordmark__man">Man</span>
    </span>
  );
}

export { brandColors };
