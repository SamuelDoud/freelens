/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { withInjectables } from "@ogre-tools/injectable-react";
import getClusterByIdInjectable from "../../../../features/cluster/storage/common/get-by-id.injectable";
import { HideCompletedPodsSetting } from "../../cluster-settings/hide-completed-pods-setting";
import { entitySettingInjectionToken } from "../token";

import type { GetClusterById } from "../../../../features/cluster/storage/common/get-by-id.injectable";
import type { EntitySettingViewProps } from "../extension-registrator.injectable";

interface Dependencies {
  getClusterById: GetClusterById;
}

function NonInjectedPerformanceKubernetesClusterSettings({
  entity,
  getClusterById,
}: EntitySettingViewProps & Dependencies) {
  const cluster = getClusterById(entity.getId());

  if (!cluster) {
    return null;
  }

  return (
    <section>
      <section>
        <HideCompletedPodsSetting cluster={cluster} />
      </section>
    </section>
  );
}

const PerformanceKubernetesClusterSettings = withInjectables<Dependencies, EntitySettingViewProps>(
  NonInjectedPerformanceKubernetesClusterSettings,
  {
    getProps: (di, props) => ({
      ...props,
      getClusterById: di.inject(getClusterByIdInjectable),
    }),
  },
);

const performanceKubernetesClusterEntitySettingsInjectable = getInjectable({
  id: "performance-kubernetes-cluster-entity-settings",
  instantiate: () => ({
    apiVersions: new Set(["entity.k8slens.dev/v1alpha1"]),
    kind: "KubernetesCluster",
    title: "Performance",
    group: "Settings",
    id: "performance",
    orderNumber: 50,
    components: {
      View: PerformanceKubernetesClusterSettings,
    },
  }),
  injectionToken: entitySettingInjectionToken,
});

export default performanceKubernetesClusterEntitySettingsInjectable;
