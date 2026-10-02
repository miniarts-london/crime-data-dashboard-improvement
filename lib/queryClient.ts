import { QueryClient } from '@tanstack/react-query';

// Retry only failures that might succeed a second time: a 5xx from our own
// route (upstream trouble). Never a 4xx (bad input), never the police API's
// 503 "too many crimes" (retrying can't shrink the result), and never a
// network error or abort (that's usually a cancelled search).
// (Checks the `status` that lib/police's ApiError carries, rather than
// `instanceof ApiError`, so this module doesn't depend on lib/police.)
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return failureCount < 2 && typeof status === 'number' && status >= 500 && status !== 503;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A dashboard the user is reading shouldn't refetch just because they
        // switched tabs and came back.
        refetchOnWindowFocus: false,
        retry: false,
        gcTime: 30 * 60 * 1000,
      },
    },
  });
}
