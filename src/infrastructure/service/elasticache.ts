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

import { IVpc } from 'aws-cdk-lib/aws-ec2';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';
import { ASSETS_SHORT_NAME } from '../../configs/constants';
import { SystemConfig } from '../../configs/systemConfig';

export interface RedisProps {
  readonly vpc: IVpc;
  readonly config: SystemConfig;
}

export class Redis extends Construct {
  readonly redisCluster: elasticache.CfnReplicationGroup;

  constructor(scope: Construct, id: string, props: RedisProps) {
    super(scope, id);

    const ecSecurityGroup = new ec2.SecurityGroup(this, `${ASSETS_SHORT_NAME}RedisSG`, {
      vpc: props.vpc,
      description: 'SecurityGroup associated with Redis Cluster ' + ASSETS_SHORT_NAME,
      allowAllOutbound: true,
    });

    ecSecurityGroup.addIngressRule(
      ecSecurityGroup,
      ec2.Port.allTraffic(),
      'Allow all traffic inside SG',
    );

    ecSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow access to Redis from the VPC',
    );

    const subnetIds: string[] = [props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds[0]];

    const ecSubnetGroup = new elasticache.CfnSubnetGroup(this, `${ASSETS_SHORT_NAME}RedisSubnetGroup`, {
      description: 'Redis Subnet Group',
      subnetIds: subnetIds,
      cacheSubnetGroupName: `${ASSETS_SHORT_NAME}RedisSubnetGroup`,
    });

    this.redisCluster = new elasticache.CfnReplicationGroup(this, `${ASSETS_SHORT_NAME}Redis`, {
      cacheNodeType: 'cache.m5.large',
      engine: 'Redis',
      engineVersion: '7.0',
      cacheSubnetGroupName: ecSubnetGroup.cacheSubnetGroupName!,
      securityGroupIds: [ecSecurityGroup.securityGroupId],
      replicationGroupDescription: 'Redis cluster',
      replicasPerNodeGroup: 3,
      automaticFailoverEnabled: true,
      transitEncryptionEnabled: true, // Enable transit encryption
      transitEncryptionMode: 'preferred', // Allow both encrypted and unencrypted connections
      atRestEncryptionEnabled: true,
    });

    this.redisCluster.node.addDependency(ecSubnetGroup);
    this.redisCluster.node.addDependency(ecSecurityGroup);

  }

}