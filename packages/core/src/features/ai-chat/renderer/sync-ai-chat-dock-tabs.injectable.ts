/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { reaction } from "mobx";
import { beforeClusterFrameStartsSecondInjectionToken } from "../../../renderer/before-frame-starts/tokens";
import hostedClusterInjectable from "../../../renderer/cluster-frame-context/hosted-cluster.injectable";
import { TabKind } from "../../../renderer/components/dock/dock/store";
import dockStoreInjectable from "../../../renderer/components/dock/dock/store.injectable";
import { aiChatTabId, chatIdOfTab } from "./ai-chat-dock-tab";
import aiChatMirrorInjectable from "./chat-mirror.injectable";

/**
 * Keeps the dock's chat tabs in step with the chats of this cluster placed at the bottom: a tab for
 * each, none for a chat that moved or closed, nor for a tab left over from before a restart.
 */
const syncAiChatDockTabsInjectable = getInjectable({
  id: "sync-ai-chat-dock-tabs",
  instantiate: (di) => ({
    run: async () => {
      const cluster = di.inject(hostedClusterInjectable);

      if (!cluster) {
        return;
      }

      const mirror = di.inject(aiChatMirrorInjectable);
      const dockStore = di.inject(dockStoreInjectable);

      await mirror.load(cluster.id).catch(() => undefined);

      reaction(
        () =>
          mirror
            .forCluster(cluster.id)
            .map((chat) => `${chat.id}:${chat.placement}`)
            .join(","),
        () => {
          const atBottom = new Set(mirror.forCluster(cluster.id, "bottom").map((chat) => chat.id));

          for (const tab of dockStore.tabs.filter((tab) => tab.kind === TabKind.AI_CHAT)) {
            const chatId = chatIdOfTab(tab.id);

            if (!chatId || !atBottom.has(chatId)) {
              dockStore.closeTab(tab.id);
            }
          }

          for (const chatId of atBottom) {
            if (!dockStore.getTabById(aiChatTabId(chatId))) {
              dockStore.createTab({ id: aiChatTabId(chatId), kind: TabKind.AI_CHAT, title: "AI chat" });
            }
          }
        },
        { fireImmediately: true },
      );
    },
  }),
  injectionToken: beforeClusterFrameStartsSecondInjectionToken,
});

export default syncAiChatDockTabsInjectable;
