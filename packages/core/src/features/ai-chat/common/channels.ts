/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannel, getRequestChannel } from "@freelensapp/messaging";

import type { AiChatSettings, AiChatSnapshot } from "./chat-state";
import type { AiDiscovery } from "./discovery";
import type { AiChatPlacement } from "./preferences";

export interface AiToolResult {
  readonly ok: boolean;
  /** What the model reads: the data, or what went wrong. */
  readonly text: string;
}

// The chats live in the main process (the chat host). The views, in a cluster frame's dock or right
// panel or in a window of their own, show copies of them and send the user's actions back.

export interface CreateAiChat {
  readonly clusterId: string;
  readonly clusterName: string;
  /** Where to show it; the user's last placement when undefined. */
  readonly placement?: AiChatPlacement;
}

export const createAiChatChannel = getRequestChannel<CreateAiChat, AiChatSnapshot>("ai-chat-create");

/** The chats of one cluster, or of all clusters. */
export const listAiChatsChannel = getRequestChannel<{ readonly clusterId?: string }, AiChatSnapshot[]>("ai-chat-list");

export type AiChatCommand =
  | { readonly type: "send"; readonly chatId: string; readonly text: string }
  | { readonly type: "stop"; readonly chatId: string }
  | { readonly type: "settings"; readonly chatId: string; readonly settings: Partial<AiChatSettings> }
  | { readonly type: "allow-changes"; readonly chatId: string; readonly allowChanges: boolean }
  | { readonly type: "approval"; readonly chatId: string; readonly itemId: string; readonly approved: boolean }
  | { readonly type: "move"; readonly chatId: string; readonly placement: AiChatPlacement }
  | { readonly type: "clear"; readonly chatId: string }
  | { readonly type: "close"; readonly chatId: string };

export const aiChatCommandChannel = getRequestChannel<AiChatCommand, void>("ai-chat-command");

/** A chat changed. */
export const aiChatStateChannel = getMessageChannel<AiChatSnapshot>("ai-chat-state");

/** A chat was closed. */
export const aiChatClosedChannel = getMessageChannel<{ readonly chatId: string }>("ai-chat-closed");

/**
 * A tool call, for the cluster frame of the chat's cluster to run: the tools read that cluster and
 * drive that frame. The chat host has already checked "Allow changes" and asked for approval.
 */
export const aiToolCallChannel = getMessageChannel<{
  readonly callId: string;
  readonly chatId: string;
  readonly clusterId: string;
  readonly name: string;
  readonly args: unknown;
  readonly allowChanges: boolean;
}>("ai-chat-tool-call");

export const aiToolResultChannel = getRequestChannel<{ readonly callId: string; readonly result: AiToolResult }, void>(
  "ai-chat-tool-result",
);

/** What the CLIs installed on this computer offer, discovered when Freelens starts. */
export const getAiDiscoveryChannel = getRequestChannel<void, AiDiscovery>("ai-chat-get-discovery");

export const refreshAiDiscoveryChannel = getRequestChannel<void, AiDiscovery>("ai-chat-refresh-discovery");

export const aiDiscoveryChangedChannel = getMessageChannel<AiDiscovery>("ai-chat-discovery-changed");
