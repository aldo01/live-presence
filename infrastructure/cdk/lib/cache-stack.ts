import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface CacheStackProps extends cdk.StackProps {
  stage: string;
  vpc: ec2.Vpc;
}

export class CacheStack extends cdk.Stack {
  public readonly redisCluster: elasticache.CfnReplicationGroup;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly authTokenSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    const { stage, vpc } = props;

    // KMS key for Redis encryption
    const kmsKey = new kms.Key(this, 'RedisEncryptionKey', {
      enableKeyRotation: true,
      description: `Encryption key for Live Presence Redis - ${stage}`,
      alias: `live-presence-redis-${stage}`,
    });

    // Generate Redis AUTH token
    this.authTokenSecret = new secretsmanager.Secret(this, 'RedisAuthToken', {
      secretName: `live-presence/redis/${stage}`,
      description: `Redis AUTH token for Live Presence - ${stage}`,
      generateSecretString: {
        excludePunctuation: true,
        excludeUppercase: false,
        includeSpace: false,
        passwordLength: 32,
      },
      encryptionKey: kmsKey,
    });

    // Security group for Redis
    this.securityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      description: 'Security group for ElastiCache Redis cluster',
      allowAllOutbound: false,
    });

    // Subnet group for Redis
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: `Subnet group for Live Presence Redis - ${stage}`,
      subnetIds: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds,
      cacheSubnetGroupName: `live-presence-redis-${stage}`,
    });

    // Parameter group for Redis 7.x with optimizations
    const parameterGroup = new elasticache.CfnParameterGroup(this, 'RedisParameterGroup', {
      cacheParameterGroupFamily: 'redis7',
      description: `Custom parameter group for Live Presence - ${stage}`,
      properties: {
        'maxmemory-policy': 'allkeys-lru', // Evict least recently used keys
        'timeout': '300', // Close idle connections after 5 min
        'tcp-keepalive': '300',
        'notify-keyspace-events': 'Ex', // Enable expiry notifications
      },
    });

    // ElastiCache Redis Cluster
    this.redisCluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      replicationGroupId: `live-presence-redis-${stage}`,
      replicationGroupDescription: `Redis cluster for Live Presence - ${stage}`,
      engine: 'redis',
      engineVersion: '7.1',
      cacheNodeType: stage === 'prod' ? 'cache.r7g.large' : 'cache.t4g.medium',
      numCacheClusters: stage === 'prod' ? 3 : 2, // Multi-AZ with read replicas in prod
      automaticFailoverEnabled: true,
      multiAzEnabled: stage === 'prod',
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      securityGroupIds: [this.securityGroup.securityGroupId],
      cacheParameterGroupName: parameterGroup.ref,
      
      // Security features
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      transitEncryptionMode: 'required',
      authToken: this.authTokenSecret.secretValue.unsafeUnwrap(), // Use AUTH token
      kmsKeyId: kmsKey.keyArn,
      
      // Backups
      snapshotRetentionLimit: stage === 'prod' ? 7 : 1,
      snapshotWindow: '03:00-05:00',
      preferredMaintenanceWindow: 'sun:05:00-sun:07:00',
      
      // Monitoring
      autoMinorVersionUpgrade: true,
      logDeliveryConfigurations: [
        {
          destinationType: 'cloudwatch-logs',
          destinationDetails: {
            cloudWatchLogsDetails: {
              logGroup: `/aws/elasticache/live-presence-${stage}`,
            },
          },
          logFormat: 'json',
          logType: 'slow-log',
        },
        {
          destinationType: 'cloudwatch-logs',
          destinationDetails: {
            cloudWatchLogsDetails: {
              logGroup: `/aws/elasticache/live-presence-${stage}`,
            },
          },
          logFormat: 'json',
          logType: 'engine-log',
        },
      ],
    });

    this.redisCluster.addDependency(subnetGroup);
    this.redisCluster.addDependency(parameterGroup);

    // Outputs
    new cdk.CfnOutput(this, 'RedisPrimaryEndpoint', {
      value: this.redisCluster.attrPrimaryEndPointAddress,
      description: 'Redis primary endpoint address',
      exportName: `${stage}-RedisPrimaryEndpoint`,
    });

    new cdk.CfnOutput(this, 'RedisReaderEndpoint', {
      value: this.redisCluster.attrReaderEndPointAddress,
      description: 'Redis reader endpoint address',
      exportName: `${stage}-RedisReaderEndpoint`,
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: this.redisCluster.attrPrimaryEndPointPort,
      description: 'Redis port',
      exportName: `${stage}-RedisPort`,
    });

    new cdk.CfnOutput(this, 'RedisAuthTokenSecretArn', {
      value: this.authTokenSecret.secretArn,
      description: 'Redis AUTH token secret ARN',
      exportName: `${stage}-RedisAuthTokenSecretArn`,
    });

    new cdk.CfnOutput(this, 'RedisSecurityGroupId', {
      value: this.securityGroup.securityGroupId,
      description: 'Redis security group ID',
      exportName: `${stage}-RedisSecurityGroupId`,
    });
  }
}
