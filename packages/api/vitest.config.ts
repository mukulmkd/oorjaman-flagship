import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Soft coverage gate for high-value api modules (raised as the suite grows).
 * Full-package % is not gated yet — see project-docs/TESTING.md.
 */
export default defineConfig({
  root,
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: path.join(root, "coverage"),
      include: [
        "src/payments/razorpay-errors.ts",
        "src/payments/razorpay-status.ts",
        "src/pricing/gst-breakdown.ts",
        "src/pricing/capacity-pricing.ts",
        "src/launch/launch-area.ts",
        "src/bookings/vendor-fallback.ts",
        "src/vendors/vendor-intake-validation.ts",
        "src/subscriptions/amc-visit-booking-eligibility.ts",
        "src/subscriptions/amc-booking-generation.ts",
        "src/subscriptions/amc-display.ts",
      ],
      exclude: ["**/*.test.ts", "**/database.types.ts"],
      thresholds: {
        statements: 40,
        lines: 40,
        functions: 30,
        branches: 25,
      },
    },
  },
});
