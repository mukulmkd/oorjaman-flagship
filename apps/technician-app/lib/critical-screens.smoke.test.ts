import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Critical Partner screens from the unit-testing plan (source smoke, not full mount). */
const CRITICAL_SCREENS = [
  "app/permissions.tsx",
  "app/(main)/index.tsx",
  "app/(main)/jobs/index.tsx",
  "app/(main)/jobs/[id].tsx",
  "app/(main)/jobs/execute/[bookingId].tsx",
] as const;

describe("partner critical screen smoke", () => {
  for (const rel of CRITICAL_SCREENS) {
    it(`${rel} exists and exports a default screen`, () => {
      const file = path.join(appRoot, rel);
      expect(existsSync(file), `missing ${rel}`).toBe(true);
      const src = readFileSync(file, "utf8");
      expect(src).toMatch(/export\s+default\s+/);
    });
  }

  it("permissions screen keeps dismissible Not now (5.1.1(iv))", () => {
    const src = readFileSync(path.join(appRoot, "app/permissions.tsx"), "utf8");
    expect(src).toContain("Not now");
  });

  it("job detail keeps optional Open Settings with Not Now for en route", () => {
    const src = readFileSync(path.join(appRoot, "app/(main)/jobs/[id].tsx"), "utf8");
    expect(src).toContain("Not Now");
    expect(src).toContain("Open Settings");
  });
});
