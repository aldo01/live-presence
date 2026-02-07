# Live Presence - Microservices Architecture

## Overview
The Live Presence application has been refactored into a production-ready microservices architecture with the following services:

## Services

### 1. **API Gateway** (`services/gateway`)
- **Technology**: Spring Cloud Gateway
- **Purpose**: Central entry point for all client requests
- **Features**:
  - Request routing to appropriate microservices
  - JWT authentication validation
  - Rate limiting (Redis-based)
  - Circuit breaker pattern (Resilience4j)
  - Load balancing
  - CORS handling
  - Request/response logging
- **Port**: 8080

### 2. **Auth Service** (`services/auth`)
- **Technology**: Spring Boot 3 + PostgreSQL
- **Purpose**: Authentication and authorization
- **Features**:
  - User registration with email validation
  - Login with JWT token generation
  - Token refresh mechanism
  - Password encryption (BCrypt)
  - Secure secret storage (AWS Secrets Manager)
- **Database**: Dedicated schema in Aurora PostgreSQL
- **Port**: 8080

### 3. **User Service** (`services/user`)
- **Technology**: Spring Boot 3 + PostgreSQL
- **Purpose**: User profile and settings management
- **Features**:
  - Profile CRUD operations
  - User preferences
  - Interest management
  - Live/offline status toggle
  - Account settings
- **Database**: Dedicated schema in Aurora PostgreSQL
- **Port**: 8080

### 4. **Presence Service** (`services/presence`)
- **Technology**: Spring Boot 3 + Redis
- **Purpose**: Real-time location tracking and nearby user discovery
- **Features**:
  - GPS heartbeat processing (every 5s)
  - Redis Geospatial queries (GEOADD, GEOSEARCH)
  - TTL-based presence (30s auto-expire)
  - Nearby user discovery (radius-based)
  - Interest-based filtering
- **Database**: ElastiCache Redis (ephemeral)
- **Port**: 8080

### 5. **Chat Service** (`services/chat`)
- **Technology**: Spring Boot 3 + PostgreSQL + Redis + WebSocket
- **Purpose**: Real-time messaging and conversation management
- **Features**:
  - 1:1 conversations
  - WebSocket (STOMP) messaging
  - Message persistence
  - Conversation history
  - Real-time message delivery
  - Redis pub/sub for message broadcasting
- **Database**: PostgreSQL (messages), Redis (WebSocket session management)
- **Port**: 8080

### 6. **Frontend** (`services/frontend`)
- **Technology**: React 18 + TypeScript + Vite + Nginx
- **Purpose**: Web-based user interface
- **Features**:
  - Modern React architecture with hooks
  - TypeScript for type safety
  - Responsive design
  - Real-time WebSocket integration
  - GPS/Geolocation API integration
  - Service Worker for offline support
- **Port**: 80/443

## Architecture Diagram

```
Internet
   ↓
AWS WAF (Rate Limiting, SQL Injection, XSS Protection)
   ↓
Application Load Balancer (SSL Termination)
   ↓
┌─────────────────────────────────────────────────────────┐
│                    API Gateway (8080)                    │
│  - Authentication                                         │
│  - Rate Limiting                                          │
│  - Circuit Breaker                                        │
│  - Request Routing                                        │
└────────┬──────────────┬──────────┬────────────┬─────────┘
         │              │          │            │
    ┌────▼────┐  ┌─────▼─────┐ ┌──▼──────┐ ┌──▼────────┐
    │  Auth   │  │   User    │ │Presence │ │   Chat    │
    │ Service │  │  Service  │ │ Service │ │  Service  │
    └────┬────┘  └─────┬─────┘ └────┬────┘ └──┬────────┘
         │             │             │          │
    ┌────▼─────────────▼─────────────┴─────┐   │
    │      RDS Aurora PostgreSQL            │   │
    │      (Multi-AZ, Serverless v2)        │   │
    └───────────────────────────────────────┘   │
                                                 │
         ┌───────────────────────────────────────▼──┐
         │   ElastiCache Redis (Cluster Mode)       │
         │   - Geospatial data                      │
         │   - Session management                   │
         │   - Pub/Sub messaging                    │
         └──────────────────────────────────────────┘
```

## Communication Patterns

### Synchronous (HTTP/REST)
- **Client → Gateway → Services**: REST APIs
- **Service Discovery**: AWS Cloud Map (DNS-based)
- **Load Balancing**: Spring Cloud LoadBalancer

### Asynchronous (WebSocket)
- **Client ↔ Gateway ↔ Chat Service**: STOMP over WebSocket
- **Chat Service → Redis**: Pub/Sub for message broadcasting

