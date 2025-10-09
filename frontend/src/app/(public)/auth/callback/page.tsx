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
        // Get the hash fragment from the URL
        const hashFragment = window.location.hash.substring(1)
        const params = new URLSearchParams(hashFragment)
        
        // Check if this is an auth callback
        if (params.get('access_token')) {
          const { data, error } = await supabase.auth.getSession()
          
          if (error) {
            console.error('Auth callback error:', error)
            setError(error.message)
            setLoading(false)
            return
          }

          if (data.session) {
            // Successfully authenticated, redirect to dashboard
            router.replace('/dashboard')
            return
          }
        }

        // If we get here, check if there's an error in the URL
        const errorParam = params.get('error')
        const errorDescription = params.get('error_description')
        
        if (errorParam) {
          setError(errorDescription || errorParam)
          setLoading(false)
          return
        }

        // No auth callback detected, redirect to login
        router.replace('/login')
      } catch (err) {
        console.error('Unexpected error during auth callback:', err)
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