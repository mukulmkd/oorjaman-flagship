#!/usr/bin/env node
/**
 * Validates Android notification icons are white mono on transparent.
 * Run after `npm run brand:sync` (and `npx expo prebuild` for native drawables).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const TARGETS = [
  "apps/customer-app/assets/images/notification-icon.png",
  "apps/technician-app/assets/images/notification-icon.png",
  "brand/source/notification-icon.png",
];

async function loadSharp() {
  const mod = await import("sharp");
  return mod.default;
}

async function audit(path, sharp) {
  const full = join(repoRoot, path);
  if (!existsSync(full)) {
    return { path, ok: false, error: "missing" };
  }
  const { data, info } = await sharp(full).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  let white = 0;
  let colored = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a > 0) {
      opaque++;
      if (r === 255 && g === 255 && b === 255) white++;
      else colored++;
    }
  }
  const ok = opaque > 0 && colored === 0;
  return { path, ok, size: `${info.width}x${info.height}`, opaque, white, colored };
}

async function main() {
  const sharp = await loadSharp();
  const results = await Promise.all(TARGETS.map((p) => audit(p, sharp)));
  let failed = false;
  for (const r of results) {
    if (r.error) {
      console.error(`FAIL ${r.path}: ${r.error}`);
      failed = true;
      continue;
    }
    const label = r.ok ? "OK" : "FAIL";
    console.log(
      `${label} ${r.path} ${r.size} opaque=${r.opaque} white=${r.white} colored=${r.colored}`,
    );
    if (!r.ok) failed = true;
  }
  if (failed) {
    console.error("\nNotification icons must be white (#fff) silhouettes on transparent PNG.");
    process.exit(1);
  }
  console.log("\nAll notification icons passed white-mono check.");
}

void main();
