# @oorjaman/mobile-deps

Shared **Expo SDK 56** runtime dependencies for `customer-app` and `technician-app`.

Both mobile apps depend on `@oorjaman/mobile-config` (plugins, Metro, rebuild scripts) and `@oorjaman/mobile-deps` (runtime packages). Keep only app-specific modules in each app's `package.json`.

## Bumping Expo / React Native

1. Edit versions in **this** `package.json`.
2. Run `npm install` from the **monorepo root**.
3. Verify each app: `cd apps/customer-app && npx expo install --check && npx expo-doctor` (repeat for `technician-app`).
4. Run `npm run typecheck` from root.

When adding a dependency used by **both** apps, add it here—not to each app separately.
