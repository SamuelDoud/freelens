/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { AiChatItem, AiChatSnapshot } from "./chat-state";

/** What of a chat can change besides its items: the id and the cluster are fixed. */
export type AiChatMutableSettings = Pick<
  AiChatSnapshot,
  "clusterName" | "placement" | "provider" | "model" | "effort" | "allowChanges" | "running"
>;

const mutableSettingKeys = [
  "clusterName",
  "placement",
  "provider",
  "model",
  "effort",
  "allowChanges",
  "running",
] as const satisfies readonly (keyof AiChatMutableSettings)[];

/**
 * What changed in a chat since the last state its views were sent. It applies to the chat at
 * `seq - 1`, and to a chat that already has what it says, so that a view that asked for a snapshot
 * at any time between two changes gets to the same chat.
 */
export interface AiChatDelta {
  readonly chatId: string;
  /** The `seq` of the chat once the delta is applied. */
  readonly seq: number;
  /** The settings that changed. */
  readonly settings?: Partial<AiChatMutableSettings>;
  /** The number of items after the change, when the items changed. */
  readonly length?: number;
  /** The items added or replaced, by their position. */
  readonly changes?: readonly { readonly index: number; readonly item: AiChatItem }[];
}

/** What the host sends to the views: the whole chat when it is new, then what changes. */
export type AiChatStateMessage =
  | { readonly kind: "snapshot"; readonly snapshot: AiChatSnapshot }
  | { readonly kind: "delta"; readonly delta: AiChatDelta };

/**
 * The delta from one state of a chat to the next, or undefined when nothing changed. Items are
 * compared by identity: the host never changes an item in place, it replaces it.
 */
export function diffAiChat(
  previous: AiChatSnapshot,
  next: Omit<AiChatSnapshot, "seq">,
  seq: number,
): AiChatDelta | undefined {
  const settings: { -readonly [Key in keyof AiChatMutableSettings]?: AiChatMutableSettings[Key] } = {};
  let settingsChanged = false;

  for (const key of mutableSettingKeys) {
    if (previous[key] !== next[key]) {
      Object.assign(settings, { [key]: next[key] });
      settingsChanged = true;
    }
  }

  const changes: { index: number; item: AiChatItem }[] = [];

  for (let index = 0; index < next.items.length; index += 1) {
    if (previous.items[index] !== next.items[index]) {
      changes.push({ index, item: next.items[index] });
    }
  }

  const itemsChanged = changes.length > 0 || previous.items.length !== next.items.length;

  if (!settingsChanged && !itemsChanged) {
    return undefined;
  }

  return {
    chatId: previous.id,
    seq,
    ...(settingsChanged ? { settings } : {}),
    ...(itemsChanged ? { length: next.items.length, changes } : {}),
  };
}

/**
 * The chat after a delta, or undefined when the chat is not the one the delta follows: a view that
 * missed a change asks for the whole chat instead. A delta the chat is already past gives the chat
 * back as it is.
 */
export function applyAiChatDelta(chat: AiChatSnapshot, delta: AiChatDelta): AiChatSnapshot | undefined {
  if (delta.chatId !== chat.id) {
    return undefined;
  }

  if (delta.seq <= chat.seq) {
    return chat;
  }

  if (delta.seq !== chat.seq + 1) {
    return undefined;
  }

  let items = chat.items;

  if (delta.length !== undefined) {
    const next = items.slice(0, delta.length);

    for (const { index, item } of delta.changes ?? []) {
      next[index] = item;
    }

    items = next;
  }

  return { ...chat, ...delta.settings, items, seq: delta.seq };
}
