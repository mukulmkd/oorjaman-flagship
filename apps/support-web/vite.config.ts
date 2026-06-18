import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPortalViteConfig } from "@oorjaman/vite-portal-config/vite";

export default createPortalViteConfig({
  appDir: path.dirname(fileURLToPath(import.meta.url)),
  port: 5175,
});
