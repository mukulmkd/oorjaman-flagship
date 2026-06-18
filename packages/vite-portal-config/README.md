# @oorjaman/vite-portal-config

Shared **Vite 8**, **ESLint 10**, and **TypeScript 6** settings for `admin-web`, `vendor-web`, and `support-web`.

Each portal keeps its own app-specific dependencies (e.g. `recharts` on admin) and imports shared tooling from here.

## Usage

- **ESLint:** `export { default } from "@oorjaman/vite-portal-config/eslint"`
- **Vite:** `createPortalViteConfig({ appDir, port?, extraAliases? })` from `@oorjaman/vite-portal-config/vite`
- **TS:** extend `../../packages/vite-portal-config/tsconfig.app.json` in each portal's `tsconfig.app.json` (paths stay per-app)

Bump shared portal tooling versions in **this** `package.json`, then `npm install` from repo root.
