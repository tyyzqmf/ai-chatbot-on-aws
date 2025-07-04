import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const region =
  process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-west-2';
const bedrock = createAmazonBedrock({
  region: region,
  credentialProvider: fromNodeProviderChain(),
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': bedrock('us.amazon.nova-pro-v1:0'),
        'chat-model-reasoning': wrapLanguageModel({
          model: bedrock('us.anthropic.claude-3-7-sonnet-20250219-v1:0'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': bedrock('us.amazon.nova-pro-v1:0'),
        'artifact-model': bedrock('us.amazon.nova-pro-v1:0'),
      },
      imageModels: {
        'small-model': bedrock.image(
          'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
        ),
      },
    });
