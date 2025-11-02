import { supabase } from '@/lib/supabaseClient'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: any
  orgId?: string | null
  headers?: Record<string, string>
}

/**
 * Make an API call with automatic authentication and organization context
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, orgId, headers: customHeaders = {} } = options

  // Get auth token
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token

  if (!token) {
    throw new Error('No authentication token available')
  }

  // Build headers
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...customHeaders
  }

  // Add organization ID if provided
  if (orgId) {
    headers['X-Organization-ID'] = orgId
  }

  // Build request options
  const fetchOptions: RequestInit = {
    method,
    headers,
    cache: 'no-store'
  }

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body)
  }

  // Make the request
  const url = `${API_BASE}${endpoint}`
  const response = await fetch(url, fetchOptions)

  // Handle response
  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `API ${response.status}: ${errorText}`
    
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.message || errorJson.detail || errorMessage
    } catch {}

    throw new Error(errorMessage)
  }

  // Return JSON response
  return response.json()
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
    apiCall<T>(endpoint, { method: 'PATCH', body, orgId })
}

/**
 * Get auth token without making an API call
 */
export async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token

  if (!token) {
    throw new Error('No authentication token available')
  }

  return token
}

/**
 * Legacy compatibility - maintains existing apiGet signature
 */
export async function apiGet<T>(path: string): Promise<T> {
  return api.get<T>(path)
}

export default api
