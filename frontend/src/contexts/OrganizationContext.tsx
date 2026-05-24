'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, usePathname } from 'next/navigation'

// Types matching backend response
interface Organization {
  id: string
  name: string
  slug: string
  your_role: 'owner' | 'admin' | 'member'
  is_default: boolean
  settings: Record<string, unknown>
  plan_id: 'community' | 'starter' | 'business' | 'enterprise'
}

interface User {
  id: string
  email: string
  role: string
}

interface AuthContext {
  user: User
  organizations: Organization[]
  default_organization_id: string | null
}

interface OrganizationContextType {
  // Auth state
  user: User | null
  organizations: Organization[]
  currentOrganization: Organization | null
  defaultOrganizationId: string | null

  // Loading states
  loading: boolean
  switchingOrg: boolean

  // Actions
  switchOrganization: (orgId: string) => void
  refreshOrganizations: () => Promise<void>

  // Helpers
  isReady: boolean
  isOrgMissing: boolean  // true when auth succeeded but no org exists yet
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

// API Base URL with trailing slash removal and fallback to both env vars
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '')

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // State
  const [user, setUser] = useState<User | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [defaultOrganizationId, setDefaultOrganizationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [switchingOrg, setSwitchingOrg] = useState(false)
  const [isOrgMissing, setIsOrgMissing] = useState(false)

  // Load auth context from backend
  const loadAuthContext = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        setLoading(false)
        return
      }

      const response = await fetch(`${API_BASE}/api/auth/context`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          await supabase.auth.signOut()
          router.push('/login')
        }
        setLoading(false)
        return
      }

      const data: AuthContext = await response.json()

      setUser(data.user)
      setOrganizations(data.organizations)
      setDefaultOrganizationId(data.default_organization_id)

      if (data.organizations.length === 0) {
        // Authenticated but no org yet — show onboarding rather than a broken state
        setIsOrgMissing(true)
        setCurrentOrganization(null)
      } else {
        setIsOrgMissing(false)
        const savedOrgId = localStorage.getItem('currentOrganizationId')
        let orgToUse: Organization | null = null

        if (savedOrgId) {
          orgToUse = data.organizations.find(org => org.id === savedOrgId) || null
        }
        if (!orgToUse && data.default_organization_id) {
          orgToUse = data.organizations.find(org => org.id === data.default_organization_id) || null
        }
        if (!orgToUse) {
          orgToUse = data.organizations[0]
        }
        setCurrentOrganization(orgToUse)
        localStorage.setItem('currentOrganizationId', orgToUse.id)

        // Only redirect to onboarding on explicit first-time setup (flag not set + sessionStorage gate)
        const isAdmin = orgToUse.your_role === 'owner' || orgToUse.your_role === 'admin'
        const needsOnboarding = !orgToUse.settings?.onboarding_completed
        const alreadyRedirected = sessionStorage.getItem('onboarding_redirected') === orgToUse.id
        if (isAdmin && needsOnboarding && !alreadyRedirected && !pathname?.startsWith('/onboarding')) {
          sessionStorage.setItem('onboarding_redirected', orgToUse.id)
          router.push('/onboarding')
        }
      }

    } catch {
      // Silently handle — user stays unauthenticated
    } finally {
      setLoading(false)
    }
  }

  const refreshOrganizations = async () => {
    await loadAuthContext()
  }

  const switchOrganization = (orgId: string) => {
    setSwitchingOrg(true)

    const org = organizations.find(o => o.id === orgId)
    if (org) {
      setCurrentOrganization(org)
      localStorage.setItem('currentOrganizationId', orgId)
      setTimeout(() => setSwitchingOrg(false), 300)
    } else {
      setSwitchingOrg(false)
    }
  }

  // Load auth context on mount
  useEffect(() => {
    loadAuthContext()
  }, [])

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        loadAuthContext()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setOrganizations([])
        setCurrentOrganization(null)
        setDefaultOrganizationId(null)
        setIsOrgMissing(false)
        localStorage.removeItem('currentOrganizationId')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Cross-tab org switch sync via storage events
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'currentOrganizationId' && e.newValue && e.newValue !== currentOrganization?.id) {
        const org = organizations.find(o => o.id === e.newValue)
        if (org) setCurrentOrganization(org)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [organizations, currentOrganization])

  const isReady = !loading && user !== null && currentOrganization !== null

  const value: OrganizationContextType = {
    user,
    organizations,
    currentOrganization,
    defaultOrganizationId,
    loading,
    switchingOrg,
    switchOrganization,
    refreshOrganizations,
    isReady,
    isOrgMissing,
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

// Hook to use organization context
export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within OrganizationProvider')
  }
  return context
}

// Hook to get current org ID (for API calls)
export function useCurrentOrgId(): string | null {
  const { currentOrganization } = useOrganization()
  return currentOrganization?.id || null
}

// Hook to get auth token with org header
export async function useAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  
  if (!token) {
    throw new Error('No authentication token available')
  }

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

// Helper to get auth headers with org context
export async function getAuthHeadersWithOrg(orgId: string | null): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  
  if (!token) {
    throw new Error('No authentication token available')
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  if (orgId) {
    headers['X-Organization-ID'] = orgId
  }

  return headers
}
