import { supabase } from '@/lib/supabaseClient';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '');

// In-memory TTL cache for GET requests (30 s, max 100 entries)
const GET_CACHE_TTL_MS = 30_000;
const GET_CACHE_MAX = 100;
interface CacheEntry {
  data: unknown;
  expiry: number;
  key: string;
}
const getCache = new Map<string, CacheEntry>();

function cacheKey(endpoint: string, orgId?: string | null) {
  return `${orgId ?? ''}::${endpoint}`;
}

function cacheSet(key: string, data: unknown) {
  if (getCache.size >= GET_CACHE_MAX) {
    const oldest = getCache.values().next().value;
    if (oldest) getCache.delete(oldest.key);
  }
  getCache.set(key, { data, expiry: Date.now() + GET_CACHE_TTL_MS, key });
}

function invalidatePrefix(endpoint: string) {
  const base = endpoint.split('?')[0];
  // Walk up path segments: /api/tickets/123/messages → /api/tickets/123/messages,
  // /api/tickets/123, /api/tickets, /api
  const segments = base.split('/');
  for (let i = segments.length; i > 1; i--) {
    const prefix = segments.slice(0, i).join('/');
    for (const k of getCache.keys()) {
      if (k.includes(prefix)) getCache.delete(k);
    }
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  orgId?: string | null;
  headers?: Record<string, string>;
}

/**
 * Make an API call with automatic authentication and organization context
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, orgId, headers: customHeaders = {} } = options;

  // Get auth token
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) {
    throw new Error('No authentication token available');
  }

  // Build headers
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // Add organization ID if provided
  if (orgId) {
    headers['X-Organization-ID'] = orgId;
  }

  // Build request options
  const fetchOptions: RequestInit = {
    method,
    headers,
    cache: 'no-store',
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  const url = `${API_BASE}${endpoint}`;

  // Return cached data for GET requests that haven't expired
  if (method === 'GET') {
    const key = cacheKey(endpoint, orgId);
    const hit = getCache.get(key);
    if (hit && hit.expiry > Date.now()) return hit.data as T;
  }

  // Fetch with 30s timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  fetchOptions.signal = controller.signal;

  // Retry on 502/503 — Render free tier cold-starts return these while waking up
  const MAX_RETRIES = 3;
  let response = await fetch(url, fetchOptions);
  for (
    let attempt = 1;
    attempt <= MAX_RETRIES &&
    (response.status === 502 || response.status === 503);
    attempt++
  ) {
    await new Promise(r => setTimeout(r, 2000 * attempt)); // 2s, 4s, 6s
    response = await fetch(url, fetchOptions);
  }
  clearTimeout(timeoutId);

  // Retry on 401 — token may have expired between SDK auto-refresh ticks
  if (response.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.access_token) {
      headers['Authorization'] = `Bearer ${refreshed.session.access_token}`;
      fetchOptions.headers = headers;
      response = await fetch(url, fetchOptions);
    }
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 502 || status === 503) {
      throw new Error(
        'The server is starting up. Please wait a moment and try again.'
      );
    }
    const errorText = await response.text();
    let errorMessage = `API ${status}: ${errorText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.detail || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  const text = await response.text();
  const responseData = text ? JSON.parse(text) : {};

  if (method === 'GET') {
    cacheSet(cacheKey(endpoint, orgId), responseData);
  } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    invalidatePrefix(endpoint);
  }

  return responseData as T;
}

/**
 * Convenience methods
 */
export const api = {
  get: <T = any>(endpoint: string, orgId?: string | null) =>
    apiCall<T>(endpoint, { method: 'GET', orgId }),

  post: <T = any>(endpoint: string, body: any, orgId?: string | null) =>
    apiCall<T>(endpoint, { method: 'POST', body, orgId }),

  put: <T = any>(endpoint: string, body: any, orgId?: string | null) =>
    apiCall<T>(endpoint, { method: 'PUT', body, orgId }),

  delete: <T = any>(endpoint: string, orgId?: string | null) =>
    apiCall<T>(endpoint, { method: 'DELETE', orgId }),

  patch: <T = any>(endpoint: string, body: any, orgId?: string | null) =>
    apiCall<T>(endpoint, { method: 'PATCH', body, orgId }),
};

/**
 * Get auth token without making an API call
 */
export async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) {
    throw new Error('No authentication token available');
  }

  return token;
}

/**
 * Legacy compatibility - maintains existing apiGet signature
 */
export async function apiGet<T>(path: string): Promise<T> {
  return api.get<T>(path);
}

export default api;
