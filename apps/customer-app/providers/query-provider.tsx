import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  handleAuthFailureFromError,
  isTransientNetworkError,
  requiresSignInAgain,
} from "@oorjaman/api";
import { supabase } from "../lib/supabase";

export function QueryProvider({ children }: { children: ReactNode }) {
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: (failureCount, error) => {
              if (requiresSignInAgain(error)) return false;
              if (isTransientNetworkError(error)) return failureCount < 2;
              return failureCount < 1;
            },
          },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            if (!supabase) return;
            void handleAuthFailureFromError(supabase, error);
          },
        }),
      }),
    [],
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
