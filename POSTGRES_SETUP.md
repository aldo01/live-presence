# PostgreSQL Setup Guide

## Overview

This project uses **PostgreSQL 16** (latest stable LTS) for persistent data storage.

### Why PostgreSQL?
- ACID compliance for data integrity
- PostGIS extension for geospatial queries (location-based feeds)
- JSON/JSONB support for flexible schemas
- Proven scalability (millions of queries/day)
- Aurora PostgreSQL for production (AWS managed)

---

## Installation

### Option 1: Using Docker (Recommended for Development)

**Included in `docker-compose.local.yml`** - just run:
```bash
make start-local
# Or
docker-compose -f docker-compose.local.yml up -d postgres
```

**Access**:
```bash
# Via psql
psql -h localhost -p 5432 -U postgres -d livepresence

# Or use Docker
docker exec -it live-presence-postgres psql -U postgres -d livepresence
```

**Verify**:
```bash
docker-compose -f docker-compose.local.yml ps postgres
```

---

### Option 2: Manual Installation

#### macOS
```bash
# Using Homebrew
brew install postgresql@16

# Start PostgreSQL (background service)
brew services start postgresql@16

# Or run manually
postgres -D /usr/local/var/postgres

# Access
psql postgres
```

#### Ubuntu/Debian
```bash
# Update package list
sudo apt-get update

# Install PostgreSQL
sudo apt-get install postgresql-16 postgresql-contrib-16

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Auto-start on boot

# Access (as postgres user)
sudo -u postgres psql
```

