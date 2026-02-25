# Redis Setup Guide

## Overview

This project uses **Redis 7** for real-time data, caching, and location tracking.

### Why Redis?
- **Geospatial Queries**: Find nearby users within radius (O(N log N) performance)
- **Session Storage**: WebSocket session management
- **Caching**: Reduce database load for frequently accessed data
- **Pub/Sub**: Real-time message broadcasting for chat
- **TTL Support**: Automatic presence expiration (users offline after 30s inactivity)
- **Cluster Mode**: Horizontal scalability (production)

---

## Installation

### Option 1: Using Docker (Recommended for Development)

**Included in `docker-compose.local.yml`** - just run:
```bash
make start-local
# Or
docker-compose -f docker-compose.local.yml up -d redis
```

**Access**:
```bash
# Via redis-cli
docker exec -it live-presence-redis redis-cli

# Or connect remotely
redis-cli -h localhost -p 6379
```

**Verify**:
```bash
docker-compose -f docker-compose.local.yml ps redis
docker exec -it live-presence-redis redis-cli PING
# Expected: PONG
```

---

### Option 2: Manual Installation

#### macOS
```bash
# Using Homebrew
brew install redis

# Start Redis (background service)
brew services start redis

# Or run manually
redis-server

# Access
redis-cli
```

#### Ubuntu/Debian
```bash
# Update package list
sudo apt-get update

# Install Redis
sudo apt-get install redis-server

# Start service
sudo systemctl start redis-server
sudo systemctl enable redis-server  # Auto-start on boot

# Access
redis-cli
```

#### Windows

**Option A: Docker** (recommended):
```powershell
docker run -d `
  --name redis-local `
  -p 6379:6379 `
  redis:7-alpine

# Connect
docker exec -it redis-local redis-cli
```

**Option B: Windows Subsystem for Linux (WSL)**:
```bash
# Inside WSL
sudo apt-get install redis-server
redis-server
```

**Option C: Redis Windows Port**:
1. Download [Redis Windows Build](https://github.com/microsoftarchive/redis/releases)
2. Extract and run `redis-server.exe`
3. In another terminal: `redis-cli`

---

### Option 3: Docker Desktop

**Run Redis container**:
```bash
docker run -d \
  --name live-presence-redis \
  -p 6379:6379 \
  redis:7-alpine

# Verify
docker logs live-presence-redis

# Connect
docker exec -it live-presence-redis redis-cli
```

---

## Configuration

### Connection Parameters

**Local Development**:
```
Host:     localhost
Port:     6379
Database: 0 (default)
Password: (none for local dev)
```

**Connection String**:
```
redis://localhost:6379
```

**Production** (with AUTH):
```
redis://:password@redis-endpoint:6379
```

### Environment Variables

**Application Configuration** (set in `.env` or pass to Spring Boot):
```bash
SPRING_DATA_REDIS_HOST=localhost
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_PASSWORD=          # Empty for dev
SPRING_DATA_REDIS_TIMEOUT=2000ms     # Connection timeout
SPRING_DATA_REDIS_MAX_RETRIES=3
```

### Redis Configuration (Production)

**Maximum Memory Policy**:
```bash
# Local Redis config: /usr/local/etc/redis.conf (macOS)
maxmemory 256mb
maxmemory-policy allkeys-lru  # Evict least recently used keys when memory full
```

**Or via Docker**:
```bash
docker run -d \
  --name live-presence-redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### Verify Setup

```bash
# Connect to Redis
redis-cli

# Check connection
PING
# Expected: PONG

# Check info
INFO
# Shows version, memory, clients, etc.

# Check database size
DBSIZE

# Show keys
KEYS *

# Check specific key
GET presence:geo

# Quit
EXIT
```

---

## Common Commands

### redis-cli (Redis CLI)

```bash
# Connect to Redis
redis-cli

# Or remote
redis-cli -h 10.0.0.5 -p 6379 -a password
```

**Inside redis-cli**:
```redis
# Connection
PING                          # Test connection
SELECT 1                      # Switch database (0-15)
AUTH password                 # Authenticate

# Keys
KEYS *                        # List all keys (WARNING: slow on large datasets)
KEYS presence:*               # Pattern search
EXISTS presence:geo           # Check if key exists
TYPE presence:geo             # Get key type
TTL presence:meta:user123     # Get TTL (seconds)

# Geospatial
GEOADD presence:geo 13.361389 38.115556 "Palermo" 15.087269 37.502669 "Catania"
GEODIST presence:geo Palermo Catania km
GEOHASH presence:geo Palermo
GEOPOS presence:geo Palermo
GEORADIUS presence:geo 15 37 200 km

# Pub/Sub
SUBSCRIBE /topic/chat/*       # Subscribe to channel
PUBLISH /topic/chat/conv-123 "{"msg":"hello"}"

# Server
INFO                          # Server info
INFO memory                   # Memory stats
MEMORY USAGE presence:geo     # Key size
MONITOR                       # Real-time command monitor
DBSIZE                        # Database size
SAVE                          # Manual save to disk
BGSAVE                        # Background save
FLUSHDB                       # Delete all keys in DB
FLUSHALL                      # Delete all keys in all DBs
QUIT                          # Exit
```

