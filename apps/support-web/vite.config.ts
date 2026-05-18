import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  server: { port: 5175 },
  plugins: [react()],
  resolve: {
    alias: {
      "@oorjaman/config": path.resolve(__dirname, "../../packages/config/src"),
      "@oorjaman/utils": path.resolve(__dirname, "../../packages/utils/src"),
      "@oorjaman/api": path.resolve(__dirname, "../../packages/api/src"),
      "@oorjaman/web-ui": path.resolve(__dirname, "../../packages/web-ui/src"),
    },
  },
});
