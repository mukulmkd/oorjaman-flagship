#!/usr/bin/env node
/**
 * Start Customer + Technician Expo Web locally (CSR).
 *
 *   npm run apps:web
 *
 * Customer:   http://localhost:8081
 * Technician: http://localhost:8082
 *
 * Ctrl+C stops both. Env is loaded from each app's .env / .env.development.local
 * by Expo (run from the app directory).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const apps = [
  { name: "customer", dir: "apps/customer-app", port: 8081 },
  { name: "technician", dir: "apps/technician-app", port: 8082 },
];

console.log(`
OorjaMan Expo Web (local)
  Customer:    http://localhost:8081
  Technician:  http://localhost:8082

Ctrl+C to stop both.
`);

/** @type {import("node:child_process").ChildProcess[]} */
const children = [];

for (const { name, dir, port } of apps) {
  const child = spawn(
    "npx",
    ["expo", "start", "--web", "--port", String(port)],
    {
      cwd: path.join(root, dir),
      stdio: "inherit",
      env: process.env,
    },
  );

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`\n[${name}] stopped (${signal})`);
    } else if (code != null && code !== 0) {
      console.log(`\n[${name}] exited with code ${code}`);
    }
  });

  children.push(child);
}

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill(signal);
      } catch {
        // ignore
      }
    }
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit(0);
});
