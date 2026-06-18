import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPortalViteConfig } from "@oorjaman/vite-portal-config/vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));

function countryStateCityEntry(): string {
  const candidates = [
    path.resolve(appDir, "node_modules/country-state-city/lib/index.js"),
    path.resolve(appDir, "../../node_modules/country-state-city/lib/index.js"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

export default createPortalViteConfig({
  appDir,
  port: 5174,
  extraAliases: {
    "country-state-city": countryStateCityEntry(),
  },
});