### Event-Driven (Future Enhancement)
- **Potential**: Amazon EventBridge for event-driven architecture
- **Use Cases**: 
  - User status changes
  - New message notifications
  - Presence updates

## Data Management

### Database Schema Isolation
Each service has its own database schema:
- **Auth Schema**: `users` table (authentication data only)
- **User Schema**: `user_profiles`, `user_settings`
- **Chat Schema**: `conversations`, `messages`

### Shared Database Considerations
While each service has isolated schemas, they share the same Aurora cluster:
- **Pros**: Simplified management, transaction support
- **Cons**: Not fully polyglot persistence
- **Future**: Consider separate databases per service for true microservices

### Data Consistency
- **Strong Consistency**: Within service boundaries (single database)
- **Eventual Consistency**: Cross-service data (event-driven updates)
- **No Distributed Transactions**: Each service manages its own data

## Security Architecture

### Authentication Flow
```
1. Client → POST /api/auth/login
2. Auth Service validates credentials
3. Auth Service generates JWT (access + refresh tokens)
4. Client stores tokens (localStorage/cookies)
5. Client → GET /api/presence/nearby (with Bearer token)
6. Gateway validates JWT
7. Gateway forwards request with X-User-Id header
8. Presence Service processes request
9. Presence Service returns response
10. Gateway forwards response to client
```

### Security Layers
1. **WAF**: SQL injection, XSS, rate limiting
2. **ALB**: SSL/TLS termination, DDoS protection
3. **Gateway**: JWT validation, rate limiting
4. **Services**: Authorization checks using X-User-Id header
5. **Database**: Encryption at rest (KMS), encrypted connections
6. **Redis**: AUTH token, encryption in transit

### Secrets Management
- **AWS Secrets Manager**: Database credentials, Redis AUTH tokens, JWT secrets
- **IAM Roles**: Task-specific permissions (least privilege)
- **Automatic Rotation**: Database passwords rotated every 30 days

## Monitoring & Observability

### Metrics (CloudWatch)
- **Service-level**: CPU, memory, request count, error rate
- **Business-level**: Active users, messages sent, presence updates
- **Infrastructure**: ALB metrics, database connections, Redis memory

### Logging (CloudWatch Logs)
- **Structured Logging**: JSON format for easy parsing
- **Correlation IDs**: Trace requests across services
- **Log Levels**: INFO (prod), DEBUG (dev)

### Distributed Tracing (X-Ray)
- **End-to-end Tracing**: Client → Gateway → Service → Database
- **Performance Analysis**: Identify bottlenecks
- **Error Tracking**: Pinpoint failure points

### Health Checks
- **Kubernetes-style**: `/actuator/health`
- **Deep Health**: Database connectivity, Redis connectivity
- **Circuit Breaker**: Automatic service degradation

## Scalability

### Horizontal Scaling
- **ECS Auto-scaling**: Based on CPU/Memory utilization
- **Target Metrics**:
  - CPU: 70% utilization
  - Memory: 80% utilization
  - Request count: 1000 req/min per task

### Service Scaling Strategy
- **Gateway**: 2-10 tasks (high availability)
- **Auth**: 2-6 tasks (bursty traffic)
- **User**: 2-6 tasks (moderate traffic)
- **Presence**: 2-8 tasks (high traffic, frequent heartbeats)
- **Chat**: 2-8 tasks (WebSocket connections, stateful)

### Database Scaling
- **Aurora Serverless v2**: Auto-scales 0.5-16 ACUs
- **Read Replicas**: 2x for read-heavy workloads
- **Connection Pooling**: RDS Proxy (max 90% connections)

### Redis Scaling
- **Cluster Mode**: Horizontal partitioning
- **Read Replicas**: 2x for read-heavy workloads
- **Memory**: Auto-eviction (allkeys-lru policy)

## Deployment

### Build & Push
```bash
# Build all services
./scripts/build-all.sh

# Push to ECR
./scripts/push-to-ecr.sh dev
./scripts/push-to-ecr.sh prod
```

### Deploy Infrastructure
```bash
cd infrastructure/cdk
npm install
cdk deploy --all --context stage=dev
```

### Update Services
```bash
# Rolling update (zero downtime)
aws ecs update-service \
  --cluster live-presence-dev \
  --service auth-service \
  --force-new-deployment
```

## Local Development

### Prerequisites
- Java 21
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 16
- Redis 7

