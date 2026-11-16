/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { toJS } from "mobx";
import { ClusterMetadataKey } from "../../common/cluster-types";
import { enumKeys } from "../../common/utils/enum";

import type { KubernetesCluster } from "../../common/catalog-entities";
import type { Cluster } from "../../common/cluster/cluster";

export type UpdateEntityMetadata = (entity: KubernetesCluster, cluster: Cluster) => void;

const hasSameLabels = (current: Partial<Record<string, string>> | undefined, next: Partial<Record<string, string>>) => {
  if (!current) {
    return false;
  }

  const keys = Object.keys(next);

  return (
    Object.keys(current).length === keys.length &&
    keys.every((key) => Object.hasOwn(current, key) && current[key] === next[key])
  );
};

const updateEntityMetadataInjectable = getInjectable({
  id: "update-entity-metadata",

  instantiate: (): UpdateEntityMetadata => {
    // The labels of each cluster applied last, to take back the ones the cluster no longer has.
    const appliedLabels = new WeakMap<Cluster, Record<string, string | undefined>>();

    return (entity, cluster) => {
      const clusterLabels = toJS(cluster.labels);
      const labels = { ...entity.metadata.labels };

      for (const key of Object.keys(appliedLabels.get(cluster) ?? {})) {
        if (!Object.hasOwn(clusterLabels, key)) {
          delete labels[key];
        }
      }

      Object.assign(labels, clusterLabels);
      appliedLabels.set(cluster, clusterLabels);

      // Replacing equal labels would still notify whoever observes them.
      if (!hasSameLabels(entity.metadata.labels, labels)) {
        entity.metadata.labels = labels;
      }
      entity.metadata.distro = cluster.distribution.get();
      entity.metadata.kubeVersion = cluster.version.get();

      enumKeys(ClusterMetadataKey).forEach((key) => {
        const metadataKey = ClusterMetadataKey[key];

        entity.metadata[metadataKey] = cluster.metadata[metadataKey];
      });

      if (cluster.preferences?.clusterName) {
        /**
         * Only set the name if the it is overriden in preferences. If it isn't
         * set then the name of the entity has been explicitly set by its source
         */
        entity.metadata.name = cluster.preferences.clusterName;
      }
    };
  },
});

export default updateEntityMetadataInjectable;
