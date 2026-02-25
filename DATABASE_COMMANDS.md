# Database Commands Reference

Quick reference for PostgreSQL and Redis commands during development.

---

## 🚀 Quick Start

```bash
# Start all services
make start-local

# Check database health
make db-health

# Access databases
make db-shell-postgres      # PostgreSQL CLI
make db-shell-redis         # Redis CLI
```

---

## PostgreSQL Quick Commands

### Connection

```bash
# Via Make
make db-shell-postgres

# Via Docker
docker exec -it live-presence-postgres psql -U postgres -d livepresence

# Via psql directly (if installed locally)
psql -h localhost -U postgres -d livepresence
```

### Essential psql Commands

```sql
-- List databases
\l

-- Connect to database
\c livepresence

-- List tables
\dt

-- Describe table structure
\d users

-- Show column details
\d+ posts

-- Run SQL file
\i /path/to/migration.sql

-- Count rows
SELECT COUNT(*) FROM users;

-- View last 10 rows
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10;

-- Export query result
\copy (SELECT * FROM users) TO '/tmp/users.csv' WITH CSV

-- Show query execution time
\timing

-- Exit
\q
```

### Database Inspection

```bash
# Database size
docker exec -it live-presence-postgres psql -U postgres -d livepresence -c \
  "SELECT pg_size_pretty(pg_database_size('livepresence'));"

# Table sizes
docker exec -it live-presence-postgres psql -U postgres -d livepresence -c \
  "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size DESC;"

# Connection count
docker exec -it live-presence-postgres psql -U postgres -c \
  "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# Active queries
docker exec -it live-presence-postgres psql -U postgres -c \
  "SELECT query FROM pg_stat_activity WHERE state = 'active';"
```

### Data Operations

```bash
# Backup
make db-backup-postgres
# Or: ./scripts/backup-postgres.sh

# Restore (careful!)
make db-restore-postgres
# Or: ./scripts/restore-postgres.sh <backup-file>

# Reload configuration
docker exec -it live-presence-postgres psql -U postgres -c "SELECT pg_reload_conf();"
```

### Common Queries

```sql
-- Count all tables
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';

-- List all tables
SELECT tablename FROM pg_tables WHERE schemaname='public';

-- Find duplicate email addresses
SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;

-- Find unused indexes
SELECT idx, idx_scan FROM pg_stat_user_indexes WHERE idx_scan = 0;

-- Check slow queries (need pg_stat_statements enabled)
SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;

-- View all constraints
SELECT constraint_name, table_name FROM information_schema.table_constraints WHERE table_schema='public';

-- Get table stats
SELECT relname as table_name, n_live_tup as rows, pg_size_pretty(pg_total_relation_size(relid)) as size 
FROM pg_stat_user_tables ORDER BY n_live_tup DESC;
```

---

## Redis Quick Commands

### Connection

```bash
# Via Make
make db-shell-redis

# Via Docker
docker exec -it live-presence-redis redis-cli

# Directly (if installed locally)
redis-cli
```

### Essential Redis Commands

```redis
-- Connection
PING                           # Test connection (returns PONG)

-- Database
SELECT 0                       # Switch to database 0
SELECT 15                      # Switch to database 15
DBSIZE                         # Number of keys in database
INFO                           # Show server info
INFO memory                    # Show memory stats

-- Keys
KEYS *                         # List all keys (WARNING: slow!)
KEYS presence:*                # List keys matching pattern
EXISTS key-name                # Check if key exists
TYPE key-name                  # Get key type (string, hash, set, etc.)
TTL key-name                   # Get time-to-live (-1=no expiry, -2=not exists)
EXPIRE key-name 300            # Set 5-minute expiry
DEL key-name                   # Delete key
FLUSHDB                        # Delete all keys in database (careful!)
FLUSHALL                       # Delete all keys in all databases (very careful!)

-- String
SET key value                  # Set key
GET key                        # Get value
APPEND key " more"             # Append to value
STRLEN key                     # Get string length
GETRANGE key 0 5               # Get substring
SETEX key 300 value            # Set with 5-min expiry

-- Hash (like objects)
HSET hash-key field value      # Set hash field
HGET hash-key field            # Get hash field
HGETALL hash-key               # Get all fields
HKEYS hash-key                 # List field names
HVALS hash-key                 # List field values
HEXISTS hash-key field         # Check if field exists
HDEL hash-key field            # Delete field
HLEN hash-key                  # Count fields

-- Sorted Set (for geo queries)
GEOADD geo-key lon lat user    # Add location
GEODIST geo-key user1 user2 km # Distance between users
GEORADIUS geo-key lon lat 10 km # Find within radius
GEOHASH geo-key user           # Get geohash
ZRANGE geo-key 0 -1            # List all members

-- Pub/Sub
SUBSCRIBE /topic/chat          # Subscribe to topic
PUBLISH /topic/chat message    # Publish message

-- Monitoring
MONITOR                        # Watch all commands
SLOWLOG GET 10                 # Show 10 slowest commands
SLOWLOG RESET                  # Clear slowlog

-- Persistence
SAVE                           # Synchronous save (blocks!)
BGSAVE                         # Background save
LASTSAVE                       # Last save timestamp

-- Exit
EXIT or QUIT
```

