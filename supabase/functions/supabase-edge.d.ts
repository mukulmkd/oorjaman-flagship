/**
 * Ambient typings so workspace TypeScript / VS Code understands Supabase Edge
 * function entrypoints without the Deno language server (runtime still uses Deno).
 */
/// <reference path="../../node_modules/@supabase/functions-js/src/edge-runtime.d.ts" />

declare module "https://esm.sh/@supabase/supabase-js@2.49.1" {
  export * from "@supabase/supabase-js";
}

/** Minimal stubs for `@supabase/functions-js` typings (omit `serve` / `env` in bundled .d.ts). */
declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void | Promise<void>;
}
