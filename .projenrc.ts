import { awscdk } from 'projen';
import { NodePackageManager } from 'projen/lib/javascript';

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.162.1',
  defaultReleaseBranch: 'main',
  name: 'ai-chatbot',
  projenrcTs: true,
  minNodeVersion: '20.12.0',
  pnpmVersion: '10.2.1',
  packageManager: NodePackageManager.PNPM,
  deps: [
    'cdk-nag@^2.35.62',
    'commander@^12.1.0',
    '@commander-js/extra-typings@^12.1.0',
    'enquirer@^2.4.1',
    '@types/aws-lambda@^8.10.142',
    '@aws-solutions-constructs/aws-cloudfront-s3@^2.85.2',
    '@aws-solutions-constructs/aws-alb-fargate@^2.85.2',
  ], /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
    '@types/aws-lambda@^8.10.142',
  ], /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
  gitignore: [
    '.next/',
    '*.tar.gz',
    '**/*/config.json',
    '.idea',
    'cdk.context.json',
    '.DS_Store',
  ],
});
project.eslint?.addIgnorePattern('src/portal/');

project.setScript('build', 'pnpm dlx projen build && tsc -p tsconfig.cli.json');
project.setScript('deploy', 'npx cdk deploy --disable-rollback --require-approval never');
project.setScript('destroy', 'npx cdk destroy --all');
project.setScript('config', 'node ./dist/cli/magic.js config');

project.synth();