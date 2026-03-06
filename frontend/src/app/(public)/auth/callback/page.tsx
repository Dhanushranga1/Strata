'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for magic link token in query params (PKCE flow)
        const searchParams = new URLSearchParams(window.location.search)
        const token = searchParams.get('token')
        const type = searchParams.get('type')
        // ?next= carries a post-auth redirect (e.g. /invite/<token>)
        const next = searchParams.get('next') || '/dashboard'

        // Also check hash fragment for OAuth/implicit flow
        const hashFragment = window.location.hash.substring(1)
        const hashParams = new URLSearchParams(hashFragment)
        const hashToken = hashParams.get('access_token')

        // Handle magic link token verification
        if (token && type === 'magiclink') {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'magiclink'
          })

          if (error) {
            setError(error.message)
            setLoading(false)
            return
          }

          if (data.session) {
            router.replace(next)
            return
          }
        }

        // Handle OAuth/implicit flow (hash fragment)
        if (hashToken) {
          const { data, error } = await supabase.auth.getSession()

          if (error) {
            setError(error.message)
            setLoading(false)
            return
          }

          if (data.session) {
            router.replace(next)
            return
          }
        }

        // Try exchanging code for session (PKCE flow)
        const code = searchParams.get('code')
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            setError(error.message)
            setLoading(false)
            return
          }

          if (data.session) {
            router.replace(next)
            return
          }
        }

        // Check for errors in URL
        const errorParam = searchParams.get('error') || hashParams.get('error')
        const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')

        if (errorParam) {
          setError(errorDescription || errorParam)
          setLoading(false)
          return
        }

        // No auth callback detected
        setTimeout(() => router.replace('/login'), 1000)
      } catch (err) {
        setError('An unexpected error occurred')
        setLoading(false)
      }
    }

    handleAuthCallback()
  }, [router])

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Completing authentication...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="w-full max-w-md rounded-xl border p-6 space-y-4 text-center">
          <div className="text-red-600">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h1 className="text-xl font-semibold">Authentication Error</h1>
            <p className="text-sm mt-2">{error}</p>
          </div>
          <button
            onClick={() => router.replace('/login')}
            className="w-full rounded bg-blue-600 text-white py-2 hover:bg-blue-700"
          >
            Return to Login
          </button>
        </div>
      </main>
    )
  }

  return null
}