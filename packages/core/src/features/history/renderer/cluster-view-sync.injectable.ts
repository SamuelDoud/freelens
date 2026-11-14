/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observableHistoryInjectionToken } from "@freelensapp/routing";
import { getInjectable } from "@ogre-tools/injectable";
import { runInAction } from "mobx";
import hostedClusterInjectable from "../../../renderer/cluster-frame-context/hosted-cluster.injectable";
import navigateInjectable from "../../../renderer/navigation/navigate.injectable";
import expandedRowsInjectable from "../../inline-details/renderer/expanded-rows.injectable";
import expandedRowsRegistryInjectable from "../../inline-details/renderer/expanded-rows-registry.injectable";
import selectedNamespacesStorageInjectable from "../../namespace-filtering/renderer/storage.injectable";

import type { ClusterViewState } from "../common/channels";

/** How long after a restore the cluster frame keeps what it shows to itself */
const restoreSettleMs = 1200;

const listScroller = () => document.querySelector<HTMLElement>(".ItemListLayout .VirtualList .list");

export interface ClusterViewSync {
  readonly clusterId: string;
  /** What the view shows now */
  read: () => ClusterViewState;
  /** Shows a view again */
  restore: (state: ClusterViewState) => void;
  /** Whether a restore is still settling, during which the view does not report itself */
  isRestoring: () => boolean;
}

/** Reads and restores what a cluster frame's view shows. Only a cluster frame has one. */
const clusterViewSyncInjectable = getInjectable({
  id: "history-cluster-view-sync",
  instantiate: (di): ClusterViewSync | undefined => {
    const cluster = di.inject(hostedClusterInjectable);

    if (!cluster) {
      return undefined;
    }

    const history = di.inject(observableHistoryInjectionToken);
    const namespaces = di.inject(selectedNamespacesStorageInjectable);
    const registry = di.inject(expandedRowsRegistryInjectable);
    const navigate = di.inject(navigateInjectable);
    let restoringUntil = 0;

    return {
      clusterId: cluster.id,
      isRestoring: () => Date.now() < restoringUntil,
      read: () => ({
        path: `${history.location.pathname}${history.location.search}`,
        namespaces: namespaces.get().slice(),
        expanded: Object.fromEntries(
          [...registry.entries()]
            .map(([tableId, rows]) => [tableId, rows.openIds.slice()] as const)
            .filter(([, ids]) => ids.length > 0),
        ),
        scrollTop: listScroller()?.scrollTop ?? 0,
      }),
      restore: (state) => {
        restoringUntil = Date.now() + restoreSettleMs;

        runInAction(() => {
          namespaces.set([...state.namespaces]);

          for (const [tableId, rows] of registry.entries()) {
            if (!state.expanded[tableId]) {
              rows.closeAll();
            }
          }

          for (const [tableId, ids] of Object.entries(state.expanded)) {
            const rows = di.inject(expandedRowsInjectable, tableId);

            rows.closeAll();
            ids.forEach((id) => rows.openRow(id));
          }
        });

        // The path goes last: a change of namespaces makes the search box load
        // the search last used with them, and the restored path must win over it.
        setTimeout(() => {
          if (`${history.location.pathname}${history.location.search}` !== state.path) {
            navigate(state.path);
          }
        }, 0);

        // The list renders its rows first; then it can scroll to where it was.
        setTimeout(() => {
          const scroller = listScroller();

          if (scroller) {
            scroller.scrollTop = state.scrollTop;
          }
        }, 400);
      },
    };
  },
});

export default clusterViewSyncInjectable;
