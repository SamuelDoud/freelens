/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { when } from "mobx";

import type { ClusterFrameHandler } from "../../../renderer/components/cluster-manager/cluster-frame-handler";
import type { RequestClusterActivation } from "../../cluster/activation/common/request-token";
import type { GetClusterById } from "../../cluster/storage/common/get-by-id.injectable";

interface Dependencies {
  clusterFrames: Pick<ClusterFrameHandler, "initView" | "hasLoadedView">;
  getClusterById: GetClusterById;
  requestClusterActivation: RequestClusterActivation;
}

/**
 * Starts the frame of each cluster after the previous one has loaded: each
 * loads the whole interface, and several starting at once compete for the
 * same resources. A frame that does not load in `timeoutMs` does not hold up
 * the others, and neither does a cluster that no longer exists, which has no
 * frame to wait for.
 */
export async function startFramesInOrder(
  clusterIds: readonly string[],
  { clusterFrames, getClusterById, requestClusterActivation }: Dependencies,
  isCancelled: () => boolean,
  timeoutMs: number,
): Promise<void> {
  for (const clusterId of clusterIds) {
    if (isCancelled()) {
      return;
    }

    if (!getClusterById(clusterId)) {
      continue;
    }

    clusterFrames.initView(clusterId);
    requestClusterActivation({ clusterId });

    try {
      await when(() => clusterFrames.hasLoadedView(clusterId), { timeout: timeoutMs });
    } catch {
      // Not loaded in time: the next one starts anyway.
    }
  }
}