### Docker Commands

```bash
# View Redis logs
docker logs live-presence-redis

# Interactive Redis CLI
docker exec -it live-presence-redis redis-cli

# Run single command
docker exec live-presence-redis redis-cli PING

# Stop Redis
docker stop live-presence-redis

# Start Redis
docker start live-presence-redis

# Remove container
docker rm live-presence-redis

# Backup (RDB file)
docker exec live-presence-redis redis-cli BGSAVE
docker cp live-presence-redis:/data/dump.rdb ./redis-backup.rdb

# Restore from backup
docker cp ./redis-backup.rdb live-presence-redis:/data/dump.rdb
docker restart live-presence-redis
```

---

## Use Cases in Live Presence

### 1. User Presence Tracking (Geospatial)

```redis
# User goes live with location
GEOADD presence:geo 10.5 20.3 user-uuid-1
HSET presence:meta:user-uuid-1 displayName "John" interest "Sports" lastSeen "2024-01-01T10:00:00Z"
EXPIRE presence:meta:user-uuid-1 30

# Find users within 10km radius
GEORADIUS presence:geo 10.5 20.3 10 km WITHDIST COUNT 50

# User goes offline
GEOREM presence:geo user-uuid-1
DEL presence:meta:user-uuid-1
```

**Spring Boot Example**:
```java
// Mark user as alive
redisTemplate.opsForGeo().add("presence:geo", new Point(lon, lat), userId);
redisTemplate.opsForHash().put("presence:meta:" + userId, "displayName", "John");
redisTemplate.expire("presence:meta:" + userId, Duration.ofSeconds(30));
```

### 2. Session Management

```redis
# Store session
SET session:token-xyz {"userId":"user-123","email":"john@example.com"} EX 900
# Expires in 15 minutes

# Check session
GET session:token-xyz
```

**Spring Boot Example**:
```java
// Store session
SessionData data = new SessionData(userId, email);
redisTemplate.opsForValue().set("session:" + token, data, Duration.ofMinutes(15));
```

### 3. Caching

```redis
# Cache user profile
SET user:profile:user-123 "{...}" EX 300
# Cache expires in 5 minutes

# Cache feed
SET feed:user-123 "[...]" EX 60
```

### 4. Pub/Sub Messaging

```redis
# Subscribe to chat messages
SUBSCRIBE /topic/chat/conversation-123

# In another client, publish message
PUBLISH /topic/chat/conversation-123 "{\"message\": \"Hello\"}"
```

**Spring Boot Example**:
```java
// Subscribe to topic
redisTemplate.listenToChannel("/topic/chat/conv-123", message -> {
    System.out.println("Received: " + message.getMessage());
});

// Publish to topic
redisTemplate.convertAndSend("/topic/chat/conv-123", message);
```

---

## Data Structures

### Presence Data Structure

```
Key: presence:geo
Type: Sorted Set (ZSET)
Content: User locations (longitude, latitude)
TTL: None (manually expired)

Example:
presence:geo → {user-1: (13.361, 38.115), user-2: (15.087, 37.502), ...}

Key: presence:meta:user-1
Type: Hash (HASH)
Fields: displayName, interest, lastSeen, lat, lon
TTL: 30 seconds (auto-expire)

Example:
presence:meta:user-1 → {displayName: "John", interest: "Sports", lastSeen: "2024-01-01..."}
```

### Session Data Structure

```
Key: session:token-abc123
Type: String (JSON)
TTL: 15 minutes
Content: {userId, email, roles}

Example:
session:token-abc123 → "{"userId":"uuid-123","email":"john@example.com"}"
```

### Cache Data Structure

```
Key: user:profile:uuid-123
Type: String (JSON)
TTL: 5 minutes
Content: Serialized user profile

Key: feed:uuid-123
Type: String (JSON)
TTL: 1 minute
Content: Array of posts
```

---

## Performance Optimization

### Monitor Real-Time Commands

```bash
# Watch all commands being executed
redis-cli MONITOR

# In another terminal, generate load
redis-cli GEOADD presence:geo 10 20 user1
redis-cli GET session:token
```

### Memory Analysis

```redis
# Check memory usage
INFO memory

# Analyze specific key
MEMORY USAGE presence:geo
MEMORY USAGE session:token-xyz

# Get memory stats
MEMORY STATS
```

