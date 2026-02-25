.PHONY: help install-java check-java build run test clean docker-build docker-run

help:
	@echo "Live Presence - Development Commands"
	@echo "======================================"
	@echo ""
	@echo "Java Setup:"
	@echo "  make install-java       Install Java 21 (via SDKMAN)"
	@echo "  make check-java         Verify Java 21 is installed"
	@echo ""
	@echo "Development:"
	@echo "  make build              Build backend JAR"
	@echo "  make run                Run backend locally"
	@echo "  make test               Run unit tests"
	@echo "  make clean              Clean build artifacts"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build       Build Docker image"
	@echo "  make docker-run         Run in Docker container"
	@echo ""
	@echo "Full Stack:"
	@echo "  make start-local        Start all services (Docker Compose)"
	@echo "  make stop-local         Stop all services"
	@echo ""

# ==============================================================================
# Java Setup
# ==============================================================================

install-java:
	@command -v sdk >/dev/null 2>&1 || { \
		echo "Installing SDKMAN..."; \
		curl -s "https://get.sdkman.io" | bash; \
		echo "Please run: source ~/.sdkmanrc"; \
		exit 1; \
	}
	@echo "Installing Java 21..."
	sdk install java 21.0.1-tem
	@echo "✓ Java 21 installed"
	@$(MAKE) check-java

check-java:
	@echo "Checking Java installation..."
	@java -version 2>&1 | head -3
	@echo ""
	@echo "Java home: $$(which java)"
	@javac -version 2>&1
	@echo ""
	@echo "✓ Java 21 ready"

# ==============================================================================
# Backend Build & Run
# ==============================================================================

build:
	@echo "Building backend..."
	cd backend && ./gradlew clean build -x test
	@echo "✓ Build complete"

run:
	@echo "Starting backend on http://localhost:8080"
	cd backend && ./gradlew bootRun

test:
	@echo "Running tests..."
	cd backend && ./gradlew test

clean:
	@echo "Cleaning build artifacts..."
	cd backend && ./gradlew clean
	@echo "✓ Clean complete"

# ==============================================================================
# Docker
# ==============================================================================

docker-build:
	@echo "Building Docker image..."
	docker build -f backend/Dockerfile -t live-presence-backend:latest ./backend
	@echo "✓ Docker image built"

docker-run: docker-build
	@echo "Running Docker container..."
	docker run -p 8080:8080 live-presence-backend:latest

# ==============================================================================
# Local Stack
# ==============================================================================

start-local:
	@echo "Starting local development stack..."
	./scripts/start-local.sh
	@echo "✓ Stack started"
	@echo ""
	@echo "Services available at:"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:8080"
	@echo "  Database: localhost:5432 (postgres/postgres)"
	@echo "  Redis:    localhost:6379"
	@echo ""

stop-local:
	@echo "Stopping local stack..."
	docker-compose -f docker-compose.local.yml down
	@echo "✓ Stack stopped"

# ==============================================================================
# Utilities
# ==============================================================================

health-check:
	@echo "Checking backend health..."
	@curl -s http://localhost:8080/actuator/health | jq .

# ==============================================================================
# Database Operations
# ==============================================================================

db-health:
	@bash scripts/db-health.sh

db-shell-postgres:
	docker exec -it live-presence-postgres psql -U postgres -d livepresence

db-shell-redis:
	docker exec -it live-presence-redis redis-cli

db-backup:
	@bash scripts/backup-postgres.sh
	@bash scripts/backup-redis.sh
	@echo "✓ Both databases backed up"

db-backup-postgres:
	@bash scripts/backup-postgres.sh

db-backup-redis:
	@bash scripts/backup-redis.sh

db-restore-postgres:
	@bash scripts/restore-postgres.sh

db-restore-redis:
	@bash scripts/restore-redis.sh

db-reset:
	@echo "⚠️  WARNING: This will delete all database data"
	@read -p "Continue? (y/n) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose -f docker-compose.local.yml down -v; \
		docker-compose -f docker-compose.local.yml up -d postgres redis; \
		echo "✓ Databases reset"; \
	fi

logs:
	docker-compose -f docker-compose.local.yml logs -f backend
