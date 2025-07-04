import { App } from 'aws-cdk-lib';
import { getConfig } from './configs/config';
import { AIChatbot } from './infrastructure';


const config = getConfig();

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new AIChatbot(app, 'ai-chatbot-on-aws', {
  env: devEnv,
  config,
});

app.synth();