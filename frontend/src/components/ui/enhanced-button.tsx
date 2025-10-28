/**
 * Enhanced Button Variants with Better UX Feedback
 * Provides loading, success, and error states with smooth animations
 */

import * as React from "react"
import { Loader2, Check, X } from "lucide-react"
import { Button, ButtonProps } from "@/components/ui/button"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface EnhancedButtonProps extends ButtonProps {
  /**
   * Loading state - shows spinner and disables button
   */
  loading?: boolean
  
  /**
   * Success state - shows check icon briefly
   */
  success?: boolean
  
  /**
   * Error state - shows X icon briefly
   */
  error?: boolean
  
  /**
   * Icon to show (overridden by loading/success/error states)
   */
  icon?: React.ReactNode
  
  /**
   * Icon position
   */
  iconPosition?: "left" | "right"
}

export const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({ 
    children, 
    loading, 
    success, 
    error, 
    icon, 
    iconPosition = "left",
    disabled,
    className,
    ...props 
  }, ref) => {
    // Determine which icon to show
    const displayIcon = loading ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : success ? (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <Check className="h-4 w-4" />
      </motion.div>
    ) : error ? (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <X className="h-4 w-4" />
      </motion.div>
    ) : icon

    // Determine button state classes
    const stateClasses = cn(
      success && "bg-green-600 hover:bg-green-600 border-green-600",
      error && "bg-red-600 hover:bg-red-600 border-red-600"
    )

    return (
      <Button
        ref={ref}
        disabled={disabled || loading || success || error}
        className={cn(
          "transition-all duration-200",
          stateClasses,
          className
        )}
        {...props}
      >
        {displayIcon && iconPosition === "left" && (
          <span className="mr-2">{displayIcon}</span>
        )}
        
        <motion.span
          key={loading ? "loading" : success ? "success" : error ? "error" : "default"}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.span>
        
        {displayIcon && iconPosition === "right" && (
          <span className="ml-2">{displayIcon}</span>
        )}
      </Button>
    )
  }
)

EnhancedButton.displayName = "EnhancedButton"

/**
 * Hook for managing button states with automatic reset
 * 
 * Usage:
 * ```tsx
 * const { loading, success, error, setLoading, setSuccess, setError } = useButtonState()
 * 
 * const handleSubmit = async () => {
 *   setLoading(true)
 *   try {
 *     await apiCall()
 *     setSuccess(true) // Auto-resets after 2s
 *   } catch (err) {
 *     setError(true) // Auto-resets after 2s
 *   }
 * }
 * ```
 */
export function useButtonState(resetDelay = 2000) {
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [error, setError] = React.useState(false)

  // Auto-reset success state
  React.useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(false)
        setLoading(false)
      }, resetDelay)
      return () => clearTimeout(timer)
    }
  }, [success, resetDelay])

  // Auto-reset error state
  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(false)
        setLoading(false)
      }, resetDelay)
      return () => clearTimeout(timer)
    }
  }, [error, resetDelay])

  return {
    loading,
    success,
    error,
    setLoading,
    setSuccess,
    setError,
    reset: () => {
      setLoading(false)
      setSuccess(false)
      setError(false)
    }
  }
}
