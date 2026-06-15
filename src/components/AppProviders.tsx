"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { DashboardDateRangeProvider } from "@/hooks/useDashboardDateRange";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardDateRangeProvider>{children}</DashboardDateRangeProvider>
    </QueryClientProvider>
  );
}
