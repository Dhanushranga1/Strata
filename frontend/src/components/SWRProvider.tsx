"use client";

import { SWRConfig } from "swr";
import api from "@/lib/api-client";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Deduplicate identical requests within 4s window
        dedupingInterval: 4000,
        // Background revalidation on window focus (instant feel on tab switch)
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        // Don't refetch on mount if data is fresh (< 30s)
        revalidateIfStale: true,
        // Global fetcher — strips boilerplate from every useSWR call
        fetcher: (endpoint: string) => api.get(endpoint),
        // Surface errors but don't retry forever
        shouldRetryOnError: true,
        errorRetryCount: 2,
        errorRetryInterval: 3000,
        // Keep stale data visible while refetching (zero blank screens)
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
