import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

export type PortalViteOptions = {
  /** App directory (pass import.meta.dirname or __dirname). */
  appDir: string;
  /** Dev server port; omit for Vite default (5173). */
  port?: number;
  /** Extra Vite resolve aliases merged after the shared @oorjaman/* aliases. */
  extraAliases?: Record<string, string>;
};

/** Monorepo root: apps/<portal>/ → ../.. */
function monorepoRootFromApp(appDir: string): string {
  return path.resolve(appDir, "../..");
}

export function createPortalViteConfig(options: PortalViteOptions): UserConfig {
  const root = monorepoRootFromApp(options.appDir);
  const alias = {
    "@oorjaman/config": path.join(root, "packages/config/src"),
    "@oorjaman/utils": path.join(root, "packages/utils/src"),
    "@oorjaman/api": path.join(root, "packages/api/src"),
    "@oorjaman/web-ui": path.join(root, "packages/web-ui/src"),
    ...options.extraAliases,
  };

  return defineConfig({
    ...(options.port != null ? { server: { port: options.port } } : {}),
    plugins: [react()],
    resolve: { alias },
  });
}

/** ESM apps: `createPortalViteConfig({ appDir: path.dirname(fileURLToPath(import.meta.url)) })` */
export { fileURLToPath };
