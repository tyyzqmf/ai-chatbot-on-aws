import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

export const entitlements: Entitlements = {
  maxMessagesPerDay: 100,
  availableChatModelIds: ['chat-model', 'chat-model-reasoning'],
};
