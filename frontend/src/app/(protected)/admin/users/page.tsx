'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrganization } from '@/contexts/OrganizationContext'
import api from '@/lib/api-client'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageShell } from '@/ui/motion/PageShell'
import { Users, UserPlus, Trash2, ArrowLeft, Search, Shield, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Member {
  organization_id: string
  user_id: string
  role: string
  joined_at: string
  invited_by: string | null
  user_email: string | null
  last_sign_in_at: string | null
}

const ROLE_ORDER = ['owner', 'admin', 'rep', 'member']

const roleBadgeClass: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800 border border-purple-300',
  admin: 'bg-blue-100 text-blue-800 border border-blue-300',
  rep: 'bg-green-100 text-green-800 border border-green-300',
  member: 'bg-gray-100 text-gray-700 border border-gray-300',
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 30) return new Date(dateStr).toLocaleDateString()
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'Just now'
}

function initials(email: string | null): string {
  if (!email) return '?'
  return email[0].toUpperCase()
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { currentOrganization, isReady } = useOrganization()
  const orgId = currentOrganization?.id
  const orgName = currentOrganization?.name ?? 'your organisation'

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [roleChanging, setRoleChanging] = useState<string | null>(null)

  // Remove confirmation dialog
  const [removeDialog, setRemoveDialog] = useState<{ open: boolean; member: Member | null }>({
    open: false,
    member: null,
  })
  const [removing, setRemoving] = useState(false)

  // Invite dialog
  const [inviteDialog, setInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('rep')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ url: string; emailSent: boolean } | null>(null)

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await api.get('/api/me')
        if (userData.role !== 'admin') {
          router.replace('/dashboard')
          return
        }
        setCurrentUser(userData)
      } catch {
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  const loadMembers = useCallback(async (q?: string) => {
    if (!orgId) return
    try {
      setMembersLoading(true)
      const params = q ? `?q=${encodeURIComponent(q)}` : ''
      const data: Member[] = await api.get(`/api/organizations/${orgId}/members${params}`, orgId)
      setMembers(data.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)))
    } catch (e: any) {
      toast.error(e.message || 'Failed to load members')
    } finally {
      setMembersLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    if (currentUser && isReady && orgId) {
      loadMembers()
    }
  }, [currentUser, isReady, orgId, loadMembers])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentUser && orgId) loadMembers(search || undefined)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, currentUser, orgId, loadMembers])

  const handleRoleChange = async (member: Member, newRole: string) => {
    if (newRole === member.role || !orgId) return
    try {
      setRoleChanging(member.user_id)
      await api.patch(`/api/organizations/${orgId}/members/${member.user_id}`, { role: newRole }, orgId)
      setMembers(prev =>
        prev
          .map(m => m.user_id === member.user_id ? { ...m, role: newRole } : m)
          .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
      )
      toast.success(`${member.user_email} is now ${newRole}`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to update role')
    } finally {
      setRoleChanging(null)
    }
  }

  const handleRemove = async () => {
    if (!removeDialog.member || !orgId) return
    const { member } = removeDialog
    try {
      setRemoving(true)
      await api.delete(`/api/organizations/${orgId}/members/${member.user_id}`, orgId)
      setMembers(prev => prev.filter(m => m.user_id !== member.user_id))
      toast.success(`${member.user_email} removed from ${orgName}`)
      setRemoveDialog({ open: false, member: null })
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove member')
    } finally {
      setRemoving(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !orgId) return
    try {
      setInviting(true)
      const data = await api.post(
        `/api/organizations/${orgId}/invites`,
        { email: inviteEmail.trim(), role: inviteRole },
        orgId
      )
      setInviteResult({ url: data.invite_url, emailSent: data.email_sent })
      if (data.email_sent) {
        toast.success(`Invite sent to ${inviteEmail}`)
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to create invite')
    } finally {
      setInviting(false)
    }
  }

  const resetInviteDialog = () => {
    setInviteDialog(false)
    setInviteEmail('')
    setInviteRole('rep')
    setInviting(false)
    setInviteResult(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <PageShell>
      <div className="space-y-6 p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Admin
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Users className="h-6 w-6" />
                Team Members
              </h1>
              <p className="text-sm text-muted-foreground">{orgName}</p>
            </div>
          </div>
          <Button onClick={() => setInviteDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="@email search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Members Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {membersLoading ? 'Loading…' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
            </CardTitle>
            <CardDescription>Manage roles and access for your team</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {membersLoading && members.length === 0 ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No members found{search ? ` for "${search}"` : ''}</p>
              </div>
            ) : (
              <div className="divide-y">
                {members.map(member => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {initials(member.user_email)}
                    </div>

                    {/* Email + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.user_email ?? member.user_id}
                        {member.user_id === currentUser?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last active: {formatRelative(member.last_sign_in_at)}
                        </span>
                        <span>Joined {formatRelative(member.joined_at)}</span>
                      </div>
                    </div>

                    {/* Role selector */}
                    <div className="flex-shrink-0 w-32">
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleRoleChange(member, v)}
                        disabled={
                          roleChanging === member.user_id ||
                          (member.role === 'owner' && members.filter(m => m.role === 'owner').length <= 1)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue>
                            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', roleBadgeClass[member.role] ?? roleBadgeClass.member)}>
                              {member.role}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_ORDER.map(r => (
                            <SelectItem key={r} value={r} className="text-xs">
                              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', roleBadgeClass[r])}>
                                {r}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Remove button — hidden for self and last owner */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={
                        member.user_id === currentUser?.id ||
                        (member.role === 'owner' && members.filter(m => m.role === 'owner').length <= 1)
                      }
                      onClick={() => setRemoveDialog({ open: true, member })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Remove confirmation dialog */}
      <Dialog
        open={removeDialog.open}
        onOpenChange={(open) => !open && setRemoveDialog({ open: false, member: null })}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            <strong>{removeDialog.member?.user_email}</strong> will lose access to{' '}
            <strong>{orgName}</strong>. Their tickets will remain but they will be unassigned.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialog({ open: false, member: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteDialog} onOpenChange={(open) => { if (!open) resetInviteDialog() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite to {orgName}
            </DialogTitle>
          </DialogHeader>
          {inviteResult ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-green-700 font-medium">
                {inviteResult.emailSent
                  ? 'Invite email sent!'
                  : 'Invite created — share this link:'}
              </p>
              <div className="bg-muted rounded-md px-3 py-2 text-xs break-all font-mono">
                {inviteResult.url}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(inviteResult.url)
                  toast.success('Link copied')
                }}
              >
                Copy link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rep">rep</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="member">member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={resetInviteDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? 'Sending…' : 'Send Invite'}
                </Button>
              </DialogFooter>
            </form>
          )}
          {inviteResult && (
            <DialogFooter>
              <Button onClick={resetInviteDialog}>Done</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