### Start Local Stack
```bash
# Start infrastructure
docker-compose -f docker-compose.local.yml up -d

# Start services (each in separate terminal)
cd services/gateway && ./gradlew bootRun
cd services/auth && ./gradlew bootRun
cd services/user && ./gradlew bootRun
cd services/presence && ./gradlew bootRun
cd services/chat && ./gradlew bootRun

# Start frontend
cd services/frontend && npm run dev
```

### Environment Variables
```bash
# Database
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=livepresence
export DB_USERNAME=postgres
export DB_PASSWORD=postgres

# Redis
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=

# JWT
export JWT_SECRET=your-super-secret-key-at-least-64-characters-long-for-production
```

## Testing

### Unit Tests
```bash
# Test individual service
cd services/auth && ./gradlew test

# Test all services
./scripts/test-all.sh
```

### Integration Tests
```bash
# Start testcontainers
cd services/auth && ./gradlew integrationTest
```

### End-to-End Tests
```bash
cd e2e-tests
npm install
npm run test
```

## Troubleshooting

### Service Not Starting
```bash
# Check logs
docker logs services_auth_1

# Check health
curl http://localhost:8080/actuator/health
```

### Database Connection Issues
```bash
# Test connectivity
psql -h localhost -U postgres -d livepresence

# Check service logs
tail -f services/auth/logs/application.log
```

### Redis Connection Issues
```bash
# Test connectivity
redis-cli -h localhost -p 6379 PING

# Check AUTH token
redis-cli -h localhost -p 6379 -a your-password PING
```

## Migration Guide

### From Monolith to Microservices
1. **Phase 1**: Deploy infrastructure (CDK)
2. **Phase 2**: Deploy Gateway + Auth service
3. **Phase 3**: Deploy User, Presence, Chat services
4. **Phase 4**: Update frontend to use Gateway
5. **Phase 5**: Decommission monolith

### Database Migration
```bash
# Export data from monolith
pg_dump -h old-db -U postgres livepresence > backup.sql

# Import to new Aurora cluster
psql -h new-aurora-endpoint -U presenceadmin livepresence < backup.sql
```

## Performance Optimization

### Caching Strategy
- **Gateway**: Route cache (Redis)
- **User Service**: Profile cache (Redis, 5min TTL)
- **Presence Service**: Location cache (Redis, 30s TTL)
- **Chat Service**: Message cache (Redis, paginated history)

### Database Optimization
- **Indexes**: Composite indexes on frequently queried columns
- **Partitioning**: Messages table partitioned by conversation_id
- **Connection Pooling**: HikariCP (max 20 connections per service)
- **Query Optimization**: Use EXPLAIN ANALYZE for slow queries

### API Optimization
- **Pagination**: Limit 50 items per request
- **Field Selection**: GraphQL-style field filtering (future)
- **Compression**: Gzip responses > 1KB
- **CDN**: CloudFront for static assets (frontend)

## Cost Optimization

### Development Environment
- **ECS Fargate**: 1 task per service (FARGATE_SPOT)
- **RDS Aurora**: Serverless v2 (0.5-2 ACUs)
- **Redis**: Single-node, t4g.medium
- **NAT Gateway**: Single NAT (cost saving)

### Production Environment
- **ECS Fargate**: Auto-scaling (2-10 tasks)
- **RDS Aurora**: Serverless v2 (1-16 ACUs), 2 read replicas
- **Redis**: Cluster mode, r7g.large, 3 nodes
- **NAT Gateway**: Multi-AZ (high availability)

### Monthly Cost Estimate (US East 1)
- **Development**: ~$300-500/month
- **Production**: ~$1500-3000/month (varies with traffic)

## Future Enhancements

### Planned Features
- [ ] GraphQL API (in addition to REST)
- [ ] gRPC for inter-service communication
- [ ] Kafka for event streaming
- [ ] Elasticsearch for full-text search
- [ ] S3 for user-uploaded content (avatars, images)
- [ ] SQS for async task processing
- [ ] Lambda for serverless functions (image processing)
- [ ] CloudFront CDN integration
- [ ] Multi-region deployment
- [ ] Blue/Green deployment strategy

### Scalability Roadmap
- [ ] Separate databases per service (polyglot persistence)
- [ ] Event-driven architecture (EventBridge)
- [ ] CQRS pattern for read/write separation
- [ ] Service mesh (App Mesh) for advanced traffic management
- [ ] Kubernetes migration (EKS) for more control

## Support & Documentation

- **Architecture Docs**: `docs/architecture/`
- **API Docs**: `docs/api/` (OpenAPI/Swagger)
- **Runbooks**: `docs/runbooks/`
- **DevOps**: devops@livepresence.com
- **Slack**: #live-presence-platform
