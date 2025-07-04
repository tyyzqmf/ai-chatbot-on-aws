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

import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { getShortIdOfStack } from './stack';

/**
 * Create or reference a CloudWatch log group
 *
 * @param scope The construct scope
 * @param props Log group properties
 * @param logGroupId Optional log group ID
 * @returns Log group instance
 */
export function createLogGroup(
  scope: Construct,
  props: {
    prefix?: string;
    retention?: RetentionDays;
    removalPolicy?: RemovalPolicy;
  },
) {
  const shortId = getShortIdOfStack(Stack.of(scope));
  const logGroupName = `${props.prefix ?? 'ai-chatbot-loggroup'}-${shortId}`;

  // Create a new log group and set RemovalPolicy.RETAIN to prevent deletion when the stack is deleted
  const logGroup = new LogGroup(scope, 'LogGroup', {
    logGroupName,
    retention: props.retention ?? RetentionDays.SIX_MONTHS,
    removalPolicy: props.removalPolicy ?? RemovalPolicy.RETAIN, // Retain the log group even if the stack is deleted
  });

  return logGroup;
}
