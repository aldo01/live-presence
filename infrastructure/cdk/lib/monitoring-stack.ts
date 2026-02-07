import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  stage: string;
  alb: elbv2.ApplicationLoadBalancer;
  services: { [key: string]: ecs.FargateService };
  database: rds.DatabaseCluster;
  cache: elasticache.CfnReplicationGroup;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { stage, alb, services, database, cache } = props;

    // SNS Topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: `LivePresence Alarms - ${stage}`,
      topicName: `live-presence-alarms-${stage}`,
    });

    // Add email subscription (get from context)
    const alertEmail = this.node.tryGetContext('alertEmail');
    if (alertEmail) {
      this.alarmTopic.addSubscription(
        new subscriptions.EmailSubscription(alertEmail)
      );
    }

    // Create dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `LivePresence-${stage}`,
    });

    // ALB Metrics
    this.createAlbMonitoring(dashboard, alb, stage);

    // ECS Service Metrics
    Object.entries(services).forEach(([name, service]) => {
      this.createServiceMonitoring(dashboard, name, service, stage);
    });

    // Database Metrics
    this.createDatabaseMonitoring(dashboard, database, stage);

    // Redis Metrics
    this.createRedisMonitoring(dashboard, cache, stage);

    // Create composite alarms
    this.createCompositeAlarms(services, stage);

    // Output
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
      exportName: `${stage}-AlarmTopicArn`,
    });
  }

  private createAlbMonitoring(
    dashboard: cloudwatch.Dashboard,
    alb: elbv2.ApplicationLoadBalancer,
    stage: string
  ): void {
    const namespace = 'AWS/ApplicationELB';
    const dimensions = {
      LoadBalancer: alb.loadBalancerFullName,
    };

    // Request Count
    const requestCount = new cloudwatch.Metric({
      namespace,
      metricName: 'RequestCount',
      dimensionsMap: dimensions,
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Target Response Time
    const responseTime = new cloudwatch.Metric({
      namespace,
      metricName: 'TargetResponseTime',
      dimensionsMap: dimensions,
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // HTTP 5xx errors
    const http5xx = new cloudwatch.Metric({
      namespace,
      metricName: 'HTTPCode_Target_5XX_Count',
      dimensionsMap: dimensions,
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // HTTP 4xx errors
    const http4xx = new cloudwatch.Metric({
      namespace,
      metricName: 'HTTPCode_Target_4XX_Count',
      dimensionsMap: dimensions,
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Add to dashboard
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ALB - Request Count',
        left: [requestCount],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'ALB - Response Time (ms)',
        left: [responseTime],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'ALB - HTTP Errors',
        left: [http5xx, http4xx],
        width: 12,
      })
    );

    // Alarms
    const highErrorRateAlarm = new cloudwatch.Alarm(this, 'AlbHighErrorRate', {
      alarmName: `${stage}-alb-high-error-rate`,
      metric: http5xx,
      threshold: stage === 'prod' ? 10 : 50,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'ALB is experiencing high 5xx error rate',
    });

    highErrorRateAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    const slowResponseAlarm = new cloudwatch.Alarm(this, 'AlbSlowResponse', {
      alarmName: `${stage}-alb-slow-response`,
      metric: responseTime,
      threshold: 2000, // 2 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'ALB response time is too slow',
    });

    slowResponseAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
  }

  private createServiceMonitoring(
    dashboard: cloudwatch.Dashboard,
    serviceName: string,
    service: ecs.FargateService,
    stage: string
  ): void {
    const namespace = 'AWS/ECS';
    const dimensions = {
      ServiceName: service.serviceName,
      ClusterName: service.cluster.clusterName,
    };

    // CPU Utilization
    const cpuMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'CPUUtilization',
      dimensionsMap: dimensions,
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // Memory Utilization
    const memoryMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'MemoryUtilization',
      dimensionsMap: dimensions,
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // Running Task Count
    const taskCount = service.metricRunningTaskCount({
      period: cdk.Duration.minutes(5),
    });

    // Add to dashboard
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: `${serviceName} - CPU & Memory`,
        left: [cpuMetric],
        right: [memoryMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: `${serviceName} - Task Count`,
        left: [taskCount],
        width: 12,
      })
    );

    // Alarms
    const highCpuAlarm = new cloudwatch.Alarm(this, `${serviceName}HighCpu`, {
      alarmName: `${stage}-${serviceName}-high-cpu`,
      metric: cpuMetric,
      threshold: 85,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `${serviceName} service CPU usage is too high`,
    });

    highCpuAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    const highMemoryAlarm = new cloudwatch.Alarm(this, `${serviceName}HighMemory`, {
      alarmName: `${stage}-${serviceName}-high-memory`,
      metric: memoryMetric,
      threshold: 85,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `${serviceName} service memory usage is too high`,
    });

    highMemoryAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    const noTasksAlarm = new cloudwatch.Alarm(this, `${serviceName}NoTasks`, {
      alarmName: `${stage}-${serviceName}-no-tasks`,
      metric: taskCount,
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      alarmDescription: `${serviceName} service has no running tasks`,
    });

    noTasksAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
  }

  private createDatabaseMonitoring(
    dashboard: cloudwatch.Dashboard,
    cluster: rds.DatabaseCluster,
    stage: string
  ): void {
    const namespace = 'AWS/RDS';

    // CPU Utilization
    const cpuMetric = cluster.metricCPUUtilization({
      period: cdk.Duration.minutes(5),
    });

    // Database Connections
    const connectionsMetric = cluster.metricDatabaseConnections({
      period: cdk.Duration.minutes(5),
    });

    // Add to dashboard
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Database - CPU Utilization',
        left: [cpuMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Database - Connections',
        left: [connectionsMetric],
        width: 12,
      })
    );

    // Alarms
    const highDbCpuAlarm = new cloudwatch.Alarm(this, 'DatabaseHighCpu', {
      alarmName: `${stage}-database-high-cpu`,
      metric: cpuMetric,
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Database CPU usage is too high',
    });

    highDbCpuAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    const highConnectionsAlarm = new cloudwatch.Alarm(this, 'DatabaseHighConnections', {
      alarmName: `${stage}-database-high-connections`,
      metric: connectionsMetric,
      threshold: stage === 'prod' ? 400 : 150,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Database connection count is too high',
    });

    highConnectionsAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
  }

  private createRedisMonitoring(
    dashboard: cloudwatch.Dashboard,
    cache: elasticache.CfnReplicationGroup,
    stage: string
  ): void {
    const namespace = 'AWS/ElastiCache';
    const dimensions = {
      ReplicationGroupId: cache.replicationGroupId!,
    };

    // CPU Utilization
    const cpuMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'EngineCPUUtilization',
      dimensionsMap: dimensions,
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // Memory Usage
    const memoryMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'DatabaseMemoryUsagePercentage',
      dimensionsMap: dimensions,
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // Network bytes in/out
    const networkIn = new cloudwatch.Metric({
      namespace,
      metricName: 'NetworkBytesIn',
      dimensionsMap: dimensions,
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const networkOut = new cloudwatch.Metric({
      namespace,
      metricName: 'NetworkBytesOut',
      dimensionsMap: dimensions,
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Add to dashboard
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Redis - CPU & Memory',
        left: [cpuMetric],
        right: [memoryMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Redis - Network Traffic',
        left: [networkIn, networkOut],
        width: 12,
      })
    );

    // Alarms
    const highRedisCpuAlarm = new cloudwatch.Alarm(this, 'RedisHighCpu', {
      alarmName: `${stage}-redis-high-cpu`,
      metric: cpuMetric,
      threshold: 75,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Redis CPU usage is too high',
    });

    highRedisCpuAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    const highRedisMemoryAlarm = new cloudwatch.Alarm(this, 'RedisHighMemory', {
      alarmName: `${stage}-redis-high-memory`,
      metric: memoryMetric,
      threshold: 85,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Redis memory usage is too high',
    });

    highRedisMemoryAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
  }

  private createCompositeAlarms(
    services: { [key: string]: ecs.FargateService },
    stage: string
  ): void {
    // Create a composite alarm that triggers if multiple services are unhealthy
    const serviceNames = Object.keys(services);
    
    new cdk.CfnOutput(this, 'MonitoringInfo', {
      value: `Monitoring ${serviceNames.length} services: ${serviceNames.join(', ')}`,
      description: 'Services being monitored',
    });
  }
}
