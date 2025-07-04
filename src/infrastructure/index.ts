/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Vpc, FlowLog, FlowLogDestination, FlowLogResourceType, FlowLogTrafficType } from 'aws-cdk-lib/aws-ec2';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { WellArchCognito } from './service/cognito';
import { SystemConfig } from '../configs/systemConfig';
import { Postgres } from './service/postgres';
import { ALBFargate } from './service/alb-fargate';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { Redis } from './service/elasticache';

interface AIChatbotProps extends StackProps {
  config: SystemConfig;
}
export class AIChatbot extends Stack {

  public readonly bucket: IBucket;
  public readonly cloudFrontDistribution: Distribution;
  public readonly cognito: WellArchCognito;

  constructor(scope: Construct, id: string, props: AIChatbotProps) {
    super(scope, id, props);

    const cloudFrontToS3 = new CloudFrontToS3(this, 'assets-cloudfront-s3', {});
    this.bucket = cloudFrontToS3.s3BucketInterface;
    this.cloudFrontDistribution = cloudFrontToS3.cloudFrontWebDistribution;

    // Create VPC
    const vpc = new Vpc(this, 'VPC', {
      vpcName: 'AI-Chatbot-VPC',
      natGateways: 1,
      maxAzs: 3,
    });

    // Add flow logs for VPC
    new FlowLog(this, 'VPCFlowLog', {
      resourceType: FlowLogResourceType.fromVpc(vpc),
      destination: FlowLogDestination.toCloudWatchLogs(),
      trafficType: FlowLogTrafficType.ALL,
    });

    // Create Postgres
    const postgres = new Postgres(this, 'Postgres', {
      vpc: vpc,
      config: props.config,
    });

    // Create Elasticache
    const redis = new Redis(this, 'Elasticache', {
      vpc: vpc,
      config: props.config,
    });
    const redisURL = `redis://${redis.redisCluster.attrPrimaryEndPointAddress}:${redis.redisCluster.attrPrimaryEndPointPort}`;

    const domainName = `https://${props.config.domainName}` || 'http://localhost:3000';

    // Create Cognito
    this.cognito = new WellArchCognito(this, 'Cognito', {
      email: props.config.email,
      callbackUrls: [
        `${domainName}/api/auth/callback/cognito`,
      ],
      logoutUrls: [domainName],
    });

    // Create ALB + Fargate
    const albFargate = new ALBFargate(this, 'ALBFargate', {
      vpc: vpc,
      config: props.config,
      domainName: domainName,
      postgresSecretName: postgres.postgresSecretName,
      postgresURL: postgres.postgresURL,
      postgresInstance: postgres.postgresInstance,
      redisURL: redisURL,
      cognitoIssuer: this.cognito.oidc.issuer,
      cognitoClientId: this.cognito.oidc.appClientId,
      cognitoClientSecret: this.cognito.oidc.appClientSecret,
      bucket: this.bucket,
      cloudFrontDomainName: this.cloudFrontDistribution.domainName,
    });

    new CfnOutput(this, 'BucketName', {
      description: 'BucketName',
      value: this.bucket.bucketName,
    }).overrideLogicalId('BucketName');

    new CfnOutput(this, 'CloudFrontDomainName', {
      description: 'CloudFront Domain Name',
      value: this.cloudFrontDistribution.distributionDomainName,
    }).overrideLogicalId('CloudFrontDomainName');

    new CfnOutput(this, 'PostgresSecretName', {
      description: 'Postgres Secret Name',
      value: postgres.postgresSecretName,
    }).overrideLogicalId('PostgresSecretName');

    new CfnOutput(this, 'RedisURL', {
      description: 'Redis URL',
      value: redisURL,
    }).overrideLogicalId('RedisURL');
    
    new CfnOutput(this, 'ALBEndpoint', {
      description: 'Application Load Balancer Endpoint',
      value: albFargate.albUrl,
    }).overrideLogicalId('ALBEndpoint');

    new CfnOutput(this, 'ALBDnsName', {
      description: 'ALB DNS Name',
      value: albFargate.albDnsName,
    }).overrideLogicalId('ALBDnsName');

    new CfnOutput(this, 'CognitoIssuer', {
      description: 'Cognito Issuer',
      value: this.cognito.oidc.issuer,
    }).overrideLogicalId('CognitoIssuer');

    new CfnOutput(this, 'CognitoClientId', {
      description: 'Cognito Client Id',
      value: this.cognito.oidc.appClientId,
    }).overrideLogicalId('CognitoClientId');

    new CfnOutput(this, 'CognitoClientSecret', {
      description: 'Cognito Client Secret',
      value: this.cognito.oidc.appClientSecret,
    }).overrideLogicalId('CognitoClientSecret');

  }
}
