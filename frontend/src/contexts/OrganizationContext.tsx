'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

// Types matching backend response
interface Organization {
  id: string
  name: string
  slug: string
  your_role: 'owner' | 'admin' | 'member'
  is_default: boolean
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
  
  // Helper
  isReady: boolean
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

// API Base URL with trailing slash removal and fallback to both env vars
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '')

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  
  // State
  const [user, setUser] = useState<User | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [defaultOrganizationId, setDefaultOrganizationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [switchingOrg, setSwitchingOrg] = useState(false)

  // Load auth context from backend
  const loadAuthContext = async () => {
    try {
      console.log('🔐 OrganizationContext: Loading auth context...')
      
      // Get Supabase session
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      
      if (!token) {
        console.log('❌ OrganizationContext: No token found')
        setLoading(false)
        return
      }

      // Call backend /api/auth/context
      const response = await fetch(`${API_BASE}/api/auth/context`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.error('❌ OrganizationContext: Failed to load auth context:', response.status)
        if (response.status === 401) {
          await supabase.auth.signOut()
          router.push('/login')
        }
        setLoading(false)
        return
      }

      const data: AuthContext = await response.json()
      console.log('✅ OrganizationContext: Auth context loaded:', {
        userId: data.user.id,
        orgCount: data.organizations.length,
        defaultOrg: data.default_organization_id
      })

      // Update state
      setUser(data.user)
      setOrganizations(data.organizations)
      setDefaultOrganizationId(data.default_organization_id)

      // Set current organization from localStorage or use default
      const savedOrgId = localStorage.getItem('currentOrganizationId')
      let orgToUse: Organization | null = null

      if (savedOrgId) {
        // Check if saved org is still valid
        orgToUse = data.organizations.find(org => org.id === savedOrgId) || null
      }

      if (!orgToUse && data.default_organization_id) {
        // Use default organization
        orgToUse = data.organizations.find(org => org.id === data.default_organization_id) || null
      }

      if (!orgToUse && data.organizations.length > 0) {
        // Fallback to first organization
        orgToUse = data.organizations[0]
      }

      if (orgToUse) {
        setCurrentOrganization(orgToUse)
        localStorage.setItem('currentOrganizationId', orgToUse.id)
        console.log('✅ OrganizationContext: Current org set to:', orgToUse.name)
      }

    } catch (error) {
      console.error('💥 OrganizationContext: Error loading auth context:', error)
    } finally {
      setLoading(false)
    }
  }

  // Refresh organizations (e.g., after creating new org)
  const refreshOrganizations = async () => {
    console.log('🔄 OrganizationContext: Refreshing organizations...')
    await loadAuthContext()
  }

  // Switch to a different organization
  const switchOrganization = (orgId: string) => {
    console.log('🔄 OrganizationContext: Switching to organization:', orgId)
    setSwitchingOrg(true)

    const org = organizations.find(o => o.id === orgId)
    if (org) {
      setCurrentOrganization(org)
      localStorage.setItem('currentOrganizationId', orgId)
      console.log('✅ OrganizationContext: Switched to:', org.name)
      
      // Trigger a page reload to refresh all data with new org context
      // We'll do a soft reload by just updating the state
      // Components using this context will re-render automatically
      setTimeout(() => setSwitchingOrg(false), 300)
    } else {
      console.error('❌ OrganizationContext: Organization not found:', orgId)
      setSwitchingOrg(false)
    }
  }

  // Load auth context on mount
  useEffect(() => {
    loadAuthContext()
  }, [])

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 OrganizationContext: Auth state changed:', event)
      
      if (event === 'SIGNED_IN') {
        loadAuthContext()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setOrganizations([])
        setCurrentOrganization(null)
        setDefaultOrganizationId(null)
        localStorage.removeItem('currentOrganizationId')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

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
    isReady
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
