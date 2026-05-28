"use client";

import { SWRConfig } from "swr";
import api from "@/lib/api-client";
import { useOrganization } from "@/contexts/OrganizationContext";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id ?? null;

  return (
    <SWRConfig
      value={{
        dedupingInterval: 4000,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        revalidateIfStale: true,
        // Pass orgId so every useSWR call sends X-Organization-ID automatically
        fetcher: (endpoint: string) => api.get(endpoint, orgId),
        shouldRetryOnError: true,
        errorRetryCount: 2,
        errorRetryInterval: 3000,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