### Data Inspection

```bash
# Count keys
docker exec -it live-presence-redis redis-cli DBSIZE

# Find large keys
docker exec -it live-presence-redis redis-cli --bigkeys

# Memory usage
docker exec -it live-presence-redis redis-cli INFO memory

# Check specific key size
docker exec -it live-presence-redis redis-cli MEMORY USAGE presence:geo

# List all keys with pattern
docker exec -it live-presence-redis redis-cli KEYS "presence:*"

# Monitor commands in real-time
docker exec -it live-presence-redis redis-cli MONITOR
```

### Data Operations

```bash
# Backup
make db-backup-redis
# Or: ./scripts/backup-redis.sh

# Restore
make db-restore-redis
# Or: ./scripts/restore-redis.sh <backup-file>

# Clear specific key pattern
docker exec -it live-presence-redis redis-cli --eval clearkeys.lua , presence:*

# Or manually (slow for large sets)
docker exec -it live-presence-redis redis-cli KEYS "presence:*" | \
  xargs docker exec -it live-presence-redis redis-cli DEL
```

### Common Usage Patterns

```bash
# Get user presence location
docker exec -it live-presence-redis redis-cli GEOPOS presence:geo user-uuid-1

# Find users within 10km
docker exec -it live-presence-redis redis-cli GEORADIUS presence:geo 13.361 38.115 10 km WITHDIST

# Set session with expiry
docker exec -it live-presence-redis redis-cli SETEX session:token-123 900 '{"userId":"uuid"}'

# Get all presence metadata for a user
docker exec -it live-presence-redis redis-cli HGETALL presence:meta:user-uuid-1

# Monitor presence updates
docker exec -it live-presence-redis redis-cli MONITOR | grep presence
```

---

## Docker Database Commands

### PostgreSQL Container

```bash
# View logs
docker logs live-presence-postgres

# Check status
docker ps | grep postgres

# Stop
docker stop live-presence-postgres

# Start
docker start live-presence-postgres

# Restart
docker restart live-presence-postgres

# Remove (deletes data!)
docker rm live-presence-postgres

# Connect with bash
docker exec -it live-presence-postgres bash
```

### Redis Container

```bash
# View logs
docker logs live-presence-redis

# Check status
docker ps | grep redis

# Stop
docker stop live-presence-redis

# Start
docker start live-presence-redis

# Restart
docker restart live-presence-redis

# Remove (deletes data!)
docker rm live-presence-redis

# Connect with sh
docker exec -it live-presence-redis sh
```

### Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.local.yml up -d

# Stop all
docker-compose -f docker-compose.local.yml down

# Remove volumes (deletes data!)
docker-compose -f docker-compose.local.yml down -v

# View logs
docker-compose -f docker-compose.local.yml logs -f

# Logs for specific service
docker-compose -f docker-compose.local.yml logs -f postgres
docker-compose -f docker-compose.local.yml logs -f redis

# Restart service
docker-compose -f docker-compose.local.yml restart postgres
docker-compose -f docker-compose.local.yml restart redis

# Rebuild service
docker-compose -f docker-compose.local.yml up -d --build postgres
```

---

## Make Commands

```bash
# Database health check
make db-health

# Connect to PostgreSQL
make db-shell-postgres

# Connect to Redis
make db-shell-redis

# Backup PostgreSQL
make db-backup-postgres

