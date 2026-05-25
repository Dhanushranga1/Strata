'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Crown,
  Users,
  Star,
  Settings,
  CheckCircle2,
  Loader2,
  ArrowRight,
  UserPlus,
  Copy,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrganization } from '@/contexts/OrganizationContext';
import api from '@/lib/api-client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  role: 'owner' | 'admin' | 'rep' | 'member';
  your_role?: 'owner' | 'admin' | 'rep' | 'member';
  is_default: boolean;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

// Role badge component
function RoleBadge({ role }: { role: string }) {
  const variants: Record<
    string,
    {
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
      icon: React.ElementType;
    }
  > = {
    owner: { variant: 'default', icon: Crown },
    admin: { variant: 'secondary', icon: Settings },
    rep: { variant: 'outline', icon: Users },
    member: { variant: 'outline', icon: Users },
  };

  const config = variants[role] || variants.member;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>
  );
}

// Empty state
function EmptyOrganizationsState({
  onCreateClick,
}: {
  onCreateClick: () => void;
}) {
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
        Organizations help you manage multiple teams, clients, or projects
        separately. Create your first organization to get started.
      </p>
      <Button size="lg" onClick={onCreateClick}>
        <Plus className="w-5 h-5 mr-2" />
        Create Your First Organization
      </Button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Invite Modal
// ---------------------------------------------------------------------------
interface InviteModalProps {
  orgId: string;
  orgName: string;
  open: boolean;
  onClose: () => void;
}

function InviteModal({ orgId, orgName, open, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'rep' | 'admin' | 'member'>('rep');
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const reset = () => {
    setEmail('');
    setRole('rep');
    setLoading(false);
    setInviteUrl(null);
    setEmailSent(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const data = await api.post(
        `/api/organizations/${orgId}/invites`,
        { email, role },
        orgId
      );
      setInviteUrl(data.invite_url);
      setEmailSent(data.email_sent);
      if (data.email_sent) {
        toast.success(`Invite email sent to ${email}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invite');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite a team member
          </DialogTitle>
          <DialogDescription>
            Invite someone to join <strong>{orgName}</strong>. They will receive
            a link to create their account and join your team.
          </DialogDescription>
        </DialogHeader>

        {!inviteUrl ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="rep@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={role}
                onValueChange={v => setRole(v as typeof role)}
                disabled={loading}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rep">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Rep</span>
                      <span className="text-xs text-muted-foreground">
                        Can handle and reply to tickets
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Admin</span>
                      <span className="text-xs text-muted-foreground">
                        Can manage members, KB, and settings
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Member</span>
                      <span className="text-xs text-muted-foreground">
                        Can submit tickets only
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !email.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invite
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            {emailSent ? (
              <div className="flex items-start gap-3 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div className="text-sm text-green-800 dark:text-green-300">
                  <p className="font-medium">Invite email sent!</p>
                  <p className="mt-1 text-green-700 dark:text-green-400">
                    {email} will receive an email with a link to join {orgName}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-medium">Copy and share this invite link</p>
                  <p className="mt-1 text-amber-700 dark:text-amber-400">
                    Email sending is not configured. Copy the link below and
                    share it with {email} directly.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Invite link</Label>
              <div className="flex gap-2">
                <Input
                  value={inviteUrl}
                  readOnly
                  className="text-xs font-mono bg-muted"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                  title="Copy link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This link expires in 7 days.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setInviteUrl(null);
                  setEmail('');
                  setRole('rep');
                }}
              >
                Invite another
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function OrganizationsPage() {
  const router = useRouter();
  const {
    organizations: contextOrgs,
    currentOrganization,
    switchOrganization,
    isReady,
  } = useOrganization();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Load organizations from API for full details
  useEffect(() => {
    const loadOrganizations = async () => {
      if (!isReady) return;

      try {
        const data = await api.get('/api/organizations');
        const items: Organization[] = (data as any[]).map((org: any) => ({
          ...org,
          role: org.your_role || org.role || 'member',
        }));
        setOrganizations(items);
      } catch {
        // Fallback to context organizations with minimal data
        if (contextOrgs) {
          setOrganizations(
            contextOrgs.map(org => ({
              id: org.id,
              name: org.name,
              slug: org.slug,
              domain: null,
              role: (org.your_role as Organization['role']) || 'member',
              your_role: org.your_role as Organization['role'],
              is_default: (org as any).is_default ?? false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }))
          );
        }
      } finally {
        setLoading(false);
      }
    };

    loadOrganizations();
  }, [contextOrgs, isReady]);

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrganization?.id) {
      toast.info('Already viewing this organization');
      return;
    }

    setSwitching(orgId);
    try {
      await switchOrganization(orgId);
      toast.success('Switched organization successfully');
    } catch {
      toast.error('Failed to switch organization');
    } finally {
      setSwitching(null);
    }
  };

  const handleCreateNew = () => {
    router.push('/organizations/new');
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
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
            const isCurrent = org.id === currentOrganization?.id;
            const isSwitching = switching === org.id;
            const canManage = org.role === 'owner' || org.role === 'admin';

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
                          <span>
                            {org.member_count}{' '}
                            {org.member_count === 1 ? 'member' : 'members'}
                          </span>
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
                      Created{' '}
                      {new Date(org.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
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

                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          title="Invite a team member"
                          onClick={() =>
                            setInviteTarget({ id: org.id, name: org.name })
                          }
                        >
                          <UserPlus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
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
                <div className="font-medium text-foreground min-w-[100px]">
                  Isolation:
                </div>
                <div>
                  Each organization has its own tickets, knowledge base, and
                  team members.
                </div>
              </div>
              <div className="flex gap-3">
                <div className="font-medium text-foreground min-w-[100px]">
                  Switching:
                </div>
                <div>
                  You can switch between organizations anytime from the top
                  navigation.
                </div>
              </div>
              <div className="flex gap-3">
                <div className="font-medium text-foreground min-w-[100px]">
                  Inviting:
                </div>
                <div>
                  Click the <UserPlus className="inline h-3 w-3 mx-1" /> button
                  on any organization card to invite team members by email.
                </div>
              </div>
              <div className="flex gap-3">
                <div className="font-medium text-foreground min-w-[100px]">
                  Roles:
                </div>
                <div>
                  <strong>Owner</strong> has full control.
                  <strong className="ml-2">Admin</strong> can manage settings
                  and invite members.
                  <strong className="ml-2">Rep</strong> can handle tickets.
                  <strong className="ml-2">Member</strong> can create tickets.
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Invite Modal */}
      {inviteTarget && (
        <InviteModal
          orgId={inviteTarget.id}
          orgName={inviteTarget.name}
          open={!!inviteTarget}
          onClose={() => setInviteTarget(null)}
        />
      )}
    </div>
  );
}
