"use client";

import { useRef, useMemo } from "react";
import { SWRConfig } from "swr";
import api from "@/lib/api-client";
import { useOrganization } from "@/contexts/OrganizationContext";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  const { currentOrganization, isReady } = useOrganization();

  // Refs so the fetcher/isPaused closures always read the latest values
  // without the SWRConfig value object changing on every render.
  const orgIdRef  = useRef<string | null>(null);
  const readyRef  = useRef(false);
  orgIdRef.current = currentOrganization?.id ?? null;
  readyRef.current = isReady;

  // Stable config object — refs are read at call time, not closure time.
  const config = useMemo(() => ({
    dedupingInterval:    4000,
    revalidateOnFocus:   true,
    revalidateOnReconnect: true,
    revalidateIfStale:   true,
    keepPreviousData:    true,
    shouldRetryOnError:  true,
    errorRetryCount:     3,
    errorRetryInterval:  1000,
    // Block every useSWR call until the org context has finished loading.
    // Prevents the 422 "Organization ID required" error on first render.
    isPaused: () => !readyRef.current || !orgIdRef.current,
    // Always use the latest orgId — never stale because we read from the ref.
    fetcher:  (endpoint: string) => api.get(endpoint, orgIdRef.current),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return <SWRConfig value={config}>{children}</SWRConfig>;
}
