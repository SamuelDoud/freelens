/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ClusterMetadataKey } from "../../common/cluster-types";
import k8SRequestInjectable from "../k8s-request.injectable";
import { clusterMetadataDetectorInjectionToken } from "./token";

import type { Cluster } from "../../common/cluster/cluster";

const clusterNodeCountDetectorInjectable = getInjectable({
  id: "cluster-node-count-detector",
  instantiate: (di) => {
    const k8sRequest = di.inject(k8SRequestInjectable);
    const requestNodeCount = async (cluster: Cluster) => {
      // The Table format, without the objects, is about 200 bytes per node
      // where a NodeList is about 10 KiB. A server that does not know it
      // answers 406, or ignores the header and returns the list.
      try {
        const table = (await k8sRequest(cluster, "/api/v1/nodes?includeObject=None", {
          headers: { Accept: "application/json;as=Table;g=meta.k8s.io;v=v1" },
        })) as { rows?: unknown[]; items?: unknown[] };

        if (Array.isArray(table.rows)) {
          return table.rows.length;
        }

        if (Array.isArray(table.items)) {
          return table.items.length;
        }
      } catch {
        // fall through to the plain list
      }

      const { items } = (await k8sRequest(cluster, "/api/v1/nodes")) as { items: unknown[] };

      return items.length;
    };

    return {
      key: ClusterMetadataKey.NODES_COUNT,
      detect: async (cluster) => {
        try {
          return {
            value: await requestNodeCount(cluster),
            accuracy: 1000,
          };
        } catch {
          return null;
        }
      },
    };
  },
  injectionToken: clusterMetadataDetectorInjectionToken,
});

export default clusterNodeCountDetectorInjectable;
