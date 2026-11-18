/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { ClusterFrameInfo } from "../../../common/cluster-frames.injectable";

/**
 * The cluster frame a caller means by a frame id alone. A frame id is the
 * routing id of the frame within its renderer process, so it names one frame
 * only while the frames share a process: with a process per cluster the frames
 * of two clusters can have the same id. Of those, the one shown is taken,
 * because a call made from a frame comes from one the user is using; failing
 * that, the first.
 */
export const findClusterFrame = (
  frames: Iterable<[string, ClusterFrameInfo]>,
  frameId: number | undefined,
  shownClusterIds: readonly string[] | undefined,
): ClusterFrameInfo | undefined => {
  if (frameId === undefined) {
    return undefined;
  }

  const sameId = [...frames].filter(([, frame]) => frame.frameId === frameId);

  return (sameId.find(([clusterId]) => shownClusterIds?.includes(clusterId)) ?? sameId[0])?.[1];
};
