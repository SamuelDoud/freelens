/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./pods.scss";

import { podListLayoutColumnInjectionToken } from "@freelensapp/list-layout";
import { withInjectables } from "@ogre-tools/injectable-react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { useEffect } from "react";
import frameActivityInjectable from "../../../features/frame-activity/renderer/frame-activity.injectable";
import { pollWhileActive } from "../../../features/frame-activity/renderer/poll-while-active";
import isTableColumnHiddenInjectable from "../../../features/user-preferences/common/is-table-column-hidden.injectable";
import eventStoreInjectable from "../events/store.injectable";
import { KubeObjectListLayout } from "../kube-object-list-layout";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { podResourceColumnIds } from "./columns/pods-resource-column";
import { getPodControllerKinds } from "./pod-controller-kinds";
import { getPodContainerPorts } from "./pod-ports-cell";
import { getPodResources } from "./pod-resources";
import podStoreInjectable from "./store.injectable";

import type { Pod } from "@freelensapp/kube-object";
import type { SpecificKubeListLayoutColumn } from "@freelensapp/list-layout";

import type { IComputedValue } from "mobx";

import type { SearchField } from "../../../features/advanced-search/common/conditions";
import type { EventStore } from "../events/store";
import type { ListLayoutSearchFilter } from "../item-object-list/list-layout";
import type { PodStore } from "./store";

interface Dependencies {
  eventStore: EventStore;
  podStore: PodStore;
  columns: SpecificKubeListLayoutColumn<Pod>[];
  /** Whether the pods' CPU and memory usage can be seen: the frame is active and a usage column shown */
  usageVisible: IComputedValue<boolean>;
}

const REFRESH_METRICS_INTERVAL = 10;

const podSearchFields: SearchField<Pod>[] = [
  { id: "status", title: "Status", kind: "text", getValues: (pod) => pod.getStatusMessage() },
  { id: "controlledBy", title: "Controlled by (kind)", kind: "text", getValues: getPodControllerKinds },
  { id: "node", title: "Node", kind: "text", getValues: (pod) => pod.getNodeName() },
  { id: "ip", title: "Pod IP", kind: "text", getValues: (pod) => pod.status?.podIP },
  { id: "qos", title: "QoS", kind: "text", getValues: (pod) => pod.getQosClass() },
  { id: "restarts", title: "Restarts", kind: "quantity", unit: "count", getQuantity: (pod) => pod.getRestartsCount() },
  {
    id: "image",
    title: "Container image",
    kind: "text",
    getValues: (pod) => pod.getAllContainers().map((container) => container.image),
  },
  ...podResourceColumnIds.map(
    (id): SearchField<Pod> => ({
      id,
      title: {
        cpuRequest: "CPU request",
        cpuLimit: "CPU limit",
        memoryRequest: "Memory request",
        memoryLimit: "Memory limit",
      }[id],
      kind: "quantity",
      unit: id.startsWith("cpu") ? "cpu" : "memory",
      getQuantity: (pod) => getPodResources(pod)[id],
    }),
  ),
];

// The same array on every render keeps the text the list searches in; each filter reads its item only.
const searchFilters: ListLayoutSearchFilter<Pod>[] = [
  (pod) => pod.getSearchFields(),
  (pod) => pod.getStatusMessage(),
  (pod) => pod.status?.podIP,
  (pod) => pod.getNodeName(),
  (pod) => getPodContainerPorts(pod).flatMap((port) => [port.name, port.containerPort, port.protocol]),
];

// What a narrow table keeps longest, first to last; the display order is the priority of the columns.
const podColumnKeepOrder = [
  "name",
  "status",
  "namespace",
  "warning",
  "restarts",
  "age",
  "cpuUsage",
  "memoryUsage",
  "node",
  "owners",
  "containers",
  "ports",
  "ip",
  "qos",
  ...podResourceColumnIds,
  "logs",
];

const NonInjectedPods = observer((props: Dependencies) => {
  const { columns, eventStore, podStore, usageVisible } = props;

  // The usage metrics of every pod, only for the CPU and memory columns:
  // nothing to fetch while neither can be seen.
  useEffect(
    () => pollWhileActive(usageVisible, REFRESH_METRICS_INTERVAL, () => void podStore.loadKubeMetrics()),
    [podStore, usageVisible],
  );

  return (
    <SiblingsInTabLayout>
      <KubeObjectListLayout
        className="Pods"
        store={podStore}
        dependentStores={[eventStore]} // status icon component uses event store
        tableId="workloads_pods"
        isConfigurable
        columnKeepOrder={podColumnKeepOrder}
        defaultHiddenTableColumns={["ip", "node", "qos", ...podResourceColumnIds]}
        columnsAddedLater={podResourceColumnIds}
        searchFilters={searchFilters}
        searchFiltersArePure
        searchFields={podSearchFields}
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
    usageVisible: (() => {
      const activity = di.inject(frameActivityInjectable);
      const isTableColumnHidden = di.inject(isTableColumnHiddenInjectable);

      return computed(
        () =>
          activity.get() &&
          !(isTableColumnHidden("workloads_pods", "cpuUsage") && isTableColumnHidden("workloads_pods", "memoryUsage")),
      );
    })(),
  }),
});
