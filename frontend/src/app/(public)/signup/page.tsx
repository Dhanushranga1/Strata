'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Mail, Lock, ArrowRight, Sparkles, Eye, EyeOff, UserPlus, Shield, CheckCircle2, AlertCircle } from 'lucide-react'
import { MeshGradient, ParticleFlow } from '@/ui/backgrounds/AnimatedBackgrounds'
import { LoadingSpinner, SuccessCheckmark, PulsingDots } from '@/ui/components/LoadingComponents'
import { v } from '@/ui/motion/variants'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)

  // Password strength checker
  const checkPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordStrength(checkPasswordStrength(value));
  };

  const getStrengthColor = (strength: number) => {
    if (strength < 2) return 'bg-red-500';
    if (strength < 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = (strength: number) => {
    if (strength < 2) return 'Weak';
    if (strength < 4) return 'Medium';
    return 'Strong';
  };

  const signUp = async () => {
    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    setLoading(false)
    
    if (error) {
      setError(error.message)
      return
    }
    
    setSuccess('Check your email for a confirmation link!')
  }

  const signUpMagic = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    setLoading(false)
    
    if (error) {
      setError(error.message)
      return
    }
    
    setSuccess('Magic link sent! Check your email.')
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <MeshGradient />
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="mx-auto h-20 w-20 rounded-full bg-success/20 flex items-center justify-center">
            <SuccessCheckmark size="lg" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">Check your email!</h1>
            <p className="text-muted-foreground">{success}</p>
          </div>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/login">Return to sign in</Link>
          </Button>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Backgrounds */}
      <MeshGradient />
      <ParticleFlow />
      
      {/* Floating elements for signup magic */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-0.5 h-0.5 bg-secondary/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <motion.div 
        className="w-full max-w-lg relative z-10"
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
            <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 via-transparent to-primary/20 opacity-30" />
            
            <CardHeader className="text-center space-y-4 relative z-10">
              <motion.div
                className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-secondary/20 to-primary/20 backdrop-blur-sm border border-secondary/20 flex items-center justify-center"
                animate={{ 
                  rotate: [0, -360],
                  scale: [1, 1.1, 1],
                }}
                transition={{ 
                  rotate: { duration: 25, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
                }}
              >
                <UserPlus className="h-6 w-6 text-secondary" />
              </motion.div>
              <div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  Create your account
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Join TicketPilot and transform your support experience
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
                  <Label htmlFor="signup-email" className="text-sm font-medium text-foreground/90">
                    Email address
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="email@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="pl-9 bg-background/50 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-200"
                      required
                      autoComplete="email"
                    />
                  </div>
                </motion.div>

                <motion.div variants={v.item} className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium text-foreground/90">
                    Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      disabled={loading}
                      className="pl-9 pr-9 bg-background/50 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-200"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  
                  {/* Password strength indicator */}
                  {password && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-2"
                    >
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                              passwordStrength >= level ? getStrengthColor(passwordStrength) : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs ${passwordStrength >= 4 ? 'text-green-600' : passwordStrength >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        Password strength: {getStrengthText(passwordStrength)}
                      </p>
                    </motion.div>
                  )}
                </motion.div>

                <motion.div variants={v.item} className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground/90">
                    Confirm Password
                  </Label>
                  <div className="relative group">
                    <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="pl-9 pr-9 bg-background/50 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-200"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  
                  {/* Password match indicator */}
                  {confirmPassword && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 text-xs"
                    >
                      {password === confirmPassword ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          <span className="text-green-600">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 text-red-600" />
                          <span className="text-red-600">Passwords don't match</span>
                        </>
                      )}
                    </motion.div>
                  )}
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
                    onClick={signUp}
                    disabled={loading || !email || !password || !confirmPassword || password !== confirmPassword}
                    className="w-full bg-gradient-to-r from-secondary to-primary hover:from-secondary/90 hover:to-primary/90 border-0 shadow-lg shadow-secondary/25"
                    size="lg"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <PulsingDots />
                        Creating account...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        Create account
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
                    Or sign up with
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
                  onClick={signUpMagic}
                  disabled={loading || !email}
                  className="w-full bg-background/50 backdrop-blur-sm border-border/50 hover:border-secondary/50 hover:bg-secondary/5"
                  size="lg"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Sign up with magic link
                </Button>
              </motion.div>
            </CardContent>

            <CardFooter className="justify-center border-t border-border/20 bg-surface/20 backdrop-blur-sm">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link 
                  href="/login" 
                  className="font-medium text-primary hover:text-secondary transition-colors duration-200"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </Card>
        </motion.div>

        {/* Security notice */}
        <motion.div 
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-xs text-muted-foreground">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-primary hover:text-secondary transition-colors duration-200">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary hover:text-secondary transition-colors duration-200">
              Privacy Policy
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </main>
  )
}