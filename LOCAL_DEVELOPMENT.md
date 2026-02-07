# 🏠 Local Development Guide

## Quick Start (5 minutes)

### Prerequisites
- **Docker Desktop** installed and running
- **8GB+ RAM** available for containers
- **Ports available**: 3000, 5432, 6379, 8080-8084

### Windows Users

```bash
# Start all services
.\scripts\start-local.bat

# Stop all services
.\scripts\stop-local.bat
```

### Mac/Linux Users

```bash
# Make scripts executable (first time only)
chmod +x scripts/*.sh

# Start all services
./scripts/start-local.sh

# Stop all services
./scripts/stop-local.sh
```

## 🌐 Access URLs

Once started, access the application:

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:8080
- **Health Check**: http://localhost:8080/actuator/health

### Backend API
- **Backend API**: http://localhost:8080 (monolithic - all endpoints in one service)

### Infrastructure
- **PostgreSQL**: localhost:5432 (user: `postgres`, password: `postgres`, db: `livepresence`)
- **Redis**: localhost:6379

## 📋 Common Commands

### View Logs
```bash
# All services
docker-compose -f docker-compose.local.yml logs -f

# Specific service
docker-compose -f docker-compose.local.yml logs -f backend
docker-compose -f docker-compose.local.yml logs -f frontend
docker-compose -f docker-compose.local.yml logs -f postgres
```

### Restart Services
```bash
# Restart specific service
docker-compose -f docker-compose.local.yml restart backend

# Restart all services
docker-compose -f docker-compose.local.yml restart
```

### Rebuild After Code Changes
```bash
# Rebuild and restart specific service
docker-compose -f docker-compose.local.yml up -d --build backend

# Rebuild all services
docker-compose -f docker-compose.local.yml up -d --build
```

### Clean Restart (Remove All Data)
```bash
# Stop and remove all containers and volumes
docker-compose -f docker-compose.local.yml down -v

# Start fresh
.\scripts\start-local.bat  # Windows
./scripts/start-local.sh   # Mac/Linux
```

### Access Database
```bash
# Using Docker
docker exec -it live-presence-postgres psql -U postgres -d livepresence

# Or use any PostgreSQL client
# Host: localhost
# Port: 5432
# User: postgres
# Password: postgres
# Database: livepresence
```

### Access Redis
```bash
# Redis CLI
docker exec -it live-presence-redis redis-cli

# Test connection
docker exec -it live-presence-redis redis-cli ping
```

## 🔧 Development Workflow

### Making Backend Changes

1. **Edit code** in `backend/src/` or `services/gateway/src/`
2. **Rebuild service**:
   ```bash
   docker-compose -f docker-compose.local.yml up -d --build backend
   ```
3. **View logs**:
   ```bash
   docker-compose -f docker-compose.local.yml logs -f backend
   ```

### Making Frontend Changes

1. **Edit code** in `frontend/src/`
2. **Changes auto-reload** (hot reload enabled)
3. **View in browser**: http://localhost:3000

### Testing API Endpoints

#### Register a User
```bash
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"Test123!\",\"displayName\":\"Test User\"}"
```

#### Login
```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"Test123!\"}"
```

#### Get User Profile (with token)
```bash
set TOKEN=your-access-token-here
curl http://localhost:8080/me -H "Authorization: Bearer %TOKEN%"
```

#### Send Presence Heartbeat
```bash
set TOKEN=your-access-token-here
curl -X POST http://localhost:8080/heartbeat ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"lat\":37.7749,\"lon\":-122.4194}"
```

#### Get Nearby Users
```bash
set TOKEN=your-access-token-here
curl "http://localhost:8080/nearby?lat=37.7749&lon=-122.4194&radiusKm=10" ^
  -H "Authorization: Bearer %TOKEN%"
```

## 🐛 Troubleshooting

### Services Won't Start

**Check Docker is running:**
```bash
docker info
```

