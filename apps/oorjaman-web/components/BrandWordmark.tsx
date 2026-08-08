import { brandColors } from "@oorjaman/config";

type Props = {
  size?: "splash" | "compact" | "hero";
  /** Use light split colours on dark surfaces (hero, footer bands). */
  tone?: "default" | "onDark";
  className?: string;
};

/** Split-colour OorjaMan wordmark for the marketing site. */
export function BrandWordmark({ size = "compact", tone = "default", className }: Props) {
  const sizeClass =
    size === "hero"
      ? "om-wordmark--hero"
      : size === "splash"
        ? "om-wordmark--splash"
        : "om-wordmark--compact";

  const oorja = tone === "onDark" ? "#9fc93c" : brandColors.oorja;
  const man = tone === "onDark" ? "#ffffff" : brandColors.man;

  return (
    <span className={["om-wordmark", sizeClass, className].filter(Boolean).join(" ")}>
      <span className="om-wordmark__oorja" style={{ color: oorja }}>
        Oorja
      </span>
      <span className="om-wordmark__man" style={{ color: man }}>
        Man
      </span>
    </span>
  );
}
