# 🗄️ Database Documentation

Complete guides for setting up and managing PostgreSQL and Redis in the Live Presence project.

---

## Quick Links

### PostgreSQL
- **[Complete Setup Guide](./POSTGRES_SETUP.md)** - Installation, configuration, troubleshooting
- **Connection**: `postgresql://postgres:postgres@localhost:5432/livepresence`
- **Port**: 5432
- **Use Case**: Persistent data storage (users, posts, conversations, messages)

### Redis
- **[Complete Setup Guide](./REDIS_SETUP.md)** - Installation, configuration, troubleshooting
- **Connection**: `redis://localhost:6379`
- **Port**: 6379
- **Use Case**: Real-time presence tracking, caching, message pub/sub

---

## Local Development Setup

Both databases are auto-configured in `docker-compose.local.yml`. Just run:

```bash
# Start all services (including databases)
make start-local

# Or individually
docker-compose -f docker-compose.local.yml up -d postgres
docker-compose -f docker-compose.local.yml up -d redis
```

---

## Common Database Tasks

### Check Database Health
```bash
make db-health
```

### Backup & Restore

#### PostgreSQL
```bash
# Backup
make db-backup-postgres
# Or: ./scripts/backup-postgres.sh [name]

# Restore
make db-restore-postgres
# Or: ./scripts/restore-postgres.sh <file>
```

#### Redis
```bash
# Backup
make db-backup-redis
# Or: ./scripts/backup-redis.sh [name]

# Restore
make db-restore-redis
# Or: ./scripts/restore-redis.sh <file>
```

#### All Databases
```bash
# Backup both
make db-backup
```

### Interactive Access

#### PostgreSQL CLI
```bash
make db-shell-postgres
# Or: docker exec -it live-presence-postgres psql -U postgres -d livepresence
```

#### Redis CLI
```bash
make db-shell-redis
# Or: docker exec -it live-presence-redis redis-cli
```

### Reset Databases
```bash
# Delete all data (use with caution!)
make db-reset
```

---

## Database Schema

### PostgreSQL Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | User accounts & auth | id, email, password_hash, display_name, live, last_location_lat/lon |
| `posts` | Location-based posts | id, user_id, content, interest, location_lat/lon, image_url |
| `post_likes` | Like tracking | id, post_id, user_id |
| `post_comments` | Comment system | id, post_id, user_id, content |
| `conversations` | 1-to-1 chats | id, user1_id, user2_id, user1_unread, user2_unread |
| `messages` | Chat messages | id, conversation_id, sender_id, content, is_read |
| `user_follows` | Social graph | id, follower_id, following_id |

### Redis Keys

| Key Pattern | Type | Purpose | TTL |
|-------------|------|---------|-----|
| `presence:geo` | ZSET | User locations | None |
| `presence:meta:*` | HASH | User metadata | 30s |
| `session:*` | STRING | WebSocket sessions | 15min |
| `cache:user:*` | STRING | Cached profiles | 5min |
| `cache:feed:*` | STRING | Cached feeds | 1min |
| `/topic/chat/*` | STREAM | Chat messages | Variable |

---

## Data Connections in Application

### Backend Configuration
```yaml
# application.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/livepresence
    username: postgres
    password: postgres
  data:
    redis:
      host: localhost
      port: 6379
```

### Environment Variables
```bash
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=livepresence
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=        # Empty for dev
```

---

## Database Management Tools

### pgAdmin (Web UI for PostgreSQL)
```bash
# Start pgAdmin
docker run -d \
  -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL=admin@example.com \
  -e PGADMIN_DEFAULT_PASSWORD=admin \
  dpage/pgadmin4

# Access: http://localhost:5050
# Login: admin@example.com / admin
```