#### Windows
1. Download [PostgreSQL 16 Installer](https://www.postgresql.org/download/windows/)
2. Run installer, set password
3. Choose port 5432 (default)
4. Launch Stack Builder (optional, to install extensions)

**Verify**:
```powershell
psql --version
```

---

### Option 3: Docker Desktop (No Installation)

**Build and run container**:
```bash
# Run PostgreSQL container
docker run -d \
  --name live-presence-postgres \
  -e POSTGRES_DB=livepresence \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine

# Verify
docker logs live-presence-postgres

# Connect
docker exec -it live-presence-postgres psql -U postgres -d livepresence
```

---

## Configuration

### Connection Parameters

**Local Development**:
```
Host:     localhost
Port:     5432
Database: livepresence
Username: postgres
Password: postgres
```

**Connection String**:
```
postgresql://postgres:postgres@localhost:5432/livepresence
```

### Environment Variables

**Application Configuration** (set in `.env` or pass to Spring Boot):
```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/livepresence
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
SPRING_JPA_HIBERNATE_DDL_AUTO=none     # Use Flyway for migrations
SPRING_FLYWAY_ENABLED=true
SPRING_FLYWAY_LOCATIONS=classpath:db/migration
```

### Database Initialization

**Automatic** (via Flyway on application startup):
```bash
# Backend starts up and runs migrations automatically
make run
# Flyway runs: src/main/resources/db/migration/V*.sql
```

**Manual** (without Spring Boot):
```bash
# Run migration script
psql -h localhost -U postgres -d livepresence -f scripts/init-db.sql

# Or copy-paste SQL from file
psql -h localhost -U postgres -d livepresence
\i scripts/init-db.sql
```

### Verify Setup

```bash
# Connect to database
psql -h localhost -U postgres -d livepresence

# List tables
\dt

# Expected tables:
# - users
# - posts  
# - post_likes
# - post_comments
# - conversations
# - messages
# - user_follows

# Check version
SELECT version();
```

---

## Common Commands

### psql (PostgreSQL CLI)

```bash
# Connect to database
psql -h localhost -U postgres -d livepresence

# Or using PostgreSQL_URL environment variable
psql $POSTGRESQL_URL
```

**Inside psql**:
```sql
-- List all databases
\l

-- Connect to database
\c livepresence

-- List tables
\dt

-- List columns in table
\d users

-- Run SQL file
\i /path/to/migration.sql

-- Export database
\! pg_dump -U postgres livepresence > backup.sql

-- Quit
\q
```

### Docker Commands

```bash
# View PostgreSQL logs
docker logs live-presence-postgres

# Stop database
docker stop live-presence-postgres

# Start database
docker start live-presence-postgres

# Remove container (deletes data)
docker rm live-presence-postgres

# Backup database
docker exec live-presence-postgres pg_dump -U postgres livepresence > backup.sql

# Restore database
docker exec -i live-presence-postgres psql -U postgres livepresence < backup.sql
```

---

## Database Management Tools

### Option 1: pgAdmin (Web UI)

**Run with Docker**:
```bash
docker run -d \
  --name pgadmin \
  -e PGADMIN_DEFAULT_EMAIL=admin@example.com \
  -e PGADMIN_DEFAULT_PASSWORD=admin \
  -p 5050:80 \
  dpage/pgadmin4

# Access: http://localhost:5050
# Login: admin@example.com / admin
```

**Add Connection**:
1. Servers → Register → Server
2. Name: `local-postgres`
3. Host: `host.docker.internal` (or `postgres` if using docker-compose)
4. Port: `5432`
5. Username: `postgres`
6. Password: `postgres`

### Option 2: DBeaver (Desktop App)

1. Download from [dbeaver.io](https://dbeaver.io/)
2. Create New Connection
3. Database: PostgreSQL
4. Fill in:
   - Host: localhost
   - Port: 5432
   - Database: livepresence
   - Username: postgres
   - Password: postgres
5. Test Connection
6. Finish

### Option 3: TablePlus (Lightweight)

1. Download from [tableplus.com](https://tableplus.com/)
2. Create Connection → PostgreSQL
3. Fill in connection details
4. Save and connect

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email CITEXT UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  display_name VARCHAR NOT NULL,
  interest VARCHAR DEFAULT 'General',
  live BOOLEAN DEFAULT true,
  avatar_url VARCHAR,
  bio VARCHAR,
  last_location_lat DOUBLE PRECISION,
  last_location_lon DOUBLE PRECISION,
  followers_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

### Posts Table
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  interest VARCHAR,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lon DOUBLE PRECISION NOT NULL,
  image_url VARCHAR,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_interest ON posts(interest);
```

### Conversations Table
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES users(id),
  user2_id UUID NOT NULL REFERENCES users(id),
  user1_unread INT DEFAULT 0,
  user2_unread INT DEFAULT 0,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_users ON conversations(user1_id, user2_id);
```

### Messages Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
```

---

## Backup & Restore

### Full Database Backup

**Using Docker**:
```bash
# Backup
docker exec live-presence-postgres pg_dump -U postgres livepresence > backup.sql

# With compression
docker exec live-presence-postgres pg_dump -U postgres -Fc livepresence > backup.dump
```

**Local PostgreSQL**:
```bash
pg_dump -h localhost -U postgres livepresence > backup.sql
```

### Restore From Backup

**Using Docker**:
```bash
# From SQL file
docker exec -i live-presence-postgres psql -U postgres livepresence < backup.sql

# From compressed dump
docker exec -i live-presence-postgres pg_restore -U postgres -d livepresence < backup.dump
```

**Local PostgreSQL**:
```bash
psql -h localhost -U postgres livepresence < backup.sql
```

---

## Performance Optimization

### Connection Pooling

**PgBouncer** (lightweight pool):
```bash
# Install
brew install pgbouncer  # macOS
# Or: sudo apt-get install pgbouncer  # Linux

# Configure /etc/pgbouncer/pgbouncer.ini
[databases]
livepresence = host=localhost port=5432 dbname=livepresence

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

**Spring Boot HikariCP** (built-in):
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

### Query Optimization

**Enable Query Logging** (slow queries > 1s):
```sql
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();
```

**Analyze Slow Query**:
```sql
EXPLAIN ANALYZE
SELECT * FROM posts WHERE location_lat BETWEEN 37.7 AND 37.8;
```

**Common Indexes**:
```sql
-- Posts by location (for proximity search)
CREATE INDEX idx_posts_location ON posts USING GIST(ll_to_earth(location_lat, location_lon));

-- Messages by conversation (for chat history)
CREATE INDEX idx_messages_conv_ts ON messages(conversation_id, created_at DESC);

-- Users by email (for login)
CREATE UNIQUE INDEX idx_users_email_lower ON users(LOWER(email));
```

---

## Troubleshooting

### Connection Refused
```bash
# Check if PostgreSQL is running
docker ps | grep postgres
# or
pg_isready -h localhost -p 5432

# Start PostgreSQL
make start-local
# or manually:
docker start live-presence-postgres
```

### "Database does not exist"
```bash
# Create database
docker exec live-presence-postgres createdb -U postgres livepresence

# Or restart containers (auto-creates)
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up -d postgres
```

### "Cannot connect to database"
```bash
# Check logs
docker logs live-presence-postgres

# Verify container is healthy
docker-compose -f docker-compose.local.yml ps

# Check network
docker network ls
docker network inspect live-presence-network

# Restart container
docker-compose -f docker-compose.local.yml restart postgres
```

### "Port 5432 already in use"
```bash
# Find process using port
lsof -i :5432          # macOS/Linux
netstat -ano | findstr :5432  # Windows

# Kill process or use different port
docker run -p 5433:5432 ...  # Change external port
```

### "Out of Memory" or "Too Many Connections"
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Check max connections
SHOW max_connections;

-- Increase limit
ALTER SYSTEM SET max_connections = 500;
SELECT pg_reload_conf();
```

### "Data Corruption" or "Unexpected Shutdown"
```bash
# Check database integrity
docker exec live-presence-postgres pg_validate_heap -t users

# Reindex all tables
docker exec live-presence-postgres reindexdb -U postgres livepresence

# Or backup → recreate → restore
docker exec live-presence-postgres pg_dump -U postgres livepresence > backup.sql
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up -d postgres
docker exec -i live-presence-postgres psql -U postgres livepresence < backup.sql
```

---

## Production Deployment

### AWS RDS Aurora PostgreSQL

**Setup in CDK** (automatic):
```typescript
// From infrastructure/cdk/lib/database-stack.ts
const cluster = new rds.DatabaseCluster(this, 'DatabaseCluster', {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_15_5,
  }),
  // Multi-AZ, encryption, backups, etc.
});
```

**Connection String**:
```
postgresql://presenceadmin:password@aurora-endpoint:5432/livepresence
```

### Database Proxy (RDS Proxy)

**Benefits**:
- Connection pooling (reduce database load)
- IAM authentication
- Query logging
- Automatic failover

**Configured in CDK**:
```typescript
const proxy = this.cluster.addProxy('DatabaseProxy', {
  secrets: [this.secret],
  require TLS: true,
  maxConnectionsPercent: 90,
});
```

### Monitoring & Alerts

```bash
# CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBClusterIdentifier,Value=live-presence-database-dev \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average
```

---

## More Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/16/index.html)
- [PostGIS for Geospatial Queries](https://postgis.net/)
- [pgAdmin](https://www.pgadmin.org/)
- [DBeaver](https://dbeaver.io/)
- [AWS RDS Aurora PostgreSQL](https://aws.amazon.com/rds/aurora/postgresql/)
