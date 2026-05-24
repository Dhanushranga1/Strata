# TicketPilot Security Guide

## Table of Contents
1. [Security Features](#security-features)
2. [Environment Variables](#environment-variables)
3. [Rate Limiting](#rate-limiting)
4. [Security Headers](#security-headers)
5. [Production Deployment](#production-deployment)
6. [Secret Management](#secret-management)
7. [Security Checklist](#security-checklist)

---

## Security Features

### ✅ Implemented Security Measures

1. **Authentication & Authorization**
   - Supabase JWT authentication
   - Multi-organization data isolation
   - Row-level security with organization_id checks
   - All API routes protected with `get_current_user` dependency

2. **SQL Injection Protection**
   - 100% parameterized queries using `$1, $2, $3` placeholders
   - No string concatenation in SQL
   - asyncpg prevents SQL injection by design

3. **XSS (Cross-Site Scripting) Protection**
   - React automatically escapes all content
   - No `dangerouslySetInnerHTML` usage
   - Pydantic validates and sanitizes all input

4. **Rate Limiting** ⭐ NEW
   - Endpoint-specific rate limits
   - IP-based tracking
   - Custom limits for expensive operations (AI chat)
   - 429 Too Many Requests response with retry-after

5. **Security Headers** ⭐ NEW
   - Content Security Policy (CSP)
   - X-Frame-Options (clickjacking protection)
   - X-Content-Type-Options (MIME sniffing protection)
   - Strict-Transport-Security (HTTPS enforcement)
   - Referrer-Policy
   - Permissions-Policy

6. **CORS Configuration**
   - Environment-specific CORS rules
   - Production: strict origin validation
   - Development: localhost multi-port support
   - Credentials enabled for authentication

---

## Environment Variables

### ⚠️ CRITICAL: Never Commit These Files

**Protected Files:**
- `backend/.env`
- `frontend/.env.local`
- Any file containing credentials

**Always Use Templates:**
- `backend/.env.example` - Copy and fill in
- `frontend/.env.local.example` - Copy and fill in

### Setting Up Environment Variables

#### Backend (FastAPI)

```bash
# 1. Copy the example file
cp backend/.env.example backend/.env

# 2. Fill in your actual values
nano backend/.env  # or use your preferred editor
```

**Required Variables:**
```bash
# Supabase (Get from: https://app.supabase.com/project/YOUR_PROJECT/settings/api)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_JWT_SECRET=your_jwt_secret_here

# Database (Use connection pooler - port 6543!)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.your-project.supabase.co:6543/postgres

# Google AI
GOOGLE_API_KEY=your_google_api_key_here

# CORS (Production)
WEB_ORIGIN=https://your-production-domain.com
```

#### Frontend (Next.js)

```bash
# 1. Copy the example file
cp frontend/.env.local.example frontend/.env.local

# 2. Fill in your actual values
nano frontend/.env.local
```

**Required Variables:**
```bash
# Supabase (Same as backend)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# API URL (Development vs Production)
NEXT_PUBLIC_API_BASE=http://localhost:8000  # Development
# NEXT_PUBLIC_API_BASE=https://api.your-domain.com  # Production

# Environment
NODE_ENV=production  # or development
```

---

## Rate Limiting

### Configuration

Rate limits are configured in `backend/app/security.py`:

```python
RATE_LIMITS = {
    "auth": "10/minute",          # Authentication endpoints
    "create_ticket": "20/minute",  # Ticket creation
    "ai_chat": "10/minute",        # AI chat (most expensive)
    "general": "100/minute",       # General API calls
    "read": "200/minute"           # Read-only operations
}
```

### How It Works

1. **IP-Based Tracking:** Each unique IP address is tracked separately
2. **Sliding Window:** Counts reset after the time window passes
3. **Graceful Degradation:** Returns 429 status with retry information
4. **Per-Endpoint:** Different limits for different operations

### Response When Rate Limited

```json
{
  "error": "Rate limit exceeded",
  "detail": "Too many requests. Please slow down.",
  "retry_after": 60
}
```

### Adjusting Rate Limits

Edit `backend/app/security.py`:

```python
# For higher traffic, increase limits
RATE_LIMITS = {
    "ai_chat": "30/minute",  # Increase from 10 to 30
    "general": "500/minute"  # Increase from 100 to 500
}
```

### Disabling Rate Limiting (Development Only)

Rate limiting is automatically enabled when `slowapi` is installed. To temporarily disable:

```bash
# Uninstall slowapi
pip uninstall slowapi

# Or set environment variable (not implemented yet)
DISABLE_RATE_LIMITING=true
```

---

## Security Headers

### Implemented Headers

All API responses include these security headers:

#### 1. Content Security Policy (CSP)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'...
```
**Protects Against:** XSS attacks by controlling allowed content sources

#### 2. X-Frame-Options
```
X-Frame-Options: DENY
```
**Protects Against:** Clickjacking (embedding your site in iframes)

#### 3. X-Content-Type-Options
```
X-Content-Type-Options: nosniff
```
**Protects Against:** MIME type confusion attacks

#### 4. Strict-Transport-Security (Production Only)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```
**Protects Against:** Man-in-the-middle attacks (forces HTTPS)

#### 5. Referrer-Policy
```
Referrer-Policy: strict-origin-when-cross-origin
```
**Protects Against:** Referrer leakage (sensitive URL info)

#### 6. Permissions-Policy
```
Permissions-Policy: geolocation=(), microphone=(), camera=()
```
**Protects Against:** Unwanted browser API access

### Testing Security Headers

```bash
# Test your API
curl -I https://api.your-domain.com/api/health

# Should see headers like:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# etc.
```

---

## Production Deployment

### Pre-Deployment Checklist

#### 1. Environment Variables
- [ ] All `.env` files in `.gitignore`
- [ ] Production `.env` files created on server
- [ ] All secrets rotated (new keys generated)
- [ ] `WEB_ORIGIN` set to production URL
- [ ] `NODE_ENV=production`

#### 2. CORS Configuration
- [ ] `WEB_ORIGIN` points to production domain
- [ ] Localhost origins removed (or commented out)
- [ ] Wildcard (`*`) removed from methods/headers

#### 3. Database
- [ ] Using Supabase connection pooler (port 6543)
- [ ] Database password changed from default
- [ ] Connection string uses strong password
- [ ] Row-level security policies enabled

#### 4. API Keys
- [ ] Google API key rotated
- [ ] API key restricted by IP/referrer
- [ ] Billing alerts configured
- [ ] Usage quotas set

#### 5. Security
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] HTTPS enforced (Strict-Transport-Security)
- [ ] Supabase JWT secret rotated

#### 6. Monitoring
- [ ] Error logging enabled
- [ ] Performance monitoring set up
- [ ] Rate limit alerts configured
- [ ] Database query monitoring

### Production Environment Variables

**Backend `.env` (Production):**
```bash
# Use production URLs
SUPABASE_URL=https://your-project.supabase.co
DATABASE_URL=postgresql://postgres:STRONG_PASSWORD@db.your-project.supabase.co:6543/postgres
WEB_ORIGIN=https://app.your-domain.com

# New API keys (rotated from development)
GOOGLE_API_KEY=your_new_production_api_key
SUPABASE_JWT_SECRET=your_new_jwt_secret

# Production settings
NODE_ENV=production
LOG_LEVEL=WARNING
```

**Frontend `.env.local` (Production):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_BASE=https://api.your-domain.com
NODE_ENV=production
```

---

## Secret Management

### Development Workflow

1. **Never commit `.env` files**
2. **Use `.env.example` templates**
3. **Share secrets via secure channels:**
   - 1Password
   - Bitwarden
   - AWS Secrets Manager
   - Azure Key Vault
   - Encrypted files

### Production Secret Management

#### Option 1: Platform Environment Variables
```bash
# Railway
railway variables set SUPABASE_JWT_SECRET=your_secret

# Vercel
vercel env add SUPABASE_JWT_SECRET

# Render
# Use dashboard to add environment variables
```

#### Option 2: Secret Management Service
```python
# AWS Secrets Manager example
import boto3
secrets_client = boto3.client('secretsmanager')
secret = secrets_client.get_secret_value(SecretId='ticketpilot/prod')
```

#### Option 3: Docker Secrets
```yaml
# docker-compose.yml
services:
  api:
    secrets:
      - db_password
secrets:
  db_password:
    external: true
```

### Rotating Secrets

**When to Rotate:**
- Before production launch
- After any security breach
- Every 90 days (best practice)
- When team member leaves

**How to Rotate:**

1. **Supabase JWT Secret:**
   - Go to Supabase Dashboard → Settings → API
   - Click "Generate new secret"
   - Update `.env` files
   - Restart services

2. **Database Password:**
   - Go to Supabase Dashboard → Database → Settings
   - Reset password
   - Update `DATABASE_URL` in `.env`
   - Restart services

3. **Google API Key:**
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Create new API key
   - Delete old key
   - Update `.env` files

---

## Security Checklist

### ✅ Pre-Launch Security Audit

#### Authentication & Authorization
- [x] Supabase JWT authentication implemented
- [x] All protected routes use `get_current_user`
- [x] Multi-org isolation with organization_id filters
- [x] Session management working correctly

#### Input Validation
- [x] Pydantic models on all endpoints
- [x] Type checking enforced
- [x] Custom validators for business logic
- [x] No unvalidated user input

#### Database Security
- [x] Parameterized queries (no SQL injection)
- [x] Connection pooling configured
- [ ] Database indexes created (recommended)
- [x] Row-level security with org_id

#### API Security
- [x] Rate limiting enabled
- [x] CORS configured correctly
- [x] Security headers implemented
- [x] HTTPS enforced in production

#### Environment & Secrets
- [x] `.env` files in `.gitignore`
- [x] `.env.example` templates created
- [ ] Production secrets rotated
- [ ] Secret management documented

#### Frontend Security
- [x] React XSS protection (auto-escaping)
- [x] No `dangerouslySetInnerHTML`
- [x] Supabase client-side auth
- [x] API calls authenticated

#### Error Handling
- [x] Custom exception handlers
- [x] No sensitive data in errors
- [x] Proper HTTP status codes
- [x] Logging configured

#### Monitoring & Logging
- [x] Request logging implemented
- [x] Error logging configured
- [ ] Rate limit monitoring (recommended)
- [ ] Performance monitoring (recommended)

---

## Common Security Questions

### Q: Is the Supabase anon key safe to expose?
**A:** Yes! The anon key is designed to be public. It has limited permissions and works with Row-Level Security (RLS) policies. Never expose the `service_role` key.

### Q: How do I test rate limiting?
**A:** 
```bash
# Send multiple requests quickly
for i in {1..15}; do
  curl http://localhost:8000/api/tickets
done

# Should see 429 after hitting limit
```

### Q: What if I need to increase rate limits?
**A:** Edit `backend/app/security.py` and adjust the `RATE_LIMITS` dictionary. Consider monitoring your API costs.

### Q: How do I debug CORS issues?
**A:**
1. Check browser console for CORS errors
2. Verify `WEB_ORIGIN` in backend `.env`
3. Ensure `NEXT_PUBLIC_API_BASE` matches backend URL
4. Check if preflight (OPTIONS) requests succeed

### Q: Should I use a WAF (Web Application Firewall)?
**A:** For production, yes! Consider:
- Cloudflare (free tier available)
- AWS WAF
- Azure WAF
- Railway/Vercel built-in protection

---

## Emergency Response

### If Secrets Are Compromised

**Immediate Actions:**
1. ✅ Rotate all affected secrets immediately
2. ✅ Check logs for unauthorized access
3. ✅ Review recent database changes
4. ✅ Notify affected users (if data breach)
5. ✅ Update all deployment platforms
6. ✅ Monitor for unusual activity

**Supabase Breach Response:**
```bash
# 1. Generate new JWT secret
# Supabase Dashboard → Settings → API → Generate new secret

# 2. Reset database password
# Supabase Dashboard → Database → Settings → Reset password

# 3. Update environment variables
# On all deployment platforms

# 4. Restart all services
railway restart
vercel redeploy
```

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)

---

**Document Version:** 1.0  
**Last Updated:** October 29, 2025  
**Author:** TicketPilot Security Team  
**Status:** ✅ Production Ready
