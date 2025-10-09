'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

interface RoleRequestItem {
  id: string
  user_id: string
  email?: string
  reason?: string
  status: 'pending' | 'approved' | 'denied' | 'cancelled'
  created_at: string
  decided_at?: string
}

interface User {
  id: string
  email: string
  role: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'

export default function RequestRepPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reason, setReason] = useState('')
  const [existingRequest, setExistingRequest] = useState<RoleRequestItem | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      checkExistingRequest()
    }
  }, [user])

  const checkAuth = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.replace('/login')
        return
      }

      const token = data.session.access_token
      const response = await fetch(`${API_BASE}/api/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        router.replace('/login')
        return
      }

      const userData = await response.json()
      setUser(userData)
    } catch (error) {
      console.error('Auth check failed:', error)
      router.replace('/login')
    } finally {
      setLoading(false)
    }
  }

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  const checkExistingRequest = async () => {
    try {
      const token = await getAuthToken()
      const response = await fetch(`${API_BASE}/api/admin/role-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const requests = await response.json()
        // Find any request for this user
        const userRequest = requests.find((req: RoleRequestItem) => req.user_id === user?.id)
        if (userRequest) {
          setExistingRequest(userRequest)
        }
      }
    } catch (error) {
      console.error('Failed to check existing requests:', error)
    }
  }

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return

    setSubmitting(true)
    try {
      const token = await getAuthToken()
      const response = await fetch(`${API_BASE}/api/admin/role-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason.trim() || null })
      })

      if (response.ok) {
        const newRequest = await response.json()
        setExistingRequest(newRequest)
        setSubmitted(true)
        setReason('')
      } else {
        const error = await response.text()
        alert(`Failed to submit request: ${error}`)
      }
    } catch (error) {
      console.error('Failed to submit request:', error)
      alert('Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'approved': return 'text-green-600 bg-green-50 border-green-200'
      case 'denied': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'pending': return 'Your request is being reviewed by an administrator.'
      case 'approved': return 'Your request has been approved! You now have rep access.'
      case 'denied': return 'Your request has been denied. You can submit a new request with additional information.'
      default: return ''
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Required</h1>
          <Link href="/login" className="text-blue-600 hover:underline">
            Please log in
          </Link>
        </div>
      </div>
    )
  }

  // If user is already rep or admin, no need for this page
  if (user.role === 'rep' || user.role === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Already Granted</h1>
            <p className="text-gray-600 mb-6">
              You already have {user.role} access to TicketPilot.
            </p>
            <div className="flex justify-center space-x-4">
              <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Go to Dashboard
              </Link>
              {user.role === 'rep' || user.role === 'admin' ? (
                <Link href="/rep" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                  Rep Console
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Request Rep Access</h1>
              <p className="text-gray-600">Submit a request for customer service representative access</p>
            </div>
            <Link href="/dashboard" className="px-4 py-2 text-gray-600 hover:text-gray-800">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Existing Request Status */}
        {existingRequest && (
          <div className={`mb-8 p-4 border rounded-lg ${getStatusColor(existingRequest.status)}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Request Status: {existingRequest.status.toUpperCase()}</h3>
              <span className="text-sm">
                Submitted {formatTimeAgo(existingRequest.created_at)}
              </span>
            </div>
            <p className="text-sm mb-2">
              {getStatusMessage(existingRequest.status)}
            </p>
            {existingRequest.reason && (
              <div className="text-sm">
                <strong>Your reason:</strong> {existingRequest.reason}
              </div>
            )}
            {existingRequest.decided_at && (
              <div className="text-sm mt-2">
                Decided {formatTimeAgo(existingRequest.decided_at)}
              </div>
            )}
          </div>
        )}

        {/* Request Form */}
        {(!existingRequest || existingRequest.status === 'denied') && (
          <div className="bg-white rounded-lg shadow p-6">
            {submitted ? (
              <div className="text-center">
                <div className="text-green-600 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Request Submitted!</h3>
                <p className="text-gray-600 mb-4">
                  Your request for rep access has been submitted successfully. 
                  An administrator will review your request and get back to you.
                </p>
                <button
                  onClick={() => {setSubmitted(false); checkExistingRequest()}}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  View Status
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-medium text-gray-900 mb-6">
                  {existingRequest?.status === 'denied' ? 'Submit New Request' : 'Request Rep Access'}
                </h2>
                
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Why Rep Access?</h3>
                  <p className="text-gray-600 mb-4">
                    Rep access allows you to:
                  </p>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 mb-4">
                    <li>View and manage all customer tickets</li>
                    <li>Access the rep console with queue management</li>
                    <li>Escalate tickets and change priorities</li>
                    <li>Assign tickets to yourself or other reps</li>
                    <li>Access knowledge base management tools</li>
                  </ul>
                </div>

                <form onSubmit={submitRequest}>
                  <div className="mb-6">
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Request (Optional)
                    </label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Please explain why you need rep access..."
                      rows={4}
                      maxLength={400}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      {reason.length}/400 characters
                    </p>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <Link 
                      href="/dashboard"
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {/* Already Pending */}
        {existingRequest && existingRequest.status === 'pending' && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Request Under Review</h3>
            <p className="text-gray-600 mb-4">
              You already have a pending request for rep access. Please wait for an administrator to review your request.
            </p>
            <p className="text-sm text-gray-500">
              You cannot submit a new request while one is pending.
            </p>
          </div>
        )}

        {/* Already Approved */}
        {existingRequest && existingRequest.status === 'approved' && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-green-600 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Granted!</h3>
            <p className="text-gray-600 mb-4">
              Your request has been approved. You now have rep access to TicketPilot.
            </p>
            <div className="flex justify-center space-x-4">
              <Link href="/rep" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Go to Rep Console
              </Link>
              <Link href="/dashboard" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}