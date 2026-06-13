import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function countryStateCityEntry(): string {
  const candidates = [
    path.resolve(__dirname, "node_modules/country-state-city/lib/index.js"),
    path.resolve(__dirname, "../../node_modules/country-state-city/lib/index.js"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

export default defineConfig({
  server: { port: 5174 },
  plugins: [react()],
  resolve: {
    alias: {
      "@oorjaman/config": path.resolve(__dirname, "../../packages/config/src"),
      "@oorjaman/utils": path.resolve(__dirname, "../../packages/utils/src"),
      "@oorjaman/api": path.resolve(__dirname, "../../packages/api/src"),
      "@oorjaman/web-ui": path.resolve(__dirname, "../../packages/web-ui/src"),
      "country-state-city": countryStateCityEntry(),
    },
  },
});
