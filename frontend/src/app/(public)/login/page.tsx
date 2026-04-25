'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { FieldError } from '@/components/FieldError'
import { Separator } from '@/components/ui/separator'
import { Mail, Lock, ArrowRight, Sparkles, Eye, EyeOff, Zap, Shield } from 'lucide-react'
import { MeshGradient, FloatingOrbs } from '@/ui/backgrounds/AnimatedBackgrounds'
import { LoadingSpinner, SuccessCheckmark } from '@/ui/components/LoadingComponents'
import { v } from '@/ui/motion/variants'

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState(false)

  const signIn = async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    if (data.session?.access_token) {
      setSuccess(true);
      setTimeout(() => {
        router.replace(redirectTo);
      }, 1500);
    } else {
      setError('Authentication failed: No token received');
    }
  }

  const signInMagic = async () => {
    setLoading(true)
    setError(null)

    const next = redirectTo !== '/dashboard' ? `?next=${encodeURIComponent(redirectTo)}` : ''
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${next}`
      }
    })
    
    setLoading(false)
    
    if (error) { 
      setError(error.message)
      return 
    }
    
    setMagicLinkSent(true)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && email && password) {
      signIn()
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <MeshGradient />
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="mx-auto h-20 w-20 rounded-full bg-success/20 flex items-center justify-center">
            <SuccessCheckmark size="lg" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">Welcome back!</h1>
            <p className="text-muted-foreground">Redirecting to your dashboard...</p>
          </div>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Backgrounds */}
      <MeshGradient />
      <FloatingOrbs />
      
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <motion.div 
        className="w-full max-w-md relative z-10"
        variants={v.fade}
        initial="initial"
        animate="animate"
      >
        {/* Brand Header */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              TicketPilot
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="backdrop-blur-xl bg-card/40 border-border/20 shadow-2xl shadow-primary/5 overflow-hidden">
            {/* Animated border effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-secondary/20 opacity-30" />
            
            <CardHeader className="text-center space-y-4 relative z-10">
              <motion.div
                className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm border border-primary/20 flex items-center justify-center"
                animate={{ 
                  rotate: [0, 360],
                  scale: [1, 1.1, 1],
                }}
                transition={{ 
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                }}
              >
                <Zap className="h-6 w-6 text-primary" />
              </motion.div>
              <div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  Welcome back
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Sign in to your TicketPilot account
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6 relative z-10">
              <motion.div 
                className="space-y-4"
                variants={v.list}
                initial="initial" 
                animate="animate"
              >
                <motion.div variants={v.item} className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground/90">
                    Email address
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="email@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handleKeyPress}
                      disabled={loading}
                      className="pl-9 bg-background/50 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-200"
                      required
                      autoComplete="email"
                    />
                  </div>
                </motion.div>

                <motion.div variants={v.item} className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground/90">
                    Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyPress}
                      disabled={loading}
                      className="pl-9 pr-9 bg-background/50 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-200"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </motion.div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-destructive/10 border border-destructive/20 rounded-md"
                  >
                    <p className="text-destructive text-sm">{error}</p>
                  </motion.div>
                )}

                <motion.div variants={v.item}>
                  <Button
                    onClick={signIn}
                    disabled={loading || !email || !password}
                    className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 border-0 shadow-lg shadow-primary/25"
                    size="lg"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <LoadingSpinner size="sm" />
                        Signing in...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Sign in
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    )}
                  </Button>
                </motion.div>
              </motion.div>

              <div className="relative">
                <Separator className="bg-border/30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-card px-3 text-xs text-muted-foreground backdrop-blur-sm">
                    Or continue with
                  </span>
                </div>
              </div>

              <motion.div 
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Button
                  variant="outline"
                  onClick={signInMagic}
                  disabled={loading || !email}
                  className="w-full bg-background/50 backdrop-blur-sm border-border/50 hover:border-primary/50 hover:bg-primary/5"
                  size="lg"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {magicLinkSent ? 'Magic link sent!' : 'Send magic link'}
                </Button>

                {magicLinkSent && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-success/10 border border-success/20 rounded-md backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2">
                      <SuccessCheckmark size="sm" />
                      <p className="text-sm text-success">
                        Check your email for the magic link to sign in.
                      </p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </CardContent>

            <CardFooter className="justify-center border-t border-border/20 bg-surface/20 backdrop-blur-sm">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link
                  href={redirectTo !== '/dashboard' ? `/signup?redirect=${encodeURIComponent(redirectTo)}` : '/signup'}
                  className="font-medium text-primary hover:text-secondary transition-colors duration-200"
                >
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </Card>
        </motion.div>

        {/* Additional Help */}
        <motion.div 
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-xs text-muted-foreground">
            Having trouble signing in?{' '}
            <Link 
              href="/support" 
              className="text-primary hover:text-secondary transition-colors duration-200"
            >
              Contact support
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}