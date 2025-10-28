'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  Building2, 
  Plus, 
  Crown, 
  Users, 
  Star, 
  Settings, 
  CheckCircle2,
  Loader2,
  ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useOrganization } from '@/contexts/OrganizationContext'
import api from '@/lib/api-client'

interface Organization {
  id: string
  name: string
  slug: string
  domain: string | null
  role: 'owner' | 'admin' | 'rep' | 'member'
  is_default: boolean
  member_count?: number
  created_at: string
  updated_at: string
}

interface ContextOrganization {
  id: string
  name: string
  slug: string
  your_role: 'owner' | 'admin' | 'member'
  is_default: boolean
}

// Role badge component
function RoleBadge({ role }: { role: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', icon: any }> = {
    owner: { variant: 'default', icon: Crown },
    admin: { variant: 'secondary', icon: Settings },
    rep: { variant: 'outline', icon: Users },
    member: { variant: 'outline', icon: Users }
  }

  const config = variants[role] || variants.member
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>
  )
}

// Empty state
function EmptyOrganizationsState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 px-4"
    >
      <div className="mx-auto w-24 h-24 mb-6 rounded-full bg-primary/10 flex items-center justify-center">
        <Building2 className="w-12 h-12 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-3">
        No Organizations Yet
      </h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        Organizations help you manage multiple teams, clients, or projects separately. 
        Create your first organization to get started.
      </p>
      <Button size="lg" onClick={onCreateClick}>
        <Plus className="w-5 h-5 mr-2" />
        Create Your First Organization
      </Button>
    </motion.div>
  )
}

export default function OrganizationsPage() {
  const router = useRouter()
  const { 
    organizations: contextOrgs, 
    currentOrganization, 
    switchOrganization,
    refreshOrganizations,
    isReady 
  } = useOrganization()

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)

  // Load organizations from API for full details
  useEffect(() => {
    const loadOrganizations = async () => {
      if (!isReady) return

      try {
        const response = await api.get('/api/organizations')
        if (response.ok) {
          const data = await response.json()
          setOrganizations(data.items || data || [])
        }
      } catch (error) {
        console.error('Failed to load organizations:', error)
        // Fallback to context organizations with minimal data
        if (contextOrgs) {
          const mappedOrgs = contextOrgs.map(org => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            domain: null,
            role: org.your_role as 'owner' | 'admin' | 'rep' | 'member',
            is_default: org.is_default,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }))
          setOrganizations(mappedOrgs)
        }
      } finally {
        setLoading(false)
      }
    }

    loadOrganizations()
  }, [contextOrgs, isReady])

  // Handle switch organization
  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrganization?.id) {
      toast.info('Already viewing this organization')
      return
    }

    setSwitching(orgId)
    try {
      await switchOrganization(orgId)
      toast.success('Switched organization successfully')
      // Optionally redirect to dashboard
      // router.push('/dashboard')
    } catch (error) {
      console.error('Failed to switch organization:', error)
      toast.error('Failed to switch organization')
    } finally {
      setSwitching(null)
    }
  }

  // Handle create new
  const handleCreateNew = () => {
    router.push('/organizations/new')
  }

  // Loading state
  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold">Organizations</h1>
            </div>
            <p className="text-muted-foreground">
              Manage your organizations and switch between them
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            New Organization
          </Button>
        </div>
      </motion.div>

      {/* Organizations List */}
      {organizations.length === 0 ? (
        <EmptyOrganizationsState onCreateClick={handleCreateNew} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org, index) => {
            const isCurrent = org.id === currentOrganization?.id
            const isSwitching = switching === org.id

            return (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className={`relative transition-all hover:shadow-md ${
                    isCurrent ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  {/* Current Badge */}
                  {isCurrent && (
                    <div className="absolute -top-2 -right-2">
                      <Badge className="gap-1 shadow-sm">
                        <CheckCircle2 className="h-3 w-3" />
                        Current
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {org.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <span className="truncate">/{org.slug}</span>
                        </CardDescription>
                      </div>
                      <RoleBadge role={org.role} />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      {org.member_count !== undefined && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{org.member_count} {org.member_count === 1 ? 'member' : 'members'}</span>
                        </div>
                      )}
                      {org.is_default && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span>Default</span>
                        </div>
                      )}
                    </div>

                    {/* Domain */}
                    {org.domain && (
                      <div className="text-xs text-muted-foreground">
                        {org.domain}
                      </div>
                    )}

                    {/* Created Date */}
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(org.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      {!isCurrent ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSwitch(org.id)}
                          disabled={isSwitching}
                        >
                          {isSwitching ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Switching...
                            </>
                          ) : (
                            <>
                              Switch To
                              <ArrowRight className="ml-2 h-3 w-3" />
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => router.push('/dashboard')}
                        >
                          View Dashboard
                        </Button>
                      )}
                      
                      {(org.role === 'owner' || org.role === 'admin') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toast.info('Settings coming soon!')}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Info Card */}
      {organizations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About Organizations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <div className="font-medium text-foreground min-w-[100px]">Isolation:</div>
                <div>Each organization has its own tickets, knowledge base, and team members.</div>
              </div>
              <div className="flex gap-3">
                <div className="font-medium text-foreground min-w-[100px]">Switching:</div>
                <div>You can switch between organizations anytime from the top navigation.</div>
              </div>
              <div className="flex gap-3">
                <div className="font-medium text-foreground min-w-[100px]">Roles:</div>
                <div>
                  <strong>Owner</strong> has full control. 
                  <strong className="ml-2">Admin</strong> can manage settings and members. 
                  <strong className="ml-2">Rep</strong> can handle tickets. 
                  <strong className="ml-2">Member</strong> can create tickets.
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
