import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface WafStackProps extends cdk.StackProps {
  stage: string;
  albArn: string;
}

export class WafStack extends cdk.Stack {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: WafStackProps) {
    super(scope, id, props);

    const { stage, albArn } = props;

    // WAF Web ACL
    this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: `live-presence-waf-${stage}`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      description: `WAF for Live Presence Application - ${stage}`,
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `live-presence-waf-${stage}`,
      },
      rules: [
        // Rate limiting - 2000 requests per 5 minutes per IP
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: stage === 'prod' ? 2000 : 5000,
              aggregateKeyType: 'IP',
            },
          },
          action: {
            block: {
              customResponse: {
                responseCode: 429,
                customResponseBodyKey: 'rate-limit-body',
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
        // AWS Managed Rules - Core Rule Set
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
              excludedRules: [],
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
          },
        },
        // AWS Managed Rules - Known Bad Inputs
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
              excludedRules: [],
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },
        // AWS Managed Rules - SQL Injection
        {
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: 4,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
              excludedRules: [],
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesSQLiRuleSet',
          },
        },
        // Block common attack patterns
        {
          name: 'BlockXSSAttacks',
          priority: 5,
          action: { block: {} },
          statement: {
            xssMatchStatement: {
              fieldToMatch: {
                body: {
                  oversizeHandling: 'CONTINUE',
                },
              },
              textTransformations: [
                {
                  priority: 0,
                  type: 'URL_DECODE',
                },
                {
                  priority: 1,
                  type: 'HTML_ENTITY_DECODE',
                },
              ],
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'BlockXSSAttacks',
          },
        },
        // Geographic restriction (if needed)
        // {
        //   name: 'GeoBlockRule',
        //   priority: 6,
        //   action: { block: {} },
        //   statement: {
        //     geoMatchStatement: {
        //       countryCodes: ['CN', 'RU', 'KP'], // Example: block specific countries
        //     },
        //   },
        //   visibilityConfig: {
        //     sampledRequestsEnabled: true,
        //     cloudWatchMetricsEnabled: true,
        //     metricName: 'GeoBlockRule',
        //   },
        // },
        // Protect auth endpoints with stricter rate limit
        {
          name: 'AuthEndpointRateLimit',
          priority: 7,
          statement: {
            rateBasedStatement: {
              limit: 100, // 100 requests per 5 minutes
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                byteMatchStatement: {
                  searchString: '/api/auth/',
                  fieldToMatch: {
                    uriPath: {},
                  },
                  textTransformations: [
                    {
                      priority: 0,
                      type: 'LOWERCASE',
                    },
                  ],
                  positionalConstraint: 'STARTS_WITH',
                },
              },
            },
          },
          action: {
            block: {
              customResponse: {
                responseCode: 429,
                customResponseBodyKey: 'rate-limit-body',
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AuthEndpointRateLimit',
          },
        },
      ],
      customResponseBodies: {
        'rate-limit-body': {
          contentType: 'APPLICATION_JSON',
          content: JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
          }),
        },
      },
    });

    // Associate WAF with ALB
    new wafv2.CfnWebACLAssociation(this, 'WebAclAssociation', {
      resourceArn: albArn,
      webAclArn: this.webAcl.attrArn,
    });

    // CloudWatch Log Group for WAF logs
    const logGroup = new cdk.aws_logs.LogGroup(this, 'WafLogGroup', {
      logGroupName: `/aws/waf/live-presence-${stage}`,
      retention: stage === 'prod' 
        ? cdk.aws_logs.RetentionDays.ONE_MONTH 
        : cdk.aws_logs.RetentionDays.ONE_WEEK,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // WAF Logging Configuration
    new wafv2.CfnLoggingConfiguration(this, 'WafLogging', {
      resourceArn: this.webAcl.attrArn,
      logDestinationConfigs: [logGroup.logGroupArn],
      loggingFilter: {
        defaultBehavior: 'DROP',
        filters: [
          {
            behavior: 'KEEP',
            conditions: [
              {
                actionCondition: {
                  action: 'BLOCK',
                },
              },
            ],
            requirement: 'MEETS_ANY',
          },
        ],
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAcl.attrArn,
      description: 'WAF Web ACL ARN',
      exportName: `${stage}-WebAclArn`,
    });

    new cdk.CfnOutput(this, 'WafLogGroupName', {
      value: logGroup.logGroupName,
      description: 'WAF Log Group Name',
    });
  }
}
