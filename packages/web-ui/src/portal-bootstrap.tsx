import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PortalAppProviders } from "./portal-app-providers";

/** Shared Vite portal entry bootstrap (fonts ready + router + providers). */
export async function mountPortalApp(App: ComponentType) {
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue rendering with browser fallback fonts.
    }
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <PortalAppProviders>
          <App />
        </PortalAppProviders>
      </BrowserRouter>
    </StrictMode>,
  );
}