### Key Eviction Strategy

```redis
# Set max memory and policy
CONFIG SET maxmemory 256mb
CONFIG SET maxmemory-policy allkeys-lru

# Check current settings
CONFIG GET maxmemory
CONFIG GET maxmemory-policy
```

### Persistence Options

```redis
# Save immediately (blocking)
SAVE

# Save asynchronously
BGSAVE

# Check save status
LASTSAVE

# Configure save schedule
CONFIG SET save "900 1 300 10"  # 900s with 1 change, or 300s with 10 changes
```

---

## Troubleshooting

### Connection Refused
```bash
# Check if Redis is running
redis-cli PING
# or
docker ps | grep redis

# Start Redis
brew services start redis   # macOS
# or
docker start live-presence-redis
```

### "WRONGTYPE Operation against a key holding the wrong kind of value"
```redis
# Reset the key (careful!)
DEL problematic-key

# Or check key type
TYPE problematic-key

# If it's a string, can't run GEO commands
# If it's a zset, can't run string commands
```

### "Out of Memory"
```redis
# Check memory usage
INFO memory

# Free memory
FLUSHDB           # Delete current database
FLUSHALL          # Delete all databases

# Or increase maxmemory
CONFIG SET maxmemory 512mb
CONFIG REWRITE    # Save config
```

### High Memory Usage

```redis
# Find largest keys
MEMORY DOCTOR

# Identify large keys
--bigkeys

# Delete unnecessary keys
DEL old-session-*
# or
FLUSHDB
```

### Key Expiration Not Working

```redis
# Check TTL
TTL presence:meta:user-123
# Returns:
# -1 = No expiration set
# -2 = Key doesn't exist
# > 0 = Seconds until expiration

# Set/reset expiration
EXPIRE presence:meta:user-123 30

# Or set with expiration
SETEX session:token 900 "{...}"    # 15 minute expiration
```

### Slow Queries

```redis
# Enable slow log
CONFIG SET slowlog-log-slower-than 10000  # Log queries > 10ms
CONFIG SET slowlog-max-len 128

# View slow queries
SLOWLOG GET

# Reset slow log
SLOWLOG RESET
```

---

## Production Setup

### Redis Cluster (Multiple Nodes)

**For High Availability**:
```bash
# Run 3 Redis nodes
for i in 7000 7001 7002; do
  redis-server --port $i --cluster-enabled yes
done

# Create cluster
redis-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002
```

### AWS ElastiCache Redis

**Configured in CDK** (automatic):
```typescript
// From infrastructure/cdk/lib/cache-stack.ts
const redisCluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
  replicationGroupId: `live-presence-redis-${stage}`,
  engine: 'redis',
  engineVersion: '7.1',
  cacheNodeType: stage === 'prod' ? 'cache.r7g.large' : 'cache.t4g.medium',
  numCacheClusters: 3,
  automaticFailoverEnabled: true,
  multiAzEnabled: true,
  atRestEncryptionEnabled: true,
  transitEncryptionEnabled: true,
  authToken: secretValue,  // AUTH token for security
});
```

**Connection**:
```
redis://:[AUTH-TOKEN]@cache-endpoint.ng.0001.use1.cache.amazonaws.com:6379
```

### Monitoring

```bash
# CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CPUUtilization \
  --dimensions Name=CacheClusterId,Value=live-presence-redis-dev \
  --statistics Average \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300
```

---

## Backup & Restore

### Backup

**Manual Snapshot** (Docker):
```bash
docker exec live-presence-redis redis-cli BGSAVE
docker cp live-presence-redis:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb
```

**AWS ElastiCache**:
```bash
# Automatic daily backups configured in CDK
# Manual backup
aws elasticache create-snapshot \
  --cache-cluster-id live-presence-redis-dev \
  --snapshot-name redis-backup-$(date +%Y%m%d)
```

### Restore

**From Local Backup**:
```bash
docker cp ./backups/redis-20240101.rdb live-presence-redis:/data/dump.rdb
docker restart live-presence-redis
```

**From AWS Backup**:
```bash
aws elasticache restore-from-cluster-snapshot \
  --snapshot-name redis-backup-20240101 \
  --replication-group-id live-presence-redis-restored
```

---

## More Resources

- [Redis Documentation](https://redis.io/docs/)
- [Redis Geospatial Commands](https://redis.io/docs/interact/search-and-query/geosearch/)
- [Redis Pub/Sub](https://redis.io/docs/interact/pubsub/)
- [Redis Data Types](https://redis.io/docs/data-index/)
- [AWS ElastiCache Redis](https://aws.amazon.com/elasticache/redis/)
- [Redis CLI Reference](https://redis.io/commands/)
