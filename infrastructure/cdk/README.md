# Live Presence - AWS CDK Infrastructure

## Overview
Production-ready infrastructure for Live Presence microservices application on AWS using ECS Fargate, RDS Aurora, ElastiCache Redis, with comprehensive security and monitoring.

## Architecture

### Services
- **API Gateway**: Spring Cloud Gateway for routing and load balancing
- **Auth Service**: JWT-based authentication and authorization
- **User Service**: User profile and settings management
- **Presence Service**: Real-time location tracking with Redis Geospatial
- **Chat Service**: WebSocket-based real-time messaging
- **Frontend**: React SPA served via Nginx

### Infrastructure Components
- **VPC**: Multi-AZ with public, private, and isolated subnets
- **ECS Fargate**: Serverless container orchestration
- **Application Load Balancer**: SSL termination and routing
- **RDS Aurora PostgreSQL Serverless v2**: Auto-scaling database
- **ElastiCache Redis 7**: Cluster mode with encryption
- **AWS WAF**: Web Application Firewall with rate limiting
- **CloudWatch**: Comprehensive monitoring and alerting
- **Secrets Manager**: Secure credential storage
- **Service Discovery**: AWS Cloud Map for inter-service communication

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **Node.js** 18+ and npm
4. **AWS CDK** CLI installed globally:
   ```bash
   npm install -g aws-cdk
   ```
5. **Docker** for building container images
6. **ACM Certificate** (optional, for HTTPS)

## Initial Setup

### 1. Bootstrap CDK
```bash
cd infrastructure/cdk
npm install

# Bootstrap CDK in your AWS account (one-time per region)
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### 2. Set Context Variables
Edit `cdk.json` or pass via command line:

```bash
# Required
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=us-east-1

# Optional
export CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/xxx
export ALERT_EMAIL=alerts@example.com
```

### 3. Configure Environment
```bash
# Development
cdk deploy --all --context stage=dev

# Production
cdk deploy --all --context stage=prod \
  --context certificateArn=$CERTIFICATE_ARN \
  --context alertEmail=$ALERT_EMAIL
```

## Deployment

### Deploy Infrastructure
```bash
# Synthesize CloudFormation templates
cdk synth

# View changes before deployment
cdk diff

# Deploy all stacks
cdk deploy --all --require-approval never

# Deploy specific stack
cdk deploy LivePresence-Network-dev
```

### Build and Push Docker Images

After infrastructure is deployed, build and push microservice images to ECR:

```bash
# Login to ECR
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com

# Build and push each service
cd services/gateway
docker build -t live-presence/gateway-dev:latest .
docker tag live-presence/gateway-dev:latest \
  $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/live-presence/gateway-dev:latest
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/live-presence/gateway-dev:latest

# Repeat for: auth, user, presence, chat, frontend
```

### Update ECS Services
```bash
# Force new deployment (pulls latest images)
aws ecs update-service \
  --cluster live-presence-dev \
  --service gateway-service \
  --force-new-deployment
```

## Security Features

### Network Security
- **VPC Flow Logs**: Monitor all network traffic
- **Security Groups**: Least-privilege access rules
- **Private Subnets**: Services not exposed to internet
- **NAT Gateway**: Controlled egress traffic
- **VPC Endpoints**: Private AWS service access

### Data Security
- **Encryption at Rest**: KMS encryption for RDS, Redis, Secrets
- **Encryption in Transit**: TLS 1.3 for all connections
- **Database Proxy**: Connection pooling with IAM authentication
- **Secrets Manager**: Automatic credential rotation
- **WAF**: Rate limiting, SQL injection, XSS protection

### Access Control
- **IAM Roles**: Task-specific permissions
- **JWT Authentication**: Short-lived access tokens
- **Redis AUTH**: Token-based Redis access
- **Database Credentials**: Rotated automatically

## Monitoring

### CloudWatch Dashboard
Access at: `https://console.aws.amazon.com/cloudwatch/home#dashboards`

Metrics tracked:
- **ALB**: Request count, response time, error rates
- **ECS Services**: CPU, memory, task count
- **Database**: CPU, connections, replication lag
- **Redis**: CPU, memory, network throughput

