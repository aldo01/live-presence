# 🚀 Live Presence - Quick Reference

## Prerequisites

### 1. Java 21 (Required for Backend)
```bash
# Check if installed
java -version          # Must return "21.x"
javac -version         # Must return "21.x"

# If not installed, see: JAVA_SETUP.md
make install-java      # Automatic install via SDKMAN
```

### 2. AWS Setup (For Deployment)
```bash
# Configure AWS credentials
aws configure

# Verify access
aws sts get-caller-identity
```

### 3. Node.js 18+ (For CDK & Frontend)
```bash
# Verify
node --version         # Must be 18+
npm --version
```

---

## Essential Commands

### Local Development
```bash
# Start local stack (all services)
make start-local

# Stop services
make stop-local

# Run backend only
make run

# Build backend
make build

# Check health
curl http://localhost:8080/actuator/health
```

### AWS CDK Deployment
```bash
# Install dependencies
cd infrastructure/cdk && npm install

# Deploy all stacks (dev)
cdk deploy --all --context stage=dev

# Deploy specific stack
cdk deploy LivePresence-Network-dev

# Destroy all stacks
cdk destroy --all
```

### Docker Build & Push
```bash
# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

# Build service
cd services/gateway
docker build -t live-presence/gateway-dev:latest .

# Tag and push
docker tag live-presence/gateway-dev:latest \
  $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/live-presence/gateway-dev:latest
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/live-presence/gateway-dev:latest
```

### ECS Operations
```bash
# Update service (rolling update)
aws ecs update-service \
  --cluster live-presence-dev \
  --service gateway-service \
  --force-new-deployment

# Wait for stability
aws ecs wait services-stable \
  --cluster live-presence-dev \
  --services gateway-service

# View service logs
aws logs tail /aws/ecs/gateway --follow

# Execute command in container
aws ecs execute-command \
  --cluster live-presence-dev \
  --task TASK-ID \
  --container gateway \
  --command "/bin/bash" \
  --interactive
```

### Health Checks
```bash
# Get ALB DNS
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names live-presence-alb-dev \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# Test Gateway health
curl https://$ALB_DNS/actuator/health

# Test Auth endpoint
curl -X POST https://$ALB_DNS/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","displayName":"Test"}'
```

## Environment Variables

### Required for Development
```bash
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=us-east-1
export AWS_REGION=us-east-1

# Optional
export CERTIFICATE_ARN=arn:aws:acm:...
export ALERT_EMAIL=your-email@example.com
```

### Service Configuration
```bash
# Database
DB_HOST=aurora-endpoint
DB_PORT=5432
DB_NAME=livepresence
DB_USERNAME=presenceadmin
DB_PASSWORD=<from-secrets-manager>

# Redis
REDIS_HOST=redis-endpoint
REDIS_PORT=6379
REDIS_PASSWORD=<from-secrets-manager>

# JWT
JWT_SECRET=<from-secrets-manager>
```

## AWS Resource Names

### Development Environment
- **VPC**: `live-presence-vpc-dev`
- **ECS Cluster**: `live-presence-dev`
- **RDS Cluster**: `livePresence-database-dev`
- **Redis Cluster**: `live-presence-redis-dev`
- **ALB**: `live-presence-alb-dev`

### CloudWatch Log Groups
- `/aws/ecs/gateway` - API Gateway logs
- `/aws/ecs/auth` - Auth Service logs
- `/aws/ecs/user` - User Service logs
- `/aws/ecs/presence` - Presence Service logs
- `/aws/ecs/chat` - Chat Service logs
- `/aws/waf/live-presence-dev` - WAF logs
- `/aws/vpc/live-presence-dev` - VPC Flow Logs

## Service Ports

| Service | Port | Protocol |
|---------|------|----------|
| Gateway | 8080 | HTTP |
| Auth | 8080 | HTTP |
| User | 8080 | HTTP |
| Presence | 8080 | HTTP |
| Chat | 8080 | HTTP/WebSocket |
| Frontend | 80 | HTTP |

## API Endpoints

### Public (No Auth)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token

### Protected (Requires JWT)
- `GET /api/me` - Get current user profile
- `PUT /api/me/interest` - Update user interest
- `PUT /api/me/live` - Toggle live status
- `POST /api/presence/heartbeat` - Send GPS location
- `GET /api/presence/nearby` - Find nearby users
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/{id}/messages` - Get messages
- `WS /ws` - WebSocket connection

## Troubleshooting Quick Fixes

### Service Won't Start
```bash
# Check task logs
aws logs tail /aws/ecs/SERVICE-NAME --follow

# Check task stopped reason
aws ecs describe-tasks --cluster live-presence-dev --tasks TASK-ID

# Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

### Database Connection Failed
```bash
# Test from ECS task
aws ecs execute-command \
  --cluster live-presence-dev \
  --task TASK-ID \
  --container gateway \
  --command "nc -zv database-endpoint 5432" \
  --interactive
```

### High Error Rate
```bash
# Check target health
aws elbv2 describe-target-health --target-group-arn TARGET-GROUP-ARN

# View recent 5xx errors
aws logs filter-log-events \
  --log-group-name /aws/ecs/gateway \
  --filter-pattern "5xx" \
  --start-time $(($(date +%s) - 3600))000
```

## Cost Monitoring
```bash
# Get current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

## Security Best Practices

1. **Never commit secrets** to Git
2. **Use Secrets Manager** for all credentials
3. **Enable MFA** on AWS root account
4. **Rotate secrets** every 30 days
5. **Review CloudTrail logs** weekly
6. **Update security groups** minimally
7. **Enable GuardDuty** for threat detection
8. **Use least-privilege IAM** policies

## Support Contacts

- **Infrastructure Issues**: DevOps Team
- **Application Issues**: Development Team
- **Security Issues**: Security Team
- **AWS Support**: AWS Support Console

## Useful Links

- **CloudWatch Dashboard**: `https://console.aws.amazon.com/cloudwatch/home#dashboards:name=LivePresence-dev`
- **ECS Cluster**: `https://console.aws.amazon.com/ecs/home#/clusters/live-presence-dev`
- **RDS Cluster**: `https://console.aws.amazon.com/rds/home#databases:`
- **Secrets Manager**: `https://console.aws.amazon.com/secretsmanager/home#/listSecrets`

---

**For detailed documentation, see:**
- 📖 [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide
- 📖 [services/README.md](services/README.md) - Microservices architecture
- 📖 [infrastructure/cdk/README.md](infrastructure/cdk/README.md) - Infrastructure details
