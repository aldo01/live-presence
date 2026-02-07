import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  stage: string;
  vpc: ec2.Vpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly secret: secretsmanager.Secret;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { stage, vpc } = props;

    // KMS key for database encryption
    const kmsKey = new kms.Key(this, 'DatabaseEncryptionKey', {
      enableKeyRotation: true,
      description: `Encryption key for Live Presence database - ${stage}`,
      alias: `live-presence-db-${stage}`,
    });

    // Database credentials secret
    this.secret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `live-presence/db/${stage}`,
      description: `Database credentials for Live Presence - ${stage}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'presenceadmin',
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 32,
      },
      encryptionKey: kmsKey,
    });

    // Security group for database
    this.securityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'Security group for RDS Aurora cluster',
      allowAllOutbound: false,
    });

    // Parameter group for PostgreSQL optimization
    const parameterGroup = new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_5,
      }),
      description: `Custom parameter group for Live Presence - ${stage}`,
      parameters: {
        'shared_preload_libraries': 'pg_stat_statements,auto_explain',
        'log_statement': 'ddl',
        'log_min_duration_statement': '1000', // Log slow queries > 1s
        'auto_explain.log_min_duration': '1000',
        'auto_explain.log_analyze': '1',
        'max_connections': stage === 'prod' ? '500' : '200',
      },
    });

    // RDS Aurora PostgreSQL Cluster (Serverless v2 for cost optimization)
    this.cluster = new rds.DatabaseCluster(this, 'DatabaseCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_5,
      }),
      credentials: rds.Credentials.fromSecret(this.secret),
      writer: rds.ClusterInstance.serverlessV2('Writer', {
        scaleWithWriter: true,
      }),
      readers: stage === 'prod' 
        ? [
            rds.ClusterInstance.serverlessV2('Reader1', { scaleWithWriter: true }),
            rds.ClusterInstance.serverlessV2('Reader2', { scaleWithWriter: true }),
          ]
        : [],
      serverlessV2MinCapacity: stage === 'prod' ? 1 : 0.5,
      serverlessV2MaxCapacity: stage === 'prod' ? 16 : 2,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.securityGroup],
      defaultDatabaseName: 'livepresence',
      parameterGroup,
      storageEncrypted: true,
      storageEncryptionKey: kmsKey,
      backup: {
        retention: stage === 'prod' ? cdk.Duration.days(30) : cdk.Duration.days(7),
        preferredWindow: '03:00-04:00',
      },
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: stage === 'prod' 
        ? cdk.aws_logs.RetentionDays.ONE_MONTH 
        : cdk.aws_logs.RetentionDays.ONE_WEEK,
      monitoringInterval: cdk.Duration.seconds(60),
      enableDataApi: true, // Enable Data API for serverless access
      deletionProtection: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.SNAPSHOT : cdk.RemovalPolicy.DESTROY,
    });

    // Database proxy for connection pooling (important for serverless)
    const proxy = this.cluster.addProxy('DatabaseProxy', {
      secrets: [this.secret],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.securityGroup],
      debugLogging: stage !== 'prod',
      requireTLS: true,
      maxConnectionsPercent: 90,
      maxIdleConnectionsPercent: 50,
    });

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseClusterEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
      description: 'Database cluster endpoint',
      exportName: `${stage}-DatabaseEndpoint`,
    });

    new cdk.CfnOutput(this, 'DatabaseProxyEndpoint', {
      value: proxy.endpoint,
      description: 'Database proxy endpoint',
      exportName: `${stage}-DatabaseProxyEndpoint`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.secret.secretArn,
      description: 'Database credentials secret ARN',
      exportName: `${stage}-DatabaseSecretArn`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecurityGroupId', {
      value: this.securityGroup.securityGroupId,
      description: 'Database security group ID',
      exportName: `${stage}-DatabaseSecurityGroupId`,
    });
  }
}
