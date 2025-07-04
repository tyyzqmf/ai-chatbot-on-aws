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

import { Duration, Fn, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  UserPool,
  AdvancedSecurityMode,
  UserPoolClient,
  OAuthScope,
  CfnUserPoolUser,
  CfnUserPoolGroup,
  CfnUserPoolUserToGroupAttachment,
} from 'aws-cdk-lib/aws-cognito';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { getShortIdOfStack } from '../common/stack';

export interface WellArchCognitoProps {
  email: string;
  callbackUrls?: string[];
  logoutUrls?: string[];
}

export interface OIDCProps {
  issuer: string;
  tokenEndpoint: string;
  userEndpoint: string;
  authorizationEndpoint: string;
  appClientId: string;
  appClientSecret: string;
  oidcLogoutUrl: string;
}

export class WellArchCognito extends Construct {

  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;
  public readonly oidc: OIDCProps;

  constructor(scope: Construct, id: string, props: WellArchCognitoProps) {
    super(scope, id);

    const region = Stack.of(this).region;
    const stackId = getShortIdOfStack(Stack.of(this));

    this.userPool = new UserPool(scope, 'UserPool', {
      selfSignUpEnabled: false,
      signInCaseSensitive: false,
      removalPolicy: RemovalPolicy.DESTROY,
      signInAliases: {
        email: true,
      },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
    });

    NagSuppressions.addResourceSuppressions(this.userPool, [
      {
        id: 'AwsSolutions-COG2',
        reason: 'This user pool intentionally does not enable MFA because it is a development/testing environment or has other security measures in place.',
      },
    ]);

    // Create User Pool Client
    this.userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(24), // Set to 1 day
      idTokenValidity: Duration.hours(24), // Set to 1 day
      generateSecret: true,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: props.callbackUrls,
        logoutUrls: props.logoutUrls,
      },
    });

    // Create Admin Group
    const adminGroup = new CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Admin',
      description: 'Administrator group with full access',
    });

    // Create admin user
    const adminUser = new CfnUserPoolUser(scope, 'admin-user', {
      userPoolId: this.userPool.userPoolId,
      userAttributes: [
        {
          name: 'email',
          value: props.email,
        },
        {
          name: 'email_verified',
          value: 'true',
        },
      ],
      username: props.email,
    });

    // Add user to Admin group
    const groupAttachment = new CfnUserPoolUserToGroupAttachment(this, 'AdminGroupAttachment', {
      userPoolId: this.userPool.userPoolId,
      groupName: adminGroup.groupName!,
      username: adminUser.username!,
    });
    // Ensure group is created before adding user
    groupAttachment.addDependency(adminGroup);

    const userPoolId = this.userPool.userPoolId;
    const domainPrefix = Fn.join('', [stackId]);
    const domain = this.userPool.addDomain('cognito-domain', {
      cognitoDomain: {
        domainPrefix,
      },
    });
    this.oidc = {
      issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      tokenEndpoint: `https://${domain.domainName}.auth.${region}.amazoncognito.com/oauth2/token`,
      userEndpoint: `https://${domain.domainName}.auth.${region}.amazoncognito.com/oauth2/userInfo`,
      authorizationEndpoint: `https://${domain.domainName}.auth.${region}.amazoncognito.com/oauth2/authorize`,
      appClientId: this.userPoolClient.userPoolClientId,
      appClientSecret: this.userPoolClient.userPoolClientSecret.toString(),
      oidcLogoutUrl: `https://${domain.domainName}.auth.${region}.amazoncognito.com/logout`,
    };

  };
}
