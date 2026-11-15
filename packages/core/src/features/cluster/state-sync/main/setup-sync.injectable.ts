/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeApplicationIsLoadingInjectionToken } from "@freelensapp/application";
import { getInjectable } from "@ogre-tools/injectable";
import { isEqual } from "es-toolkit";
import { reaction } from "mobx";
import clustersInjectable from "../../storage/common/clusters.injectable";
import initClusterStoreInjectable from "../../storage/main/init.injectable";
import emitClusterStateUpdateInjectable from "./emit-update.injectable";

import type { IReactionDisposer } from "mobx";

import type { Cluster } from "../../../../common/cluster/cluster";

const setupClusterStateBroadcastingInjectable = getInjectable({
  id: "setup-cluster-state-broadcasting",
  instantiate: (di) => ({
    run: () => {
      const emitClusterStateUpdate = di.inject(emitClusterStateUpdateInjectable);
      const clusters = di.inject(clustersInjectable);
      const watched = new Map<Cluster, IReactionDisposer>();

      // One reaction for each cluster: a change in one cluster computes the
      // state of that cluster only, once, and emits what it computed.
      reaction(
        () => clusters.get(),
        (current) => {
          const present = new Set(current);

          for (const [cluster, dispose] of watched) {
            if (!present.has(cluster)) {
              dispose();
              watched.delete(cluster);
            }
          }

          for (const cluster of current) {
            if (watched.has(cluster)) {
              continue;
            }

            watched.set(
              cluster,
              reaction(
                () => cluster.getState(),
                (state) => emitClusterStateUpdate({ clusterId: cluster.id, state }),
                { equals: isEqual, fireImmediately: true },
              ),
            );
          }
        },
        { fireImmediately: true },
      );
    },
    runAfter: initClusterStoreInjectable,
  }),
  injectionToken: beforeApplicationIsLoadingInjectionToken,
});

export default setupClusterStateBroadcastingInjectable;
