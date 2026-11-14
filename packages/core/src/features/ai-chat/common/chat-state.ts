/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { AiChatPlacement } from "./preferences";
import type { AiProviderId } from "./providers";

export type AiChatItem =
  | { readonly kind: "user"; readonly id: string; readonly text: string }
  | { readonly kind: "assistant"; readonly id: string; readonly text: string }
  | {
      readonly kind: "tool";
      readonly id: string;
      readonly name: string;
      readonly args: unknown;
      readonly status: "running" | "done" | "failed";
      readonly output?: string;
    }
  | {
      readonly kind: "approval";
      readonly id: string;
      readonly description: string;
      readonly state: "pending" | "approved" | "rejected";
    }
  | { readonly kind: "notice"; readonly id: string; readonly text: string; readonly tone: "error" | "info" };

/** An item to add: the id is made up when it is not given. */
export type NewAiChatItem = AiChatItem extends infer Item
  ? Item extends AiChatItem
    ? Omit<Item, "id"> & { id?: string }
    : never
  : never;

export interface AiChatSettings {
  readonly provider: AiProviderId;
  readonly model: string;
  readonly effort: string;
}

/** A chat as its views see it. The main process holds the chat; every view shows a copy of this. */
export interface AiChatSnapshot extends AiChatSettings {
  readonly id: string;
  /** The cluster the chat reads and drives. */
  readonly clusterId: string;
  readonly clusterName: string;
  readonly placement: AiChatPlacement;
  /** The "Allow changes" checkbox: off for every new chat. */
  readonly allowChanges: boolean;
  readonly running: boolean;
  readonly items: readonly AiChatItem[];
}
