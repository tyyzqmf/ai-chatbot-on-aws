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

import * as cdk from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { PostgresEngineVersion } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { SystemConfig } from '../../configs/systemConfig';
import { ASSETS_SHORT_NAME } from '../../configs/constants';

export interface PostgresProps {
  readonly vpc: IVpc;
  readonly config: SystemConfig;
}

export class Postgres extends Construct {
  readonly postgresInstance: rds.DatabaseInstance;
  readonly postgresURL: string;
  readonly postgresSecretName: string;

  constructor(scope: Construct, id: string, props: PostgresProps) {
    super(scope, id);

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(
      dbSecurityGroup,
      ec2.Port.allTraffic(),
      'Allow all traffic inside SG',
    );

    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow access to the DB from the VPC',
    );
    
    // Generate a secret with username and password for the database
    const databaseCredentials = new secretsmanager.Secret(this, 'DBCredentialsSecret', {
      description: 'RDS PostgreSQL database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'postgres',
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
      },
    });
    
    // Create the RDS instance with the credentials from Secrets Manager
    this.postgresInstance = new rds.DatabaseInstance(this, 'DBInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_17_4,
      }),
      vpc: props.vpc,
      securityGroups: [dbSecurityGroup],
      allocatedStorage: 1024,
      databaseName: ASSETS_SHORT_NAME,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      credentials: rds.Credentials.fromSecret(databaseCredentials),
    });

    // Store the secret name for reference
    this.postgresSecretName = databaseCredentials.secretName;
    
    // Construct the database URL for use in applications
    // This will be resolved at deployment time
    this.postgresURL = `postgres://${databaseCredentials.secretValueFromJson('username').unsafeUnwrap()}:${databaseCredentials.secretValueFromJson('password').unsafeUnwrap()}@${this.postgresInstance.dbInstanceEndpointAddress}:${this.postgresInstance.dbInstanceEndpointPort}/${ASSETS_SHORT_NAME}`;
  }

}