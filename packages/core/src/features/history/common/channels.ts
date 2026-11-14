/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannel } from "@freelensapp/messaging";

/** What a cluster's view shows, as far as going back and forward restores it */
export interface ClusterViewState {
  /** The path of the view with its query: the details shown, the search, the sort */
  readonly path: string;
  /** The namespaces selected in the namespace filter */
  readonly namespaces: readonly string[];
  /** The rows open under themselves, by list */
  readonly expanded: Readonly<Record<string, readonly string[]>>;
  /** How far the list is scrolled */
  readonly scrollTop: number;
}

export interface ClusterViewMessage {
  readonly clusterId: string;
  readonly state: ClusterViewState;
}

/** A cluster frame tells the main frame what its view shows now. Relayed by the main process. */
export const clusterViewStateChannel = getMessageChannel<ClusterViewMessage>("history:cluster-view-state");

/** The main frame tells a cluster frame which view to show again. Relayed by the main process. */
export const restoreClusterViewChannel = getMessageChannel<ClusterViewMessage>("history:restore-cluster-view");

/** Go back (negative) or forward (positive) that many steps. Relayed by the main process. */
export const historyGoChannel = getMessageChannel<number>("history:go");