### DBeaver (Desktop App for Both)
1. Download: [dbeaver.io](https://dbeaver.io/)
2. Create PostgreSQL connection to `localhost:5432`
3. Create Redis connection to `localhost:6379`

### TablePlus (Lightweight)
1. Download: [tableplus.com](https://tableplus.com/)
2. Works with both PostgreSQL and Redis

---

## Performance Monitoring

### PostgreSQL

```bash
# Check slow queries
docker exec -it live-presence-postgres psql -U postgres -d livepresence -c \
  "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check connections
docker exec -it live-presence-postgres psql -U postgres -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Check table sizes
docker exec -it live-presence-postgres psql -U postgres -d livepresence -c \
  "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Redis

```bash
# Monitor commands
docker exec -it live-presence-redis redis-cli MONITOR

# Check memory
docker exec -it live-presence-redis redis-cli INFO memory

# Find large keys
docker exec -it live-presence-redis redis-cli --bigkeys

# Check slowlog
docker exec -it live-presence-redis redis-cli SLOWLOG GET 10
```

---

## Troubleshooting

### "psql: error: FATAL: database does not exist"
```bash
# Create database
docker exec live-presence-postgres createdb -U postgres livepresence
```

### "redis-cli: Connection refused"
```bash
# Ensure Redis is running
docker ps | grep redis

# Start if not running
docker start live-presence-redis
```

### "Too many connections" to PostgreSQL
```bash
# Check current connections
docker exec -it live-presence-postgres psql -U postgres -c \
  "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# Increase connection limit
docker exec -it live-presence-postgres psql -U postgres -c \
  "ALTER SYSTEM SET max_connections = 500; SELECT pg_reload_conf();"
```

### Redis Memory Full
```bash
# Check memory usage
docker exec -it live-presence-redis redis-cli INFO memory

# Clear old keys
docker exec -it live-presence-redis redis-cli FLUSHDB

# Or selectively
docker exec -it live-presence-redis redis-cli KEYS "session:*" | \
  docker exec -it live-presence-redis redis-cli DEL
```

---

## Production Deployment

### AWS RDS Aurora PostgreSQL
- Configured in `infrastructure/cdk/lib/database-stack.ts`
- Multi-AZ, encrypted, automatic backups
- Connection: Managed by CDK via Secrets Manager

### AWS ElastiCache Redis
- Configured in `infrastructure/cdk/lib/cache-stack.ts`
- Cluster mode, Multi-AZ, encryption
- AUTH token for security
- Connection: Managed by CDK via Secrets Manager

See [DEPLOYMENT.md](./DEPLOYMENT.md) for AWS setup.

---

## Detailed Guides

- **Quick Commands Reference**: [DATABASE_COMMANDS.md](./DATABASE_COMMANDS.md)
  - PostgreSQL commands (psql, queries, backup/restore)
  - Redis commands (redis-cli, data structures, pub/sub)
  - Docker database commands
  - Make commands
  - GUI tools (pgAdmin, DBeaver, TablePlus)
  - Performance tuning
  - Troubleshooting commands

- **PostgreSQL**: [POSTGRES_SETUP.md](./POSTGRES_SETUP.md)
  - Installation (Docker, Homebrew, Direct)
  - Configuration & optimization
  - Backup & restore
  - Troubleshooting
  - Production AWS RDS setup

- **Redis**: [REDIS_SETUP.md](./REDIS_SETUP.md)
  - Installation (Docker, Homebrew, Direct)
  - Configuration & optimization
  - Geospatial queries
  - Pub/Sub messaging
  - Backup & restore
  - Production AWS ElastiCache setup

---

## Scripts

Located in `scripts/` directory:

| Script | Purpose |
|--------|---------|
| `backup-postgres.sh` | Backup PostgreSQL database |
| `restore-postgres.sh` | Restore PostgreSQL from backup |
| `backup-redis.sh` | Backup Redis database |
| `restore-redis.sh` | Restore Redis from backup |
| `db-health.sh` | Check health of both databases |

---

## Environment Variables Reference

```bash
# PostgreSQL
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/livepresence
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
SPRING_JPA_HIBERNATE_DDL_AUTO=none
SPRING_FLYWAY_ENABLED=true

# Redis
SPRING_DATA_REDIS_HOST=localhost
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_PASSWORD=

# Docker Compose
POSTGRES_DB=livepresence
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

---

## Quick Reference

### Start Stack
```bash
make start-local
```

### Check Health
```bash
make db-health
```

### Backup Everything
```bash
make db-backup
```

### Restore from Backup
```bash
make db-restore-postgres <file>
make db-restore-redis <file>
```

### Interactive Database Access
```bash
make db-shell-postgres
make db-shell-redis
```

### View Logs
```bash
docker-compose -f docker-compose.local.yml logs -f postgres
docker-compose -f docker-compose.local.yml logs -f redis
```

---

For detailed information, see [POSTGRES_SETUP.md](./POSTGRES_SETUP.md) and [REDIS_SETUP.md](./REDIS_SETUP.md).
