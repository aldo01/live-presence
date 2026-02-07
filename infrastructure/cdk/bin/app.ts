#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { CacheStack } from '../lib/cache-stack';
import { EcsStack } from '../lib/ecs-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { WafStack } from '../lib/waf-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
};

// Stage configuration
const stage = app.node.tryGetContext('stage') || 'dev';

// Network infrastructure (VPC, Subnets, NAT Gateway, etc.)
const networkStack = new NetworkStack(app, `LivePresence-Network-${stage}`, {
  env,
  stage,
  description: 'Network infrastructure for Live Presence application',
});

// Database infrastructure (RDS Aurora PostgreSQL with Multi-AZ)
const databaseStack = new DatabaseStack(app, `LivePresence-Database-${stage}`, {
  env,
  stage,
  vpc: networkStack.vpc,
  description: 'Database infrastructure with RDS Aurora PostgreSQL',
});

// Cache infrastructure (ElastiCache Redis Cluster)
const cacheStack = new CacheStack(app, `LivePresence-Cache-${stage}`, {
  env,
  stage,
  vpc: networkStack.vpc,
  description: 'ElastiCache Redis cluster for presence and caching',
});

// ECS infrastructure (Fargate services for microservices)
const ecsStack = new EcsStack(app, `LivePresence-ECS-${stage}`, {
  env,
  stage,
  vpc: networkStack.vpc,
  database: databaseStack,
  cache: cacheStack,
  description: 'ECS Fargate microservices with Application Load Balancer',
});

// Monitoring infrastructure (CloudWatch, X-Ray, Alarms)
const monitoringStack = new MonitoringStack(app, `LivePresence-Monitoring-${stage}`, {
  env,
  stage,
  alb: ecsStack.alb,
  services: ecsStack.services,
  database: databaseStack.cluster,
  cache: cacheStack.redisCluster,
  description: 'Monitoring, logging, and alerting infrastructure',
});

// WAF infrastructure (Web Application Firewall)
const wafStack = new WafStack(app, `LivePresence-WAF-${stage}`, {
  env: { ...env, region: 'us-east-1' }, // WAF for ALB must be in us-east-1
  stage,
  albArn: ecsStack.alb.loadBalancerArn,
  description: 'Web Application Firewall with rate limiting and security rules',
});

// Add dependencies
databaseStack.addDependency(networkStack);
cacheStack.addDependency(networkStack);
ecsStack.addDependency(networkStack);
ecsStack.addDependency(databaseStack);
ecsStack.addDependency(cacheStack);
monitoringStack.addDependency(ecsStack);
monitoringStack.addDependency(databaseStack);
monitoringStack.addDependency(cacheStack);
wafStack.addDependency(ecsStack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'LivePresence');
cdk.Tags.of(app).add('Environment', stage);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();