### Alarms
SNS notifications sent for:
- High error rates (5xx > 10/min)
- Slow responses (> 2s average)
- High resource utilization (CPU/Memory > 85%)
- Service unavailability (0 running tasks)
- Database connection saturation

### Logs
Centralized in CloudWatch Logs:
- `/aws/ecs/gateway` - API Gateway logs
- `/aws/ecs/auth` - Auth Service logs
- `/aws/ecs/user` - User Service logs
- `/aws/ecs/presence` - Presence Service logs
- `/aws/ecs/chat` - Chat Service logs
- `/aws/waf/live-presence-dev` - WAF blocked requests
- `/aws/vpc/live-presence-dev` - VPC Flow Logs

### X-Ray Tracing
Distributed tracing enabled for:
- Request flow across microservices
- Database query performance
- Redis operation latency
- External API calls

## Auto-Scaling

### ECS Services
- **Target CPU**: 70%
- **Target Memory**: 80%
- **Scale-in Cooldown**: 60s
- **Scale-out Cooldown**: 60s

Production service counts:
- **Gateway**: 2-10 tasks
- **Auth**: 2-6 tasks
- **User**: 2-6 tasks
- **Presence**: 2-8 tasks
- **Chat**: 2-8 tasks
- **Frontend**: 2-6 tasks

### Database
- **RDS Aurora Serverless v2**: Auto-scales 0.5-16 ACUs
- **Read Replicas**: 2x in production for read scaling

### Redis
- **ElastiCache**: Cluster mode with automatic failover
- **Multi-AZ**: Production deployments span 3 AZs

## Cost Optimization

### Development Environment
- Single NAT Gateway
- Minimal task counts (1 per service)
- Smaller instance types
- Shorter log retention (7 days)
- Reduced RDS capacity (0.5-2 ACUs)

### Production Environment
- Multi-AZ deployment
- Auto-scaling enabled
- Reserved capacity for baseline load
- Longer log retention (30 days)
- Higher RDS capacity (1-16 ACUs)

### Cost Monitoring
```bash
# Enable AWS Cost Explorer
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://cost-filter.json
```

## Disaster Recovery

### Backup Strategy
- **RDS**: Automated daily backups, 30-day retention (prod)
- **Redis**: Daily snapshots, 7-day retention (prod)
- **Database Snapshots**: Manual snapshots before major changes

### Recovery Procedures
```bash
# Restore database from snapshot
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier live-presence-restored \
  --snapshot-identifier live-presence-snapshot-2025-01-15

# Restore Redis from snapshot
aws elasticache create-replication-group \
  --replication-group-id live-presence-restored \
  --snapshot-name live-presence-snapshot-2025-01-15
```

### Cross-Region Replication
For critical production workloads:
1. Enable Aurora Global Database
2. Deploy standby infrastructure in secondary region
3. Configure Route 53 health checks and failover

## Troubleshooting

### Service Not Starting
```bash
# Check ECS task logs
aws logs tail /aws/ecs/gateway --follow

# Check task definition
aws ecs describe-task-definition --task-definition gateway-task

# Check service events
aws ecs describe-services \
  --cluster live-presence-dev \
  --services gateway-service
```

### High Error Rates
```bash
# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:...

# Check WAF blocked requests
aws logs filter-log-events \
  --log-group-name /aws/waf/live-presence-dev \
  --filter-pattern "BLOCK"
```

### Database Connection Issues
```bash
# Check security group rules
aws ec2 describe-security-groups \
  --group-ids sg-xxxxx

# Test connectivity from ECS task
aws ecs execute-command \
  --cluster live-presence-dev \
  --task task-id \
  --container gateway \
  --command "/bin/bash"
```

## Cleanup

```bash
# Delete all stacks (WARNING: Destroys all resources)
cdk destroy --all

# Or delete specific stack
cdk destroy LivePresence-ECS-dev
```

**Note**: RDS and Redis resources in production have deletion protection enabled.

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [RDS Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)
- [ElastiCache Redis](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/)

## Support

For issues or questions:
1. Check CloudWatch logs and metrics
2. Review AWS Health Dashboard
3. Contact DevOps team: devops@example.com
