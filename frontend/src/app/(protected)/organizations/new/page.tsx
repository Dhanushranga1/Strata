'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Building2, Globe, Link as LinkIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrganization } from '@/contexts/OrganizationContext'
import api from '@/lib/api-client'

interface ValidationErrors {
  name?: string
  slug?: string
  domain?: string
}

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
    .replace(/-+/g, '-')          // Replace multiple hyphens with single
    .slice(0, 50)                 // Max 50 characters
}

// Validation helper
function validateForm(name: string, slug: string, domain: string): ValidationErrors {
  const errors: ValidationErrors = {}

  // Name validation
  if (!name.trim()) {
    errors.name = 'Organization name is required'
  } else if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters'
  } else if (name.length > 100) {
    errors.name = 'Name must be less than 100 characters'
  }

  // Slug validation
  if (!slug.trim()) {
    errors.slug = 'Slug is required'
  } else if (slug.length < 3) {
    errors.slug = 'Slug must be at least 3 characters'
  } else if (slug.length > 50) {
    errors.slug = 'Slug must be less than 50 characters'
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens'
  }

  // Domain validation (optional)
  if (domain && domain.trim()) {
    const domainPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/
    if (!domainPattern.test(domain)) {
      errors.domain = 'Please enter a valid domain (e.g., company.com)'
    }
  }

  return errors
}

export default function NewOrganizationPage() {
  const router = useRouter()
  const { refreshOrganizations } = useOrganization()
  
  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [domain, setDomain] = useState('')
  const [manualSlugEdit, setManualSlugEdit] = useState(false)
  
  // UI state
  const [creating, setCreating] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [touched, setTouched] = useState({
    name: false,
    slug: false,
    domain: false
  })

  // Auto-generate slug when name changes (unless user manually edited it)
  useEffect(() => {
    if (name && !manualSlugEdit) {
      const generatedSlug = generateSlug(name)
      if (generatedSlug.length >= 3) {
        setSlug(generatedSlug)
      }
    }
  }, [name, manualSlugEdit])

  // Validate on blur
  const handleBlur = (field: 'name' | 'slug' | 'domain') => {
    setTouched({ ...touched, [field]: true })
    const validationErrors = validateForm(name, slug, domain)
    setErrors(validationErrors)
  }

  // Handle slug manual edit
  const handleSlugChange = (value: string) => {
    setManualSlugEdit(true)
    setSlug(value.toLowerCase())
  }

  // Create organization
  const handleCreate = async () => {
    // Mark all fields as touched
    setTouched({ name: true, slug: true, domain: true })
    
    // Validate
    const validationErrors = validateForm(name, slug, domain)
    setErrors(validationErrors)
    
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Please fix the errors before submitting')
      return
    }

    setCreating(true)

    try {
      const newOrg = await api.post('/api/organizations', {
        name: name.trim(),
        slug: slug.trim(),
        domain: domain.trim() || null,
        settings: {}
      })

      toast.success('Organization created successfully!', {
        description: `${newOrg.name} is ready to use`
      })

      await refreshOrganizations()
      router.push('/organizations')
    } catch (error: any) {
      console.error('Error creating organization:', error)
      const message: string = error?.message || ''
      if (message.includes('409') || message.toLowerCase().includes('already exists')) {
        setErrors({ ...errors, slug: 'This slug is already taken. Please choose another.' })
        toast.error('Slug already exists', {
          description: 'Please choose a different slug for your organization'
        })
      } else {
        toast.error('Failed to create organization', {
          description: message || 'An unexpected error occurred. Please try again.'
        })
      }
    } finally {
      setCreating(false)
    }
  }

  // Check if form is valid
  const isValid = name.trim().length >= 2 && 
                  slug.trim().length >= 3 && 
                  Object.keys(errors).length === 0

  return (
    <div className="container max-w-2xl py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Button
          variant="ghost"
          onClick={() => router.push('/organizations')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Organizations
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Create Organization</h1>
        </div>
        <p className="text-muted-foreground">
          Set up a new organization to manage tickets, team members, and knowledge base separately.
        </p>
      </motion.div>

      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>
              Choose a name and URL-friendly identifier for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organization Name
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Acme Corporation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => handleBlur('name')}
                className={errors.name && touched.name ? 'border-destructive' : ''}
                maxLength={100}
              />
              {errors.name && touched.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {name.length}/100 characters • This is the display name for your organization
              </p>
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug" className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                URL Slug
                <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  ticketpilot.com/
                </span>
                <Input
                  id="slug"
                  placeholder="acme-corp"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={() => handleBlur('slug')}
                  className={errors.slug && touched.slug ? 'border-destructive' : ''}
                  maxLength={50}
                />
              </div>
              {errors.slug && touched.slug && (
                <p className="text-sm text-destructive">{errors.slug}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {slug.length}/50 characters • Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            {/* Domain (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="domain" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Domain
                <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Input
                id="domain"
                placeholder="company.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onBlur={() => handleBlur('domain')}
                className={errors.domain && touched.domain ? 'border-destructive' : ''}
              />
              {errors.domain && touched.domain && (
                <p className="text-sm text-destructive">{errors.domain}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Company domain for email validation and branding
              </p>
            </div>

            {/* Info Box */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <h4 className="text-sm font-medium">What happens next?</h4>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>You&apos;ll be added as the organization owner</li>
                <li>You can invite team members to join</li>
                <li>All tickets and data will be isolated to this organization</li>
                <li>You can switch between organizations anytime</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push('/organizations')}
                disabled={creating}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !isValid}
                className="flex-1"
              >
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {creating ? 'Creating...' : 'Create Organization'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tips Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">💡 Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <div className="font-medium text-foreground min-w-[100px]">Choose wisely:</div>
              <div>The slug becomes part of your organization&apos;s URL and can&apos;t be changed easily later.</div>
            </div>
            <div className="flex gap-3">
              <div className="font-medium text-foreground min-w-[100px]">Keep it short:</div>
              <div>Use abbreviations or acronyms to keep your slug memorable and easy to type.</div>
            </div>
            <div className="flex gap-3">
              <div className="font-medium text-foreground min-w-[100px]">Team access:</div>
              <div>After creation, you can invite team members from the organization settings.</div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
