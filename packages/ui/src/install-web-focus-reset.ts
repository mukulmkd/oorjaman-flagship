import { Platform } from "react-native";

const STYLE_ID = "oorjaman-web-focus-reset";

/**
 * RN Web / browsers draw a bright default focus ring on inputs and Pressables.
 * Our components already use brand borders for focus — strip the native outline on web only.
 */
export function installWebFocusReset(): void {
  if (Platform.OS !== "web") return;
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    input:focus,
    input:focus-visible,
    textarea:focus,
    textarea:focus-visible,
    button:focus,
    button:focus-visible,
    select:focus,
    select:focus-visible,
    a:focus,
    a:focus-visible,
    [role="button"]:focus,
    [role="button"]:focus-visible,
    [tabindex]:focus,
    [tabindex]:focus-visible {
      outline: none !important;
      outline-width: 0 !important;
      outline-color: transparent !important;
    }
  `;
  document.head.appendChild(style);
}
