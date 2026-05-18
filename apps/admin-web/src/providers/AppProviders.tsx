import type { ReactNode } from "react";
import { useMemo } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createWebQueryClient, OnlineStatusProvider, ThemeRoot, WebOfflineGate } from "@oorjaman/web-ui";
import { SupabaseProvider } from "../lib/supabase-context";

export function AppProviders({ children }: { children: ReactNode }) {
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
