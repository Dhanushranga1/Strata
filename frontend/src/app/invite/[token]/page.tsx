'use client'

/**
 * Invite Accept Page  —  /invite/[token]
 *
 * This is a public route (no layout wrapper required).
 * It fetches invite metadata from the backend, shows org name + role, and
 * lets the authenticated user accept with one click.
 *
 * States:
 *  1. Loading  – fetching invite info
 *  2. Error    – token not found / expired / already used
 *  3. Not logged in – prompt to sign in / sign up, then come back
 *  4. Ready    – show Accept button
 *  5. Accepted – success, redirect to dashboard
 */

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Building2, CheckCircle2, Loader2, LogIn, Sparkles, UserPlus, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '')

interface InviteInfo {
  organization_id: string
  organization_name: string
  email: string
  role: string
  expires_at: string
  status: string
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Manage members, knowledge base, and organization settings',
  rep: 'Handle and reply to support tickets',
  member: 'Submit support tickets',
}

export default function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  // ── 1. Load session ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // ── 2. Fetch invite metadata (public — no auth needed) ───────────────────
  useEffect(() => {
    if (!token) return

    fetch(`${API_BASE}/api/invites/${token}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail || `Error ${res.status}`)
        }
        return res.json()
      })
      .then(setInvite)
      .catch(err => setLoadError(err.message))
  }, [token])

  // ── 3. Accept invite ─────────────────────────────────────────────────────
  const handleAccept = async () => {
    if (!session) return

    setAccepting(true)
    setAcceptError(null)

    try {
      const res = await fetch(`${API_BASE}/api/invites/${token}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `Error ${res.status}`)
      }

      setAccepted(true)

      // Give user a moment to see the success state then redirect
      setTimeout(() => router.replace('/dashboard'), 2000)
    } catch (err: any) {
      setAcceptError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isLoading = sessionLoading || (!invite && !loadError)

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading invite…</p>
        </div>
      </PageShell>
    )
  }

  if (loadError) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Invite unavailable</h2>
          <p className="text-muted-foreground max-w-sm">{loadError}</p>
          <Button variant="outline" onClick={() => router.replace('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </PageShell>
    )
  }

  if (accepted) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="rounded-full bg-green-100 dark:bg-green-950/40 p-4">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold">Welcome aboard!</h2>
          <p className="text-muted-foreground">
            You have joined <strong>{invite!.organization_name}</strong> as{' '}
            <strong>{invite!.role}</strong>. Redirecting to your dashboard…
          </p>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Org + role summary */}
        <div className="flex flex-col items-center gap-3 text-center pt-2">
          <div className="rounded-full bg-primary/10 p-4">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">You have been invited to join</p>
            <h2 className="text-2xl font-bold mt-1">{invite!.organization_name}</h2>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1 capitalize">
            {invite!.role}
          </Badge>
          {ROLE_DESCRIPTIONS[invite!.role] && (
            <p className="text-sm text-muted-foreground max-w-xs">
              {ROLE_DESCRIPTIONS[invite!.role]}
            </p>
          )}
        </div>

        {/* Auth gate */}
        {!session ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              You need to be signed in to accept this invite.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={() =>
                  router.push(
                    `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`
                  )
                }
              >
                <LogIn className="mr-2 h-4 w-4" />
                Sign in to accept
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  router.push(
                    `/signup?redirect=${encodeURIComponent(`/invite/${token}`)}`
                  )
                }
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create account &amp; accept
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-xs text-muted-foreground">
              Signed in as <strong>{session.user?.email}</strong>
            </p>

            {acceptError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive text-center">
                {acceptError}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept &amp; Join {invite!.organization_name}
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Invite expires {new Date(invite!.expires_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
              })}
            </p>
          </div>
        )}
      </motion.div>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            TicketPilot
          </span>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-center">Team Invitation</CardTitle>
            <CardDescription className="text-center">
              You have been invited to join a team on TicketPilot
            </CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}
