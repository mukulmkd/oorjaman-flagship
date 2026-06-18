import type { ReactNode } from "react";
import { useMemo } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createWebQueryClient } from "./create-web-query-client";
import { OnlineStatusProvider } from "./online-status";
import { SupabaseProvider } from "./supabase-provider";
import { ThemeRoot } from "./theme-root";
import { WebOfflineGate } from "./online-status";

export function PortalAppProviders({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => createWebQueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeRoot>
        <OnlineStatusProvider>
          <SupabaseProvider>
            <WebOfflineGate>{children}</WebOfflineGate>
          </SupabaseProvider>
        </OnlineStatusProvider>
      </ThemeRoot>
    </QueryClientProvider>
  );
}
