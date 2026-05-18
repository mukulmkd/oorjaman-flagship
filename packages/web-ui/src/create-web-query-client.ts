import { QueryClient } from "@tanstack/react-query";
import { isTransientNetworkError } from "@oorjaman/api";

export function createWebQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 20_000,
        retry: (failureCount, error) => {
          if (isTransientNetworkError(error)) return failureCount < 2;
          return failureCount < 1;
        },
      },
    },
  });
}
