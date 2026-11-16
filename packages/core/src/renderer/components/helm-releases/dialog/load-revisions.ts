/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { orderBy } from "es-toolkit/compat";

import type {
  HelmReleaseRevision,
  RequestHelmReleaseHistory,
} from "../../../../common/k8s-api/endpoints/helm-releases.api/request-history.injectable";

export type LoadedRevisions =
  | { status: "loaded"; revisions: HelmReleaseRevision[] }
  | { status: "failed"; error: unknown }
  // The dialog moved to another release while the history was loading.
  | { status: "stale" };

export const loadRevisions = async (
  requestHistory: RequestHelmReleaseHistory,
  name: string,
  namespace: string,
  isStillWanted: () => boolean,
): Promise<LoadedRevisions> => {
  try {
    const history = await requestHistory(name, namespace);

    return isStillWanted()
      ? { status: "loaded", revisions: orderBy(history, "revision", "desc") }
      : { status: "stale" };
  } catch (error) {
    return isStillWanted() ? { status: "failed", error } : { status: "stale" };
  }
};
