/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { action, observable } from "mobx";

import type { AiProviderId } from "../common/providers";
import type { OpenAiMessage } from "./openai-agent";

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
  provider: AiProviderId;
  model: string;
  effort: string;
}

let nextItemId = 0;
const newItemId = () => `item-${nextItemId++}`;

/** One conversation in a dock tab of a cluster frame. */
export class AiChat {
  /** Unique across the cluster frames: the tool calls of the command-line agents are routed by it. */
  readonly id = globalThis.crypto.randomUUID();

  @observable accessor provider: AiProviderId;
  @observable accessor model: string;
  @observable accessor effort: string;
  /** The "Allow changes" checkbox: off for every new chat. */
  @observable accessor allowChanges = false;
  @observable accessor running = false;

  readonly items = observable.array<AiChatItem>([], { deep: false });

  /** The command-line agents' sessions, to continue the conversation on the next turn. */
  readonly sessions = observable.map<AiProviderId, string>();

  /** The conversation as the OpenAI-compatible backend sees it. */
  openAiHistory: OpenAiMessage[] = [];

  abortController?: AbortController;

  private readonly approvals = new Map<string, (approved: boolean) => void>();

  constructor(settings: AiChatSettings) {
    this.provider = settings.provider;
    this.model = settings.model;
    this.effort = settings.effort;
  }

  @action
  add(item: NewAiChatItem): string {
    const id = item.id ?? newItemId();

    this.items.push({ ...item, id } as AiChatItem);

    return id;
  }

  @action
  update(id: string, changes: Partial<AiChatItem>) {
    const index = this.items.findIndex((item) => item.id === id);

    if (index >= 0) {
      this.items[index] = { ...this.items[index], ...changes } as AiChatItem;
    }
  }

  @action
  setSettings(settings: Partial<AiChatSettings>) {
    Object.assign(this, settings);
  }

  /** Asks the user to approve a change in the chat; resolves with their answer. */
  requestApproval(description: string): Promise<boolean> {
    const id = this.add({ kind: "approval", description, state: "pending" });

    return new Promise((resolve) => this.approvals.set(id, resolve));
  }

  @action
  resolveApproval(id: string, approved: boolean) {
    const resolve = this.approvals.get(id);

    if (resolve) {
      this.approvals.delete(id);
      this.update(id, { state: approved ? "approved" : "rejected" });
      resolve(approved);
    }
  }

  /** Rejects every pending approval, when the turn is stopped. */
  rejectPendingApprovals() {
    for (const id of [...this.approvals.keys()]) {
      this.resolveApproval(id, false);
    }
  }

  @action
  clear() {
    this.rejectPendingApprovals();
    this.items.clear();
    this.sessions.clear();
    this.openAiHistory = [];
  }
}