**Check available ports:**
```bash
# Windows
netstat -ano | findstr "8080\|3000\|5432\|6379"

# Mac/Linux
lsof -i :8080,3000,5432,6379
```

**Check container status:**
```bash
docker-compose -f docker-compose.local.yml ps
```

### Database Connection Errors

**Check PostgreSQL is running:**
```bash
docker exec live-presence-postgres pg_isready -U postgres
```

**Reset database:**
```bash
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up -d postgres
```

### Redis Connection Errors

**Check Redis is running:**
```bash
docker exec live-presence-redis redis-cli ping
```

**View Redis logs:**
```bash
docker-compose -f docker-compose.local.yml logs redis
```

### Service Takes Too Long to Start

**Increase memory allocated to Docker:**
- Docker Desktop → Settings → Resources → Memory (increase to 6-8GB)

**Check service logs:**
```bash
docker-compose -f docker-compose.local.yml logs -f [service-name]
```

### Port Already in Use

**Find and kill process using port (Windows):**
```bash
netstat -ano | findstr :8080
taskkill /PID [PID] /F
```

**Find and kill process (Mac/Linux):**
```bash
lsof -ti:8080 | xargs kill -9
```

### Frontend Not Loading

**Check frontend logs:**
```bash
docker-compose -f docker-compose.local.yml logs -f frontend
```

**Rebuild frontend:**
```bash
docker-compose -f docker-compose.local.yml up -d --build frontend
```

**Clear browser cache:**
- Ctrl+Shift+R (Windows/Linux)
- Cmd+Shift+R (Mac)

## 🎯 Development Tips

### Use Separate Terminals

**Terminal 1 - Services:**
```bash
docker-compose -f docker-compose.local.yml up
```

**Terminal 2 - Commands:**
```bash
# Run commands, tests, etc.
```

### Enable Debug Logging

Edit `docker-compose.local.yml` and add:
```yaml
environment:
  LOGGING_LEVEL_ROOT: DEBUG
  LOGGING_LEVEL_COM_LIVEPRESENCE: DEBUG
```

### Database Migrations

**Run Flyway migrations:**
```bash
docker exec -it live-presence-backend ./gradlew flywayMigrate
```

**View migration status:**
```bash
docker exec -it live-presence-backend ./gradlew flywayInfo
```

### Performance Optimization

**Reduce build time:**
- Comment out unused services in `docker-compose.local.yml`
- Use `docker-compose -f docker-compose.local.yml up -d postgres redis backend
**Monitor resource usage:**
```bash
docker stats
```

## 📊 Monitoring

### Check All Services Health
```bashBackend Health
```bash
# Backend health
curl http://localhost:8080

### View Real-time Logs
```bash
# All services with colors
docker-compose -f docker-compose.local.yml logs -f --tail=100

# Specific service
docker-compose -f docker-compose.local.yml logs -f gateway --tail=50
```

## 🔄 Reset Everything

If things get completely broken:

```bash
# Stop everything
docker-compose -f docker-compose.local.yml down -v

# Remove all containers and images
docker system prune -a --volumes
backend
# Start fresh
.\scripts\start-local.bat  # Windows
./scripts/start-local.sh   # Mac/Linux
```

## 🆘 Still Having Issues?

1. **Check Docker Desktop is running** and has enough resources
2. **Check logs**: `docker-compose -f docker-compose.local.yml logs -f`
3. **Verify ports are available**: netstat/lsof commands above
4. **Try clean restart**: `docker-compose down -v` then start again
5. **Check Docker version**: `docker --version` (should be 20.10+)

## 📚 Additional Resources

- **Main README**: [../README.md](../README.md)
- **Deployment Guide**: [../DEPLOYMENT.md](../DEPLOYMENT.md)
- **Microservices Docs**: [../services/README.md](../services/README.md)
- **Docker Compose Docs**: https://docs.docker.com/compose/

---

**Happy coding! 🚀**
