# ─────────────────────────────────────────────────────────────
# TicketPilot — development workflow
# ─────────────────────────────────────────────────────────────
# First-time setup:
#   make setup
#   make migrate
#   make dev
# ─────────────────────────────────────────────────────────────

SHELL := /bin/bash
.PHONY: help setup dev dev-backend dev-frontend migrate \
        test test-frontend test-backend lint type-check build \
        clean deploy-staging deploy-prod docker-up docker-down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | sort \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Setup ───────────────────────────────────────────────────

setup: ## First-time setup: create env files, install deps
	@echo "=== TicketPilot Setup ==="
	@bash setup-dev.sh

install: ## Install all dependencies
	@echo "--- Backend ---"
	cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
	@echo "--- Frontend ---"
	cd frontend && npm install

# ── Development servers ─────────────────────────────────────

dev: ## Start both servers (backend + frontend)
	@echo "Starting backend and frontend in parallel..."
	@trap 'kill 0' EXIT; \
		$(MAKE) dev-backend & \
		$(MAKE) dev-frontend & \
		wait

dev-backend: ## Start backend dev server (uvicorn --reload)
	@echo "--- Backend (port 8000) ---"
	cd backend && source .venv/bin/activate && \
		uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Start frontend dev server (Next.js)
	@echo "--- Frontend (port 3000) ---"
	cd frontend && npm run dev

start: dev  ## Alias for dev

# ── Database ────────────────────────────────────────────────

migrate: ## Run pending database migrations (uses backend connection)
	@echo "--- Running migrations ---"
	cd backend && source .venv/bin/activate && \
		python -c "import asyncio; from app.migration_runner import run_migrations; asyncio.run(run_migrations())"

# ── Testing ─────────────────────────────────────────────────

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	@echo "--- Backend tests ---"
	cd backend && source .venv/bin/activate && pytest -v

test-backend-quick: ## Run backend tests (skip slow)
	@echo "--- Backend tests (quick) ---"
	cd backend && source .venv/bin/activate && pytest -m "not slow" -v

test-frontend: ## Run frontend tests
	@echo "--- Frontend tests ---"
	cd frontend && npm test

test-coverage: ## Run all tests with coverage
	@echo "--- Frontend coverage ---"
	cd frontend && npm run test:coverage
	@echo "--- Backend coverage ---"
	cd backend && source .venv/bin/activate && pytest --cov=app

# ── Lint / format / type-check ─────────────────────────────

lint: lint-frontend lint-backend ## Run all linters

lint-frontend: ## Lint frontend (ESLint + Prettier)
	cd frontend && npm run lint
	cd frontend && npm run format:check

lint-backend: ## Lint backend (Black + isort + mypy + bandit)
	cd backend && source .venv/bin/activate && black --check --diff app/
	cd backend && source .venv/bin/activate && isort --check-only --diff app/
	cd backend && source .venv/bin/activate && mypy app/ --ignore-missing-imports
	cd backend && source .venv/bin/activate && bandit -r app/

format: ## Auto-format all code
	cd frontend && npm run format
	cd backend && source .venv/bin/activate && black app/
	cd backend && source .venv/bin/activate && isort app/

type-check: ## Run TypeScript type checker
	cd frontend && npm run type-check

# ── Build ──────────────────────────────────────────────────

build: ## Build frontend for production
	@echo "--- Frontend build ---"
	cd frontend && npm run build

# ── Clean ──────────────────────────────────────────────────

clean: ## Remove build artifacts and caches
	rm -rf frontend/.next frontend/out frontend/coverage
	rm -rf backend/__pycache__ backend/app/__pycache__
	rm -rf backend/.venv backend/data/faiss backend/data/maps
	rm -rf logs/ backend/data/faiss
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name '*.pyc' -delete
	@echo "Clean complete"

# ── Docker (local PostgreSQL) ──────────────────────────────

docker-up: ## Start local PostgreSQL via docker-compose
	docker compose up -d postgres

docker-down: ## Stop docker-compose services
	docker compose down

docker-logs: ## View docker-compose logs
	docker compose logs -f

# ── Deployment ─────────────────────────────────────────────

deploy-staging: ## Deploy to staging (triggers GitHub Actions)
	@echo "Push to main to trigger staging deploy, or use:"
	@echo "  gh workflow run deploy-staging.yml"

deploy-prod: ## Deploy to production (triggers GitHub Actions manual dispatch)
	@echo "Run: gh workflow run deploy-production.yml"

# ── Demo / seed data ───────────────────────────────────────

seed: ## Seed demo data (backend must be running)
	cd backend && source .venv/bin/activate && python -m demo.seed_demo
