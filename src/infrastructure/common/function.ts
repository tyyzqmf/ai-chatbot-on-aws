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

import { RemovalPolicy } from 'aws-cdk-lib';
import { ApplicationLogLevel, Architecture, LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { BundlingOptions, NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, LogGroupClass, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface SolutionNodejsFunctionProps extends Omit<NodejsFunctionProps, 'logRetention'> {
  logConf?: {
    retention?: RetentionDays;
    removalPolicy?: RemovalPolicy;
    logGroupClass?: LogGroupClass;
  };
}

export class SolutionNodejsFunction extends NodejsFunction {

  constructor(scope: Construct, id: string, props?: SolutionNodejsFunctionProps) {
    super(scope, id, {
      ...props,
      bundling: _buildBundlingConfig(props?.bundling),
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      environment: {
        ...(props?.environment ?? {}),
      },
      logGroup: props?.logGroup ?? getLogGroup(scope, id, props?.logConf),
      loggingFormat: LoggingFormat.JSON,
      applicationLogLevelV2: props?.applicationLogLevelV2 ?? ApplicationLogLevel.INFO,
    });
  }
}

function _buildBundlingConfig(bundling?: BundlingOptions) {
  const esbuildOptions = {
    environment: {
      NODE_ENV: 'production',
    },
    esbuildArgs: { // Pass additional arguments to esbuild
      '--log-limit': '3000',
    },
  };
  return bundling ? {
    ...bundling,
    externalModules: bundling.externalModules?.filter(p => p === '@aws-sdk/*') ?? [],
    ...esbuildOptions,
  } : {
    externalModules: [],
    ...esbuildOptions,
  };
}

function getLogGroup(scope: Construct, id: string, logConf?: {
  retention?: RetentionDays;
  removalPolicy?: RemovalPolicy;
  logGroupClass?: LogGroupClass;
}) {
  const logGroup = new LogGroup(scope, `${id}-log`, {
    removalPolicy: logConf?.removalPolicy ?? RemovalPolicy.DESTROY,
    retention: logConf?.retention ?? RetentionDays.ONE_MONTH,
    logGroupClass: logConf?.logGroupClass ?? LogGroupClass.STANDARD,
  });
  return logGroup;
}