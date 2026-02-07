#!/bin/bash

# Local Development Start Script for Live Presence
set -e

echo "🚀 Starting Live Presence Local Development Environment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo -e "${BLUE}📦 Cleaning up old containers...${NC}"
docker-compose -f docker-compose.local.yml down -v 2>/dev/null || true

echo -e "${BLUE}🔨 Building services...${NC}"
docker-compose -f docker-compose.local.yml build --no-cache

echo -e "${BLUE}🚢 Starting infrastructure services (PostgreSQL, Redis)...${NC}"
docker-compose -f docker-compose.local.yml up -d postgres redis

echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
sleep 10

# Check PostgreSQL health
until docker exec live-presence-postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "⏳ Waiting for PostgreSQL..."
    sleep 2
done
echo -e "${GREEN}✅ PostgreSQL is ready!${NC}"

# Check Redis health
until docker exec live-presence-redis redis-cli ping > /dev/null 2>&1; do
    echo "⏳ Waiting for Redis..."
    sleep 2
done
echo -e "${GREEN}✅ Redis is ready!${NC}"

echo -e "${BLUE}🚀 Starting all services...${NC}"
docker-compose -f docker-compose.local.yml up -d

echo -e "${YELLOW}⏳ Waiting for services to start (this may take 1-2 minutes)...${NC}"
sleep 30

echo ""
echo -e "${GREEN}✅ Live Presence is starting up!${NC}"
echo ""
echo "📋 Service URLs:"
echo "   🌐 Frontend:          http://localhost:3000"
echo "   🚪 API Gateway:       http://localhost:8080"
echo "   🔐 Auth Service:      http://localhost:8081"
echo "   👤 User Service:      http://localhost:8082"
echo "   📍 Presence Service:  http://localhost:8083"
echo "   💬 Chat Service:      http://localhost:8084"
echo ""
echo "🗄️  Infrastructure:"
echo "   🐘 PostgreSQL:        localhost:5432"
echo "   🔴 Redis:            localhost:6379"
echo ""
echo "📊 Monitoring:"
echo "   Health Check:        http://localhost:8080/actuator/health"
echo ""
echo "📝 Useful Commands:"
echo "   View logs:           docker-compose -f docker-compose.local.yml logs -f [service-name]"
echo "   Stop all:            docker-compose -f docker-compose.local.yml down"
echo "   Restart service:     docker-compose -f docker-compose.local.yml restart [service-name]"
echo ""
echo "🔍 Checking service health..."

# Wait a bit more for services to fully start
sleep 15

# Check Gateway health
if curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Gateway is healthy!${NC}"
else
    echo -e "${YELLOW}⚠️  Gateway is still starting... Check logs: docker-compose -f docker-compose.local.yml logs gateway${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Setup complete! Access the application at http://localhost:3000${NC}"
echo ""
