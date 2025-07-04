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

import path from 'path';
import { AlbToFargate } from '@aws-solutions-constructs/aws-alb-fargate';
import { Duration, RemovalPolicy, Aws } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { ContainerImage, LogDrivers } from 'aws-cdk-lib/aws-ecs';
import {
  ApplicationProtocol,
  ApplicationLoadBalancer,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { SystemConfig } from '../../configs/systemConfig';
import { createLogGroup } from '../common/logs';

export interface ALBFargateProps {
  readonly vpc: IVpc;
  readonly config: SystemConfig;
  readonly domainName: string;
  readonly postgresSecretName: string;
  readonly postgresURL: string;
  readonly postgresInstance: rds.DatabaseInstance;
  readonly redisURL: string;
  readonly cognitoIssuer: string;
  readonly cognitoClientId: string;
  readonly cognitoClientSecret: string;
  readonly bucket: IBucket;
  readonly cloudFrontDomainName: string;
}

export class ALBFargate extends Construct {
  public readonly albFargateConstruct: AlbToFargate;
  public readonly loadBalancer: ApplicationLoadBalancer;
  public readonly dockerImageAsset: DockerImageAsset;
  public readonly protocol: ApplicationProtocol;

  constructor(scope: Construct, id: string, props: ALBFargateProps) {
    super(scope, id);

    const port = 8080;
    const healthCheckPath = '/ping';

    this.dockerImageAsset = new DockerImageAsset(this, 'PortalImage', {
      directory: path.join(__dirname, '../../portal'),
      file: 'Dockerfile',
      platform: Platform.LINUX_AMD64,
      buildArgs: {
        NODE_ENV: 'production',
      },
      exclude: ['node_modules', '.next', '*.md', '.git', '.gitignore'],
    });

    const certificate = props.config.certificateArn
      ? Certificate.fromCertificateArn(
        this,
        'Certificate',
        props.config.certificateArn,
      )
      : undefined;
    this.protocol = certificate
      ? ApplicationProtocol.HTTPS
      : ApplicationProtocol.HTTP;

    const logGroup = createLogGroup(this, {
      prefix: 'ai-chatbot-fargate',
      removalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
    });

    this.albFargateConstruct = new AlbToFargate(this, 'AlbFargate', {
      listenerProps: {
        certificates: certificate ? [certificate] : undefined,
        port: certificate ? 443 : 80,
        protocol: this.protocol,
      },
      targetGroupProps: {
        port: port,
        protocol: ApplicationProtocol.HTTP,
        healthCheck: {
          path: healthCheckPath,
        },
      },
      fargateTaskDefinitionProps: {
        memoryLimitMiB: 2048,
        cpu: 1024,
        taskRole: this.createTaskRole(props.bucket, props.postgresSecretName),
      },
      containerDefinitionProps: {
        image: ContainerImage.fromDockerImageAsset(this.dockerImageAsset),
        environment: {
          NODE_ENV: 'production',
          PORT: port.toString(),
          NEXTAUTH_URL: `${props.domainName}/api/auth`,
          POSTGRES_SECRET_NAME: props.postgresSecretName,
          DB_HOST: props.postgresInstance.dbInstanceEndpointAddress,
          DB_PORT: props.postgresInstance.dbInstanceEndpointPort,
          DB_NAME: 'aichatbot',
          // Keep POSTGRES_URL for backward compatibility
          POSTGRES_URL: props.postgresURL,
          AUTH_COGNITO_ID: props.cognitoClientId,
          AUTH_COGNITO_SECRET: props.cognitoClientSecret,
          AUTH_COGNITO_ISSUER: props.cognitoIssuer,
          AWS_REGION: Aws.REGION,
          BEDROCK_REGION: 'us-west-2',
          BUCKET_NAME: props.bucket.bucketName,
          CLOUDFRONT_DISTRIBUTION_DOMAIN_NAME: props.cloudFrontDomainName,
          AUTH_SECRET: '56fL+bw93i+Mkn8x/M2lhUOboQmcFSqTGCBYY2Gwv/M=',
        },
        logging: LogDrivers.awsLogs({
          streamPrefix: 'portal',
          logGroup: logGroup,
        }),
      },
      fargateServiceProps: {
        desiredCount: 2,
        healthCheckGracePeriod: Duration.seconds(60),
      },
      publicApi: true,
      existingVpc: props.vpc,
    });

    this.loadBalancer = this.albFargateConstruct.loadBalancer;
  }

  public get albDnsName(): string {
    return this.loadBalancer.loadBalancerDnsName;
  }

  public get albUrl(): string {
    const protocol =
      this.protocol === ApplicationProtocol.HTTPS ? 'https' : 'http';
    return `${protocol}://${this.albDnsName}`;
  }

  private createTaskRole(bucket: IBucket, postgresSecretName: string): Role {
    const taskRole = new Role(this, 'TaskRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'IAM role for ECS tasks to access AWS services',
    });

    const apiPolicyStatements: PolicyStatement[] = [
      new PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
        resources: [`${bucket.bucketArn}/*`, bucket.bucketArn],
      }),
      new PolicyStatement({
        actions: [
          'bedrock:InvokeAgent',
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: ['*'],
      }),
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [`arn:aws:secretsmanager:${Aws.REGION}:${Aws.ACCOUNT_ID}:secret:${postgresSecretName}`],
      }),
    ];
    apiPolicyStatements.forEach((ps) => taskRole.addToPolicy(ps));

    taskRole.addToPolicy(
      new PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [taskRole.roleArn],
      }),
    );

    return taskRole;
  }
}
