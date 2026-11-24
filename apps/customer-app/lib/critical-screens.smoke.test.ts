import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Critical Customer screens from the unit-testing plan (source smoke, not full mount). */
const CRITICAL_SCREENS = [
  "app/login.tsx",
  "app/book.tsx",
  "app/booking-detail.tsx",
  "app/(main)/bookings/index.tsx",
  "app/(main)/subscription.tsx",
  "app/preferred-partner.tsx",
] as const;

describe("customer critical screen smoke", () => {
  for (const rel of CRITICAL_SCREENS) {
    it(`${rel} exists and exports a default screen`, () => {
      const file = path.join(appRoot, rel);
      expect(existsSync(file), `missing ${rel}`).toBe(true);
      const src = readFileSync(file, "utf8");
      expect(src).toMatch(/export\s+default\s+/);
    });
  }
});
