import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { DatabaseStack } from './database-stack';
import { CacheStack } from './cache-stack';

export interface EcsStackProps extends cdk.StackProps {
  stage: string;
  vpc: ec2.Vpc;
  database: DatabaseStack;
  cache: CacheStack;
}

export class EcsStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly services: { [key: string]: ecs.FargateService };

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    const { stage, vpc, database, cache } = props;

    this.services = {};

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'EcsCluster', {
      clusterName: `live-presence-${stage}`,
      vpc,
      containerInsights: true,
      enableFargateCapacityProviders: true,
    });

    // Service Discovery Namespace (for inter-service communication)
    const namespace = new servicediscovery.PrivateDnsNamespace(this, 'ServiceDiscovery', {
      name: `live-presence.local`,
      vpc,
      description: 'Service discovery namespace for Live Presence microservices',
    });

    // Application Load Balancer
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS from internet'
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from internet (redirect to HTTPS)'
    );

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      http2Enabled: true,
      deletionProtection: stage === 'prod',
    });

    // Enable access logs
    const albLogsBucket = new cdk.aws_s3.Bucket(this, 'AlbLogsBucket', {
      bucketName: `live-presence-alb-logs-${stage}-${this.account}`,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(stage === 'prod' ? 90 : 7),
        },
      ],
    });

    this.alb.logAccessLogs(albLogsBucket);

    // HTTPS Listener (requires ACM certificate - add certificate ARN from context)
    const certificateArn = this.node.tryGetContext('certificateArn');
    
    const httpsListener = this.alb.addListener('HttpsListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: certificateArn ? [{ certificateArn }] : undefined,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'application/json',
        messageBody: JSON.stringify({ error: 'Not Found' }),
      }),
      sslPolicy: elbv2.SslPolicy.TLS13_RES,
    });

    // HTTP Listener (redirect to HTTPS)
    this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    // Allow database and cache access from services
    database.securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from ECS services'
    );

    cache.securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis from ECS services'
    );

    // ECR Repositories
    const repositories = this.createEcrRepositories(stage);

    // API Gateway Service (Spring Cloud Gateway)
    this.services['gateway'] = this.createGatewayService(
      vpc,
      namespace,
      httpsListener,
      repositories['gateway'],
      stage
    );

    // Auth Service
    this.services['auth'] = this.createAuthService(
      vpc,
      namespace,
      database,
      repositories['auth'],
      stage
    );

    // User Service
    this.services['user'] = this.createUserService(
      vpc,
      namespace,
      database,
      repositories['user'],
      stage
    );

    // Presence Service
    this.services['presence'] = this.createPresenceService(
      vpc,
      namespace,
      cache,
      repositories['presence'],
      stage
    );

    // Chat Service
    this.services['chat'] = this.createChatService(
      vpc,
      namespace,
      database,
      cache,
      repositories['chat'],
      stage
    );

    // Frontend Service (React + Nginx)
    this.services['frontend'] = this.createFrontendService(
      vpc,
      httpsListener,
      repositories['frontend'],
      stage
    );

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: this.alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS name',
      exportName: `${stage}-AlbDnsName`,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster name',
      exportName: `${stage}-EcsCluster`,
    });
  }

  private createEcrRepositories(stage: string): { [key: string]: ecr.Repository } {
    const services = ['gateway', 'auth', 'user', 'presence', 'chat', 'frontend'];
    const repositories: { [key: string]: ecr.Repository } = {};

    services.forEach(service => {
      repositories[service] = new ecr.Repository(this, `${service}Repo`, {
        repositoryName: `live-presence/${service}-${stage}`,
        imageScanOnPush: true,
        imageTagMutability: ecr.TagMutability.IMMUTABLE,
        lifecycleRules: [
          {
            description: 'Keep last 10 images',
            maxImageCount: 10,
          },
        ],
        removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });
    });

    return repositories;
  }

  private createTaskRole(serviceName: string, stage: string): iam.Role {
    const role = new iam.Role(this, `${serviceName}TaskRole`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: `Task role for ${serviceName} service`,
    });

    // Allow access to Secrets Manager
    role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:live-presence/*`],
    }));

    // Allow X-Ray tracing
    role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
      ],
      resources: ['*'],
    }));

    return role;
  }

  private createGatewayService(
    vpc: ec2.Vpc,
    namespace: servicediscovery.PrivateDnsNamespace,
    listener: elbv2.ApplicationListener,
    repository: ecr.Repository,
    stage: string
  ): ecs.FargateService {
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'GatewayTaskDef', {
      memoryLimitMiB: stage === 'prod' ? 2048 : 1024,
      cpu: stage === 'prod' ? 1024 : 512,
      taskRole: this.createTaskRole('Gateway', stage),
    });

    const container = taskDefinition.addContainer('gateway', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'gateway',
        logRetention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        SPRING_PROFILES_ACTIVE: stage,
        SERVER_PORT: '8080',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8080/actuator/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    const service = new ecs.FargateService(this, 'GatewayService', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: stage === 'prod' ? 3 : 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      cloudMapOptions: {
        name: 'gateway',
        cloudMapNamespace: namespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
      },
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
    });

    // Auto-scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: stage === 'prod' ? 2 : 1,
      maxCapacity: stage === 'prod' ? 10 : 3,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Target group for ALB
    const targetGroup = listener.addTargets('GatewayTarget', {
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: '/actuator/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
      stickinessCookieDuration: cdk.Duration.hours(1),
      priority: 10,
    });

    listener.addAction('GatewayAction', {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api/*', '/ws/*']),
      ],
      action: elbv2.ListenerAction.forward([targetGroup]),
    });

    return service;
  }

  private createAuthService(
    vpc: ec2.Vpc,
    namespace: servicediscovery.PrivateDnsNamespace,
    database: DatabaseStack,
    repository: ecr.Repository,
    stage: string
  ): ecs.FargateService {
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'AuthTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      taskRole: this.createTaskRole('Auth', stage),
    });

    const container = taskDefinition.addContainer('auth', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'auth',
        logRetention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        SPRING_PROFILES_ACTIVE: stage,
        SERVER_PORT: '8080',
      },
      secrets: {
        DB_SECRET: ecs.Secret.fromSecretsManager(database.secret),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8080/actuator/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    const service = new ecs.FargateService(this, 'AuthService', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: stage === 'prod' ? 2 : 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      cloudMapOptions: {
        name: 'auth',
        cloudMapNamespace: namespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
      },
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
    });

    // Auto-scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: stage === 'prod' ? 2 : 1,
      maxCapacity: stage === 'prod' ? 6 : 3,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    return service;
  }

  private createUserService(
    vpc: ec2.Vpc,
    namespace: servicediscovery.PrivateDnsNamespace,
    database: DatabaseStack,
    repository: ecr.Repository,
    stage: string
  ): ecs.FargateService {
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'UserTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      taskRole: this.createTaskRole('User', stage),
    });

    const container = taskDefinition.addContainer('user', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'user',
        logRetention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        SPRING_PROFILES_ACTIVE: stage,
        SERVER_PORT: '8080',
      },
      secrets: {
        DB_SECRET: ecs.Secret.fromSecretsManager(database.secret),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8080/actuator/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    const service = new ecs.FargateService(this, 'UserService', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: stage === 'prod' ? 2 : 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      cloudMapOptions: {
        name: 'user',
        cloudMapNamespace: namespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
      },
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
    });

    const scaling = service.autoScaleTaskCount({
      minCapacity: stage === 'prod' ? 2 : 1,
      maxCapacity: stage === 'prod' ? 6 : 3,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    return service;
  }

  private createPresenceService(
    vpc: ec2.Vpc,
    namespace: servicediscovery.PrivateDnsNamespace,
    cache: CacheStack,
    repository: ecr.Repository,
    stage: string
  ): ecs.FargateService {
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'PresenceTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      taskRole: this.createTaskRole('Presence', stage),
    });

    const container = taskDefinition.addContainer('presence', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'presence',
        logRetention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        SPRING_PROFILES_ACTIVE: stage,
        SERVER_PORT: '8080',
      },
      secrets: {
        REDIS_SECRET: ecs.Secret.fromSecretsManager(cache.authTokenSecret),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8080/actuator/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    const service = new ecs.FargateService(this, 'PresenceService', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: stage === 'prod' ? 2 : 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      cloudMapOptions: {
        name: 'presence',
        cloudMapNamespace: namespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
      },
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
    });

    const scaling = service.autoScaleTaskCount({
      minCapacity: stage === 'prod' ? 2 : 1,
      maxCapacity: stage === 'prod' ? 8 : 3,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    return service;
  }

  private createChatService(
    vpc: ec2.Vpc,
    namespace: servicediscovery.PrivateDnsNamespace,
    database: DatabaseStack,
    cache: CacheStack,
    repository: ecr.Repository,
    stage: string
  ): ecs.FargateService {
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ChatTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      taskRole: this.createTaskRole('Chat', stage),
    });

    const container = taskDefinition.addContainer('chat', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'chat',
        logRetention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        SPRING_PROFILES_ACTIVE: stage,
        SERVER_PORT: '8080',
      },
      secrets: {
        DB_SECRET: ecs.Secret.fromSecretsManager(database.secret),
        REDIS_SECRET: ecs.Secret.fromSecretsManager(cache.authTokenSecret),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8080/actuator/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    const service = new ecs.FargateService(this, 'ChatService', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: stage === 'prod' ? 2 : 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      cloudMapOptions: {
        name: 'chat',
        cloudMapNamespace: namespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
      },
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
    });

    const scaling = service.autoScaleTaskCount({
      minCapacity: stage === 'prod' ? 2 : 1,
      maxCapacity: stage === 'prod' ? 8 : 3,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    return service;
  }

  private createFrontendService(
    vpc: ec2.Vpc,
    listener: elbv2.ApplicationListener,
    repository: ecr.Repository,
    stage: string
  ): ecs.FargateService {
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'FrontendTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    const container = taskDefinition.addContainer('frontend', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'frontend',
        logRetention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:80/ || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(30),
      },
    });

    container.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP,
    });

    const service = new ecs.FargateService(this, 'FrontendService', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: stage === 'prod' ? 2 : 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
    });

    const scaling = service.autoScaleTaskCount({
      minCapacity: stage === 'prod' ? 2 : 1,
      maxCapacity: stage === 'prod' ? 6 : 3,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    // Target group for ALB
    listener.addTargets('FrontendTarget', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
      priority: 100, // Lower priority (checked last)
    });

    return service;
  }
}
