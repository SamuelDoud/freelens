/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/** A chat's dock tab is identified by the chat. */
export const aiChatTabId = (chatId: string) => `ai-chat-${chatId}`;

export const chatIdOfTab = (tabId: string) =>
  tabId.startsWith("ai-chat-") ? tabId.slice("ai-chat-".length) : undefined;
