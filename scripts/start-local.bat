@echo off
REM Local Development Start Script for Live Presence (Windows)

echo Starting Live Presence Local Development Environment...

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop first.
    exit /b 1
)

echo Cleaning up old containers...
docker-compose -f docker-compose.local.yml down -v 2>nul

echo Building services...
docker-compose -f docker-compose.local.yml build --no-cache

echo Starting infrastructure services (PostgreSQL, Redis)...
docker-compose -f docker-compose.local.yml up -d postgres redis

echo Waiting for database to be ready...
timeout /t 10 /nobreak >nul

:check_postgres
docker exec live-presence-postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo Waiting for PostgreSQL...
    timeout /t 2 /nobreak >nul
    goto check_postgres
)
echo PostgreSQL is ready!

:check_redis
docker exec live-presence-redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo Waiting for Redis...
    timeout /t 2 /nobreak >nul
    goto check_redis
)
echo Redis is ready!

echo Starting all services...
docker-compose -f docker-compose.local.yml up -d

echo Waiting for services to start (this may take 1-2 minutes)...
timeout /t 30 /nobreak >nul

echo.
echo ========================================
echo Live Presence is starting up!
echo ========================================
echo.
echo Service URLs:
echo    Frontend:          http://localhost:3000
echo    API Gateway:       http://localhost:8080
echo    Auth Service:      http://localhost:8081
echo    User Service:      http://localhost:8082
echo    Presence Service:  http://localhost:8083
echo    Chat Service:      http://localhost:8084
echo.
echo Infrastructure:
echo    PostgreSQL:        localhost:5432
echo    Redis:             localhost:6379
echo.
echo Monitoring:
echo    Health Check:      http://localhost:8080/actuator/health
echo.
echo Useful Commands:
echo    View logs:         docker-compose -f docker-compose.local.yml logs -f [service-name]
echo    Stop all:          docker-compose -f docker-compose.local.yml down
echo    Restart service:   docker-compose -f docker-compose.local.yml restart [service-name]
echo.
echo Checking service health...
timeout /t 15 /nobreak >nul

curl -s http://localhost:8080/actuator/health >nul 2>&1
if errorlevel 1 (
    echo WARNING: Gateway is still starting... Check logs: docker-compose -f docker-compose.local.yml logs gateway
) else (
    echo Gateway is healthy!
)

echo.
echo Setup complete! Access the application at http://localhost:3000
echo.
