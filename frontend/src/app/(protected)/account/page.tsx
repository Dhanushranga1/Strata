'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  User,
  Settings, 
  Bell,
  Shield,
  Clock,
  Mail,
  UserCheck,
  ExternalLink
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  role: string
  created_at: string
  last_login?: string
  is_active: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get Supabase session
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const token = sessionData.session.access_token

      const response = await fetch(`${API_BASE}/api/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(`HTTP ${response.status}`)
      }

      const userData = await response.json()
      setUser(userData)
    } catch (error) {
      console.error('Error loading user profile:', error)
      setError('Failed to load user profile')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive'
      case 'rep': return 'secondary'
      default: return 'outline'
    }
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'admin': return 'Full system access and user management'
      case 'rep': return 'Customer support and ticket management'
      case 'customer': return 'Standard user access'
      default: return 'Basic access'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 mb-2">{error}</div>
          <Button onClick={loadUserProfile}>Retry</Button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-muted-foreground mb-2">No user data found</div>
          <Button onClick={() => router.push('/login')}>Go to Login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <User className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your profile and account preferences
          </p>
        </div>
      </div>

      {/* Profile Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Your account details and current role
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email Address</label>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user.email}</span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Account Role</label>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {user.role}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {getRoleDescription(user.role)}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Account Status</label>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={user.is_active ? 'default' : 'secondary'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Member Since</label>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{formatDate(user.created_at)}</span>
              </div>
            </div>
          </div>

          {user.last_login && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Login</label>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{formatDate(user.last_login)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Role Management */}
        {user.role === 'customer' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Role Upgrade
              </CardTitle>
              <CardDescription>
                Request access to support representative features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/account/request-rep">
                <Button className="w-full">
                  Request Rep Access
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              Manage your password and security settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Password management is handled through your authentication provider.
              </div>
              <Button 
                variant="outline" 
                onClick={() => supabase.auth.signOut()}
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure your notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Notification settings will be available in a future update.
              </div>
              <Button variant="outline" disabled className="w-full">
                Configure Notifications
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Preferences
            </CardTitle>
            <CardDescription>
              Customize your account preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Additional preferences and settings will be available in a future update.
              </div>
              <Button variant="outline" disabled className="w-full">
                Manage Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}