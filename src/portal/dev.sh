#!/bin/bash
set -e
. ../../scripts/utils.sh

helpFunction()
{
   echo ""
   echo "SYNOPSIS"
   echo "      dev.sh [<Options> ...]"
   echo ""
   echo "Usage: $0 -s <StackName> -p <AWS profile> -r <AWS region>"
   echo "\t-s: StackName, default value is ai-chatbot-on-aws"
   echo "\t-p: AWS Profile, default value is default"
   echo "\t-r: AWS Region, default value is us-east-1"
   exit 1 # Exit script after printing help
}

# Set the options of this bash script
while getopts "s:p:r:" opt
do
   case "$opt" in
      s ) stackName="$OPTARG" ;;
      p ) profile="$OPTARG" ;;
      r ) region="$OPTARG" ;;
      ? ) helpFunction ;;
   esac
done

# Set parameters values
PROFILE=
REGION=

if [ -z "$stackName" ]
then
  stackName=ai-chatbot-on-aws
fi
if [ -n "$profile" ]
then
  PROFILE="--profile $profile"
fi
if [ -n "$region" ]
then
  REGION="--region $region"
fi

echo "Stack Name: $stackName"
echo "AWS Profile: $PROFILE"
echo "AWS Region: $REGION"

# Get stack outputs
BucketName=$(get_stack_output $stackName "BucketName" $PROFILE $REGION)
echo "Bucket Name: $BucketName"
DomainName=localhost:3000
echo "Domain Name: $DomainName"
NextAuthUrl=http://$DomainName/api/auth
echo "NextAuth URL: $NextAuthUrl"
CloudFrontDomainName=$(get_stack_output $stackName "CloudFrontDomainName" $PROFILE $REGION)
echo "CloudFront Domain Name: $CloudFrontDomainName"
PostgresURL=$(get_stack_output $stackName "PostgresURL" $PROFILE $REGION)
echo "Postgres URL: $PostgresURL"
CognitoIssuer=$(get_stack_output $stackName "CognitoIssuer" $PROFILE $REGION)
echo "Cognito Issuer: $CognitoIssuer"
CognitoClientId=$(get_stack_output $stackName "CognitoClientId" $PROFILE $REGION)
echo "Cognito Client Id: $CognitoClientId"
CognitoClientSecret=$(get_stack_output $stackName "CognitoClientSecret" $PROFILE $REGION)
echo "Cognito Client Secret: $CognitoClientSecret"
RedisURL=$(get_stack_output $stackName "RedisURL" $PROFILE $REGION)
echo "Redis URL: $RedisURL"

# Update the manifest file
sed "s|_NEXTAUTH_URL_|$NextAuthUrl|g; \
s|_POSTGRES_URL_|$PostgresURL|g; \
s|_REDIS_URL_|$RedisURL|g; \
s|_AUTH_COGNITO_ID_|$CognitoClientId|g; \
s|_AUTH_COGNITO_SECRET_|$CognitoClientSecret|g; \
s|_AUTH_COGNITO_ISSUER_|$CognitoIssuer|g; \
s|_BUCKET_NAME_|$BucketName|g; \
s|_CLOUDFRONT_DISTRIBUTION_DOMAIN_NAME_|$CloudFrontDomainName|g" .env.example > .env.local

pnpm run dev

