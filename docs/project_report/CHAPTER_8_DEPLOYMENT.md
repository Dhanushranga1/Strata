# TicketPilot Project Report - Chapter 8

This chapter documents how TicketPilot is deployed across backend, frontend, database, and environment configuration.

---

## 8.1 Backend Deployment (Railway / Render)

TicketPilot's backend is a FastAPI service deployed on a managed platform to reduce operational overhead. The project supports Railway or Render; the current deployment uses Render.

### Deployment Overview
- **Runtime**: FastAPI with Uvicorn
- **Host**: Render (or Railway as an alternative)
- **Deployment Type**: Web Service
- **Environment**: Production

### Key Backend Steps
1. Create a backend service on Render or Railway.
2. Configure build and start commands:
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
3. Add required environment variables (see section 8.4).
4. Enable HTTPS and set the frontend origin for CORS.
5. Deploy and verify health endpoint at `/api/health`.

### Deployment Notes
- The backend uses Supabase connection pooling for production stability.
- SSL is required for database connections in production.
- Render provides automatic TLS certificates and logs for debugging.

---

## 8.2 Frontend Deployment (Vercel)

The frontend is built with Next.js and deployed to Vercel, which provides automatic builds and CDN delivery.

### Deployment Overview
- **Runtime**: Next.js
- **Host**: Vercel
- **Deployment Type**: Web App
- **Environment**: Production

### Key Frontend Steps
1. Connect the GitHub repository to Vercel.
2. Select the frontend directory as the project root if needed.
3. Set environment variables (see section 8.4).
4. Trigger the build and deploy.
5. Verify the site loads and API calls are routed to the backend.

### Deployment Notes
- Vercel handles automatic HTTPS and global CDN caching.
- Environment variables can be configured per environment (preview vs production).

---

## 8.3 Database Configuration (Supabase)

Supabase provides PostgreSQL and authentication services. It is the system of record for all TicketPilot data.

### Database Setup Steps
1. Create a Supabase project.
2. Obtain the database connection string and API keys.
3. Run SQL migrations in the Supabase SQL editor to create schema and tables.
4. Enable Row-Level Security (RLS) policies.

### Key Configuration Details
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth issues JWTs
- **Isolation**: RLS enforces organization-level access
- **Connection**: Use the Supabase pooler URL for production

---

## 8.4 API Integration and Environment Setup

TicketPilot requires environment variables for secure integration between frontend, backend, database, and AI services.

### Backend Environment Variables
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_JWT_SECRET` - JWT verification secret
- `DATABASE_URL` - PostgreSQL connection string (pooler preferred)
- `GOOGLE_API_KEY` - Gemini embeddings and generation
- `WEB_ORIGIN` - Frontend URL for CORS

### Frontend Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_API_BASE` - Backend base URL

### Integration Flow
1. Frontend uses Supabase Auth to obtain JWT.
2. JWT and org ID are added to API requests.
3. Backend validates JWT, enforces org context, and accesses Supabase data.
4. AI requests are routed to Gemini services for embeddings and generation.

---

This deployment setup ensures TicketPilot is secure, scalable, and ready for real-world usage while minimizing infrastructure management effort.
