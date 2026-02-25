# 🛠️ Development Setup Guide

Welcome to Live Presence development! This guide covers all aspects of setting up your development environment.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Automatic Setup](#automatic-setup)
3. [Manual Setup](#manual-setup)
4. [Environment Management](#environment-management)
5. [IDE Configuration](#ide-configuration)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **RAM**: 8GB minimum (16GB recommended)
- **Disk Space**: 10GB free (for Docker images + dependencies)
- **Network**: Stable internet connection

### Required Software
- **Java 21 JDK** - [Installation Guide](./JAVA_SETUP.md)
- **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop)
- **Git** - Version control
- **Make** (Unix/Mac) or Git Bash (Windows)

### Optional Software
- **Node.js 18+** - For frontend development
- **SDKMAN!** - Java version management (recommended)
- **direnv** - Automatic environment loading
- **IDE**: VS Code, IntelliJ IDEA, or Eclipse

---

## Automatic Setup

### macOS / Linux (Recommended)
```bash
# Make script executable
chmod +x scripts/setup.sh

# Run setup
bash scripts/setup.sh

# Follow the prompts to install Java and verify dependencies
```

### Windows
```bash
# Run from PowerShell or Command Prompt
.\scripts\setup.bat

# Follow the prompts to install Java and verify dependencies
```

**What it does:**
- ✓ Checks Java 21 installation
- ✓ Verifies Docker & Docker Compose  
- ✓ Checks Node.js (optional)
- ✓ Prints next steps

---

## Manual Setup

### Step 1: Install Java 21

See [JAVA_SETUP.md](./JAVA_SETUP.md) for comprehensive instructions.

**Quick install (if you have SDKMAN)**:
```bash
sdk install java 21.0.1-tem
```

**Verify**:
```bash
java -version           # Should show "21.x"
javac -version          # Should show "21.x"
```

### Step 2: Install Docker

Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop) for your OS.

**Verify**:
```bash
docker --version        # Should show version
docker-compose --version  # Should show version
docker ps              # Should connect successfully
```

This automatically includes PostgreSQL 16 and Redis 7 in `docker-compose.local.yml`.

**Note**: See [POSTGRES_SETUP.md](./POSTGRES_SETUP.md) and [REDIS_SETUP.md](./REDIS_SETUP.md) for detailed database configuration and management.

### Step 3: Install Node.js (Optional)

For frontend development: [Download Node.js 18+](https://nodejs.org/)

**Verify**:
```bash
node --version         # Should show 18+
npm --version
```

### Step 4: Verify Setup

```bash
# Build backend (verifies Java)
make build

# Check Docker
docker ps

# You're ready!
```

---

## Environment Management

### Option 1: Make Commands (Simplest)

```bash
make help              # Show all available commands
make check-java        # Verify Java installation
make build             # Build backend
make run               # Run backend
make start-local       # Start all local services
make stop-local        # Stop all services
```

### Option 2: SDKMAN (Version Management)

```bash
# Switch Java version for this project
sdk use java 21.0.1-tem

# Automatic switching (requires .sdkmanrc)
cd live-presence       # Automatically uses Java 21
```

### Option 3: direnv (Automatic Environment)

```bash
# Install direnv
brew install direnv    # macOS
# Or visit: https://direnv.net/

# Enable for this directory
direnv allow .

# Automatically loads when you cd into the project
cd live-presence       # Loads JAVA_HOME, NODE_ENV, etc.
```

### Option 4: Manual Environment Variables

**Linux/macOS** - Add to `~/.bash_profile` or `~/.zshrc`:
```bash
export JAVA_HOME=/path/to/java21
export PATH=$JAVA_HOME/bin:$PATH
```

**Windows** - Set System Environment Variables:
```
JAVA_HOME = C:\Program Files\Java\jdk-21
PATH = %JAVA_HOME%\bin;[existing PATH]
```

---

## IDE Configuration

### VS Code

1. **Install Extensions**:
   - Extension Pack for Java (Microsoft)
   - Gradle for Java (Microsoft)
   - REST Client (Humao)
   - Docker (Microsoft)

2. **Configure `settings.json`**:
   ```json
   {
     "java.jdt.ls.vmargs": "-XX:+UseParallelGC -XX:GCTimeRatio=4 -Xmx1G -Xms100m",
     "java.configuration.checkProjectSettingsExclusions": false,
     "[java]": {
       "editor.defaultFormatter": "redhat.java",
       "editor.formatOnSave": true
     }
   }
   ```

3. **Run Backend**:
   - Press `Ctrl+Shift+D` (Debug)
   - Select "Spring Boot App"
   - Starts on http://localhost:8080

### IntelliJ IDEA

1. **Open Project**:
   - File → Open
   - Select `live-presence` folder

2. **Configure Java**:
   - File → Project Structure
   - SDK → Add JDK
   - Select Java 21 installation
   - Click OK

3. **Run Backend**:
   - Right-click `PresenceApplication.java`
   - Select "Run 'PresenceApplication.main()'"

### Eclipse

1. **Import Project**:
   - File → Import
   - Existing Gradle Project
   - Select `live-presence/backend`

2. **Configure Java**:
   - Window → Preferences
   - Java → Installed JREs
   - Add JRE → Standard VM → Browse to Java 21
   - Mark as default

---

## Common Tasks

### Start Development Stack
```bash
make start-local

# Access:
# - Frontend: http://localhost:3000
# - Backend:  http://localhost:8080
# - Database: localhost:5432 (postgres:postgres)
# - Redis:    localhost:6379
# - Kafka:    localhost:9092
```

### Run Backend Only (Without Docker)
```bash
# Requires: Docker running (for PostgreSQL, Redis, etc.)
make run

# Or with Gradle directly
cd backend
./gradlew bootRun
```

### Run Frontend Only
```bash
cd frontend
npm install              # First time only
npm run dev

# Access: http://localhost:5173
```

### Build Backend JAR
```bash
make build
# Output: backend/build/libs/presence-1.0.0.jar
```

### Run Tests
```bash
cd backend
./gradlew test
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.local.yml logs -f

# Specific service
docker-compose -f docker-compose.local.yml logs -f backend
docker-compose -f docker-compose.local.yml logs -f frontend
docker-compose -f docker-compose.local.yml logs -f postgres
```

### Database Access
```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d livepresence
# Password: postgres

# Or use DBeaver/TablePlus/pgAdmin
# Connection: postgresql://postgres:postgres@localhost:5432/livepresence
```

### Database Access
```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d livepresence
# Password: postgres

# Or use DBeaver/TablePlus/pgAdmin
# Connection: postgresql://postgres:postgres@localhost:5432/livepresence
```

### Redis Access
```bash
# Redis CLI
docker exec -it live-presence-redis redis-cli

# Check key count
redis-cli DBSIZE

# Monitor live commands
redis-cli MONITOR
```

---

## Database Management

### PostgreSQL

See [POSTGRES_SETUP.md](./POSTGRES_SETUP.md) for comprehensive guide.

**Quick Commands**:
```bash
# Backup database
docker exec live-presence-postgres pg_dump -U postgres livepresence > backup.sql

# Restore database
docker exec -i live-presence-postgres psql -U postgres livepresence < backup.sql

# Run migrations
docker exec live-presence-postgres psql -U postgres -d livepresence -f migration.sql

# Connect interactively
docker exec -it live-presence-postgres psql -U postgres -d livepresence
```

### Redis

See [REDIS_SETUP.md](./REDIS_SETUP.md) for comprehensive guide.

**Quick Commands**:
```bash
# Check Redis health
redis-cli PING

# View all keys
redis-cli KEYS '*'

# Monitor real-time commands
redis-cli MONITOR

# Check memory usage
redis-cli INFO memory

# Clear all data
redis-cli FLUSHALL

# Backup Redis
docker exec live-presence-redis redis-cli BGSAVE
docker cp live-presence-redis:/data/dump.rdb ./redis-backup.rdb
```

---

## Troubleshooting

### "Java: command not found"
```bash
# Check if Java is installed
which java              # macOS/Linux
where java              # Windows

# Install Java 21
make install-java

# Or manually: see JAVA_SETUP.md
```

### "Docker daemon not running"
```bash
# Start Docker Desktop (macOS/Windows)
# Or on Linux:
systemctl start docker

# Verify
docker ps
```

### "Port 8080 already in use"
```bash
# Find process using port 8080
lsof -i :8080          # macOS/Linux
netstat -ano | findstr :8080  # Windows

# Kill process or use different port
export SERVER_PORT=8090
make run
```

### "Failed to connect to database"
```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs live-presence-postgres

# Restart database
docker-compose -f docker-compose.local.yml restart postgres

# Wait for health check
docker-compose -f docker-compose.local.yml ps
```

### "Build fails - Gradle not found"
```bash
# Gradle wrapper should be in backend/
ls backend/gradlew

# If missing, you can use Gradle directly
gradle build

# Or rebuild from `backend` directory
cd backend && ./gradlew build
```

### "IDE doesn't recognize Java 21"
```bash
# Restart IDE (important!)
# Then reconfigure Java:

# VS Code: 
# - Ctrl+Shift+P > Java: Configure Java Runtime

# IntelliJ:
# - File > Project Structure > Project > SDK

# Eclipse:
# - Window > Preferences > Java > Installed JREs
```

### "Backend won't start"
```bash
# Check logs
docker-compose -f docker-compose.local.yml logs backend

# Common issues:
# 1. Port 8080 in use → Change port
# 2. Database not ready → Wait 30 seconds
# 3. Java version wrong → Check: java -version
# 4. Memory low → Close other apps
```

---

## Development Workflow

### 1. Backend Changes
```bash
# Edit Java files in backend/src/

# Rebuild (hot reload)
./gradlew compileJava

# Or restart with
make run
```

### 2. Frontend Changes
```bash
# Edit React files in frontend/src/

# Auto-reloads (Vite watch mode)
npm run dev

# No restart needed
```

### 3. Database Schema Changes
```bash
# Add new migration to backend/src/main/resources/db/migration/
# Format: V<number>__<description>.sql

# Run manually
psql -h localhost -U postgres -d livepresence -f migration.sql

# Or let Flyway auto-run on startup
make run
```

### 4. Testing Changes
```bash
# Run all tests
./gradlew test

# Run specific test
./gradlew test --tests "com.example.presence.auth.*"

# With coverage
./gradlew test jacocoTestReport
```

---

## Performance Tips

### For Faster Builds
```bash
# Use Gradle daemon (default, but ensure running)
./gradlew --daemon

# Build with parallel processing
./gradlew build --parallel

# Skip tests
./gradlew build -x test
```

### For Better IDE Performance
```bash
# Increase memory for IDE
export _JAVA_OPTIONS="-Xmx2048m -Xms512m"
```

### For Faster Docker Compose
```bash
# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1

# Rebuild specific service
docker-compose -f docker-compose.local.yml up -d --build postgres
```

---

## Next Steps

- ✅ Complete setup
- 📚 Read [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- 🚀 Read [QUICKSTART.md](./QUICKSTART.md)
- 🏗️ Check [README.md](./README.md) for architecture overview
- 📖 See [API.md](./docs/api/API.md) for endpoint documentation

---

## Need Help?

1. **Java Issues**: See [JAVA_SETUP.md](./JAVA_SETUP.md)
2. **Local Development**: See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
3. **Deployment**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
4. **Architecture**: See [README.md](./README.md)

For more help, check the troubleshooting section above or the documentation files referenced.
