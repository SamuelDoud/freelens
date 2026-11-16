/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import hostedClusterIdInjectable from "../../../renderer/cluster-frame-context/hosted-cluster-id.injectable";
import createResourceTabStoreInjectable from "../../../renderer/components/dock/create-resource/store.injectable";
import { TabKind } from "../../../renderer/components/dock/dock/store";
import dockStoreInjectable from "../../../renderer/components/dock/dock/store.injectable";
import editResourceTabStoreInjectable from "../../../renderer/components/dock/edit-resource/store.injectable";
import logStoreInjectable from "../../../renderer/components/dock/logs/store.injectable";
import terminalStoreInjectable from "../../../renderer/components/dock/terminal/store.injectable";
import portForwardStoreInjectable from "../../../renderer/port-forward/port-forward-store/port-forward-store.injectable";
import aiChatMirrorInjectable from "../../ai-chat/renderer/chat-mirror.injectable";

/**
 * What this frame holds that is lost with it, as the reasons it must not be
 * evicted; empty when everything can be loaded again. What the dock keeps in
 * its storage (the tabs, the drafts, the values of a chart) comes back with the
 * frame, but not the state of a running thing: a terminal session, the lines
 * of a log, a chat's turn, a port forward.
 */
const frameKeepAliveReasonsInjectable = getInjectable({
  id: "frame-keep-alive-reasons",
  instantiate: (di) => {
    const dock = di.inject(dockStoreInjectable);
    const terminals = di.inject(terminalStoreInjectable);
    const logs = di.inject(logStoreInjectable);
    const edits = di.inject(editResourceTabStoreInjectable);
    const creates = di.inject(createResourceTabStoreInjectable);
    const chats = di.inject(aiChatMirrorInjectable);
    const portForwards = di.inject(portForwardStoreInjectable);
    const clusterId = di.inject(hostedClusterIdInjectable);

    return computed((): string[] => {
      const reasons = new Set<string>();

      for (const tab of dock.tabs) {
        switch (tab.kind) {
          case TabKind.TERMINAL:
            if (terminals.isConnected(tab.id)) {
              reasons.add("terminal session");
            }
            break;
          case TabKind.POD_LOGS:
            if (logs.getLogs(tab.id).length > 0) {
              reasons.add("log lines");
            }
            break;
          case TabKind.EDIT_RESOURCE: {
            const data = edits.getData(tab.id);

            if (data?.draft !== undefined && data.draft !== data.firstDraft) {
              reasons.add("unsaved edit");
            }
            break;
          }
          case TabKind.CREATE_RESOURCE:
            if (creates.getData(tab.id)?.trim()) {
              reasons.add("unsaved new resource");
            }
            break;
        }
      }

      if (clusterId && chats.forCluster(clusterId).some((chat) => chat.running)) {
        reasons.add("chat turn running");
      }

      if (portForwards.portForwards.some((portForward) => portForward.status === "Active")) {
        reasons.add("port forward");
      }

      return [...reasons].sort();
    });
  },
});

export default frameKeepAliveReasonsInjectable;
