/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./pods.scss";

import { podListLayoutColumnInjectionToken } from "@freelensapp/list-layout";
import { interval } from "@freelensapp/utilities";
import { withInjectables } from "@ogre-tools/injectable-react";
import { autorun } from "mobx";
import { observer } from "mobx-react";
import React, { useEffect } from "react";
import windowActivityInjectable, { INACTIVE_MULTIPLIER } from "../../utils/window-activity.injectable";
import eventStoreInjectable from "../events/store.injectable";
import { KubeObjectListLayout } from "../kube-object-list-layout";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import podStoreInjectable from "./store.injectable";

import type { Pod } from "@freelensapp/kube-object";
import type { SpecificKubeListLayoutColumn } from "@freelensapp/list-layout";

import type { IObservableValue } from "mobx";

import type { EventStore } from "../events/store";
import type { PodStore } from "./store";

interface Dependencies {
  eventStore: EventStore;
  podStore: PodStore;
  columns: SpecificKubeListLayoutColumn<Pod>[];
  isWindowActive: IObservableValue<boolean>;
}

const REFRESH_METRICS_INTERVAL = 60;

const NonInjectedPods = observer((props: Dependencies) => {
  const { columns, eventStore, podStore, isWindowActive } = props;

  useEffect(() => {
    let metricsInterval: ReturnType<typeof interval> | undefined;

    // autorun fires immediately on creation and re-fires when
    // isWindowActive changes, adjusting the polling interval.
    const dispose = autorun(() => {
      const multiplier = isWindowActive.get() ? 1 : INACTIVE_MULTIPLIER;
      const seconds = REFRESH_METRICS_INTERVAL * multiplier;

      metricsInterval?.stop();
      metricsInterval = interval(seconds, () => podStore.loadKubeMetrics());
      metricsInterval.start(true);
    });

    return () => {
      dispose();
      metricsInterval?.stop();
    };
  }, [podStore, isWindowActive]);

  return (
    <SiblingsInTabLayout>
      <KubeObjectListLayout
        className="Pods"
        store={podStore}
        dependentStores={[eventStore]} // status icon component uses event store
        tableId="workloads_pods"
        isConfigurable
        defaultHiddenTableColumns={["ip", "node", "qos"]}
        searchFilters={[
          (pod) => pod.getSearchFields(),
          (pod) => pod.getStatusMessage(),
          (pod) => pod.status?.podIP,
          (pod) => pod.getNodeName(),
        ]}
        renderHeaderTitle="Pods"
        renderTableHeader={[]}
        renderTableContents={() => []}
        columns={columns}
      />
    </SiblingsInTabLayout>
  );
});

export const Pods = withInjectables<Dependencies>(NonInjectedPods, {
  getProps: (di, props) => ({
    ...props,
    eventStore: di.inject(eventStoreInjectable),
    podStore: di.inject(podStoreInjectable),
    columns: di.injectMany(podListLayoutColumnInjectionToken),
    isWindowActive: di.inject(windowActivityInjectable).isActive,
  }),
});
