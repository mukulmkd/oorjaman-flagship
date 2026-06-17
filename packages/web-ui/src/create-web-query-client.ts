import { QueryClient } from "@tanstack/react-query";
import { isTransientNetworkError } from "@oorjaman/api";

export function createWebQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isTransientNetworkError(error)) return failureCount < 2;
          return failureCount < 1;
        },
      },
    },
  });
}
