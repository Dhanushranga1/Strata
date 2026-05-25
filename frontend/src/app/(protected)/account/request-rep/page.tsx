'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface RoleRequestItem {
  id: string;
  user_id: string;
  email?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  created_at: string;
  decided_at?: string;
}

interface User {
  id: string;
  email: string;
  role: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export default function RequestRepPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [existingRequest, setExistingRequest] =
    useState<RoleRequestItem | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      checkExistingRequest();
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/login');
        return;
      }

      const token = data.session.access_token;
      const response = await fetch(`${API_BASE}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        router.replace('/login');
        return;
      }

      const userData = await response.json();
      setUser(userData);
    } catch {
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const checkExistingRequest = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE}/api/admin/role-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const requests = await response.json();
        const userRequest = requests.find(
          (req: RoleRequestItem) => req.user_id === user?.id
        );
        if (userRequest) {
          setExistingRequest(userRequest);
        }
      }
    } catch {
      // silently ignore
    }
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE}/api/admin/role-requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });

      if (response.ok) {
        const newRequest = await response.json();
        setExistingRequest(newRequest);
        setSubmitted(true);
        setReason('');
      } else {
        const error = await response.text();
        alert(`Failed to submit request: ${error}`);
      }
    } catch {
      alert('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-amber-400 bg-amber-950/30 border-amber-800';
      case 'approved':
        return 'text-green-400 bg-green-950/30 border-green-800';
      case 'denied':
        return 'text-red-400 bg-red-950/30 border-red-800';
      default:
        return 'text-zinc-400 bg-zinc-800/50 border-zinc-700';
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Your request is being reviewed by an administrator.';
      case 'approved':
        return 'Your request has been approved! You now have rep access.';
      case 'denied':
        return 'Your request has been denied. You can submit a new request with additional information.';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[rgb(var(--bg))]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(var(--primary))]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-[rgb(var(--bg))]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">
            Authentication Required
          </h1>
          <Link
            href="/login"
            className="text-[rgb(var(--primary))] hover:underline"
          >
            Please log in
          </Link>
        </div>
      </div>
    );
  }

  if (user.role === 'rep' || user.role === 'admin') {
    return (
      <div className="min-h-screen bg-[rgb(var(--bg))]">
        <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              Access Already Granted
            </h1>
            <p className="text-muted-foreground mb-6">
              You already have{' '}
              <span className="font-medium text-foreground">{user.role}</span>{' '}
              access to TicketPilot.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-[rgb(var(--primary))] text-white rounded-md hover:opacity-90 transition-opacity"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/rep"
                className="px-4 py-2 bg-[rgb(var(--surface2))] text-foreground border border-border rounded-md hover:bg-[rgb(var(--border-v2))] transition-colors"
              >
                Rep Console
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))]">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Request Rep Access
              </h1>
              <p className="text-muted-foreground text-sm">
                Submit a request for customer service representative access
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Existing Request Status */}
        {existingRequest && (
          <div
            className={`p-4 border rounded-lg ${getStatusColor(existingRequest.status)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold capitalize">
                Status: {existingRequest.status}
              </h3>
              <span className="text-xs opacity-75">
                Submitted {formatTimeAgo(existingRequest.created_at)}
              </span>
            </div>
            <p className="text-sm mb-2">
              {getStatusMessage(existingRequest.status)}
            </p>
            {existingRequest.reason && (
              <p className="text-sm opacity-75">
                <span className="font-medium">Your reason:</span>{' '}
                {existingRequest.reason}
              </p>
            )}
            {existingRequest.decided_at && (
              <p className="text-xs opacity-60 mt-1">
                Decided {formatTimeAgo(existingRequest.decided_at)}
              </p>
            )}
          </div>
        )}

        {/* Request Form */}
        {(!existingRequest || existingRequest.status === 'denied') && (
          <div className="bg-card border border-border rounded-lg p-6">
            {submitted ? (
              <div className="text-center py-4">
                <div className="text-green-400 mb-4">
                  <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Request Submitted!
                </h3>
                <p className="text-muted-foreground mb-4">
                  Your request for rep access has been submitted. An
                  administrator will review it shortly.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    checkExistingRequest();
                  }}
                  className="px-4 py-2 bg-[rgb(var(--primary))] text-white rounded-md hover:opacity-90 transition-opacity"
                >
                  View Status
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-foreground mb-6">
                  {existingRequest?.status === 'denied'
                    ? 'Submit New Request'
                    : 'Request Rep Access'}
                </h2>

                <div className="mb-6 p-4 bg-[rgb(var(--surface2))] rounded-lg">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    What rep access gives you
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> View and manage
                      all customer tickets
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> Access the rep
                      console with queue management
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> Escalate tickets
                      and change priorities
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> Assign tickets
                      to yourself or other reps
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> Access knowledge
                      base management tools
                    </li>
                  </ul>
                </div>

                <form onSubmit={submitRequest} className="space-y-4">
                  <div>
                    <label
                      htmlFor="reason"
                      className="block text-sm font-medium text-foreground mb-1.5"
                    >
                      Reason for Request{' '}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Please explain why you need rep access..."
                      rows={4}
                      maxLength={400}
                      className="w-full px-3 py-2 bg-[rgb(var(--surface2))] border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary))/0.5] focus:border-[rgb(var(--primary))] resize-none"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reason.length}/400 characters
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Link
                      href="/dashboard"
                      className="px-4 py-2 border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-[rgb(var(--surface2))] transition-colors text-sm"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-[rgb(var(--primary))] text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity text-sm font-medium"
                    >
                      {submitting ? 'Submitting…' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {/* Already Pending */}
        {existingRequest?.status === 'pending' && (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <div className="text-amber-400 mb-3">
              <svg
                className="mx-auto h-10 w-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Request Under Review
            </h3>
            <p className="text-muted-foreground text-sm">
              You already have a pending request. Please wait for an
              administrator to review it.
            </p>
          </div>
        )}

        {/* Already Approved */}
        {existingRequest?.status === 'approved' && (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <div className="text-green-400 mb-3">
              <svg
                className="mx-auto h-10 w-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Access Granted!
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              Your request has been approved. You now have rep access to
              TicketPilot.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/rep"
                className="px-4 py-2 bg-[rgb(var(--primary))] text-white rounded-md hover:opacity-90 transition-opacity text-sm"
              >
                Go to Rep Console
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-[rgb(var(--surface2))] text-foreground border border-border rounded-md hover:opacity-90 transition-opacity text-sm"
              >
                Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
