import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: Infinity,
      retry: 3,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: false,
    },
  },
});