# Restore PostgreSQL
make db-restore-postgres

# Backup Redis
make db-backup-redis

# Restore Redis
make db-restore-redis

# Backup both
make db-backup

# Reset all databases (delete data!)
make db-reset
```

---

## GUI Tools

### pgAdmin (Web UI for PostgreSQL)

```bash
# Start pgAdmin
docker run -d \
  --name pgadmin \
  -e PGADMIN_DEFAULT_EMAIL=admin@example.com \
  -e PGADMIN_DEFAULT_PASSWORD=admin \
  -p 5050:80 \
  dpage/pgadmin4

# Access: http://localhost:5050
# Login: admin@example.com / admin
```

Connection setup in pgAdmin:
- Name: local-postgres
- Host: host.docker.internal (or postgres if using docker-compose network)
- Port: 5432
- Username: postgres
- Password: postgres

### DBeaver (Desktop App)

1. Download: [dbeaver.io](https://dbeaver.io/)
2. Create PostgreSQL connection:
   - Host: localhost
   - Port: 5432
   - Database: livepresence
   - Username: postgres
   - Password: postgres
3. Create Redis connection:
   - Host: localhost
   - Port: 6379

---

## Performance Tuning Commands

### PostgreSQL

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Log slow queries (> 1 second)
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Analyze table (collect statistics)
ANALYZE users;
ANALYZE posts;

-- Explain query plan
EXPLAIN ANALYZE SELECT * FROM posts WHERE interest = 'Sports';

-- Create index
CREATE INDEX idx_posts_interest ON posts(interest);

-- Rebuild index
REINDEX INDEX idx_posts_interest;

-- Drop unused index
DROP INDEX idx_unused;
```

### Redis

```redis
-- Enable slow log
CONFIG SET slowlog-log-slower-than 10000  # Log queries > 10ms
CONFIG SET slowlog-max-len 128

-- View slow log
SLOWLOG GET

-- Reset slow log
SLOWLOG RESET

-- Check memory usage
MEMORY DOCTOR

-- Set max memory
CONFIG SET maxmemory 256mb

-- Set eviction policy
CONFIG SET maxmemory-policy allkeys-lru

-- Save config
CONFIG REWRITE
```

---

## Troubleshooting Commands

### PostgreSQL Issues

```bash
# Check if accepting connections
docker exec live-presence-postgres pg_isready -U postgres

# Force stop stuck connections
docker exec -it live-presence-postgres psql -U postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='livepresence' AND pid <> pg_backend_pid();"

# Check active locks
docker exec -it live-presence-postgres psql -U postgres -c \
  "SELECT relation::regclass, * FROM pg_locks WHERE NOT granted;"

# Reindex database
docker exec live-presence-postgres reindexdb -U postgres livepresence

# Check integrity
docker exec live-presence-postgres pg_validate_heap -t users
```

### Redis Issues

```bash
# Check memory
docker exec -it live-presence-redis redis-cli INFO memory

# Clear memory
docker exec -it live-presence-redis redis-cli MEMORY PURGE

# Check for blocked clients
docker exec -it live-presence-redis redis-cli CLIENT LIST | grep BLOCKED

# Kill slow commands
docker exec -it live-presence-redis redis-cli CLIENT KILL TYPE normal

# Reset
docker exec -it live-presence-redis redis-cli FLUSHALL
```

---

## Useful Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# PostgreSQL
alias pg-cli='docker exec -it live-presence-postgres psql -U postgres -d livepresence'
alias pg-backup='./scripts/backup-postgres.sh'
alias pg-restore='./scripts/restore-postgres.sh'

# Redis
alias redis-cli='docker exec -it live-presence-redis redis-cli'
alias redis-monitor='docker exec -it live-presence-redis redis-cli MONITOR'
alias redis-reset='docker exec -it live-presence-redis redis-cli FLUSHALL'

# Database
alias db-health='make db-health'
alias db-backup='make db-backup'
```

Then use:
```bash
pg-cli
redis-cli
db-health
```

---

## More Information

- **PostgreSQL Setup**: [POSTGRES_SETUP.md](./POSTGRES_SETUP.md)
- **Redis Setup**: [REDIS_SETUP.md](./REDIS_SETUP.md)
- **Database Guide**: [DATABASE.md](./DATABASE.md)
- **Local Development**: [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
