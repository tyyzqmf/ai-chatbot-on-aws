import path from 'path';
import { Duration } from 'aws-cdk-lib';
import { IVpc, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { Role, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { DockerImageCode, DockerImageFunction, Function } from 'aws-cdk-lib/aws-lambda';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { createLambdaRole } from '../common/lambda';
import { AUTH_SECRET } from '../../configs/constants';
import { OIDCProps } from '../service/cognito';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';

export interface PortalProps {
  vpc: IVpc;
  domainName: string;
  oidc: OIDCProps;
  bucket: IBucket;
  cloudFrontDistribution: Distribution;
  postgresURL: string;
  redisURL: string;
}

export class Portal extends Construct {
  public readonly portalFunction: Function;

  constructor(scope: Construct, id: string, props: PortalProps) {
    super(scope, id);

    // Create portal function
    this.portalFunction = this.createFunction(props);

    // Add suppressions for Portal function role
    NagSuppressions.addResourceSuppressions(this.portalFunction.role!, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Portal function needs broad permissions to interact with various AWS services including DynamoDB tables and S3 buckets that are created dynamically',
      },
    ], true);
  }

  private createFunctionRole(bucket: IBucket): Role {
    const apiFunctionPolicyStatements: PolicyStatement[] = [
      new PolicyStatement({
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:ListBucket',
        ],
        resources: [`${bucket.bucketArn}/*`, bucket.bucketArn],  
      }),
      new PolicyStatement({
        actions: [
          'bedrock:*',
        ],
        resources: ['*'],
      }),
    ];

    const role = createLambdaRole(this, 'ServerFunctionRole', true, apiFunctionPolicyStatements);
    role.addToPolicy(new PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [role.roleArn],
    }));

    return role;
  }

  private createFunction(
    props: PortalProps,
  ): Function {
    // Create a role for portal function
    const portalFunctionRole = this.createFunctionRole(props.bucket);

    const sg = new SecurityGroup(this, 'SecurityGroup', {
        vpc: props.vpc,
        allowAllOutbound: true,
      });
    
    const fn = new DockerImageFunction(this, 'ServerFunction', {
      code: DockerImageCode.fromImageAsset(path.join(__dirname, '../../portal/'), {
        file: './Dockerfile',
        platform: Platform.LINUX_AMD64,
      }),
      role: portalFunctionRole,
      memorySize: 2048,
      securityGroups: [sg],
      vpc: props.vpc,
      vpcSubnets: props.vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }),
      timeout: Duration.seconds(900),
      environment: {
        AUTH_SECRET: AUTH_SECRET,
        NEXTAUTH_URL: `${props.domainName}/api/auth`,
        POSTGRES_URL: props.postgresURL,
        REDIS_URL: props.redisURL,
        AUTH_COGNITO_ID: props.oidc.appClientId,
        AUTH_COGNITO_SECRET: props.oidc.appClientSecret,
        AUTH_COGNITO_ISSUER: props.oidc.issuer,
        BEDROCK_REGION: 'us-west-2',
        BUCKET_NAME: props.bucket.bucketName,
        CLOUDFRONT_DISTRIBUTION_DOMAIN_NAME: props.cloudFrontDistribution.domainName,
      },
    });

    return fn;
  }
}
