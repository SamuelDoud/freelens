/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectListLayout } from "../kube-object-list-layout";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";
import { text } from "../resource-details/format";
import { WithTooltip } from "../with-tooltip";
import csiStorageCapacityStoreInjectable from "./store.injectable";

import type { CSIStorageCapacityStore } from "./store";

enum columnId {
  name = "name",
  namespace = "namespace",
  storageClass = "storageClass",
  capacity = "capacity",
  maximumVolumeSize = "maximumVolumeSize",
  age = "age",
}

interface Dependencies {
  store: CSIStorageCapacityStore;
}

const NonInjectedCSIStorageCapacities = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="storage_csistoragecapacities"
      className="CSIStorageCapacities"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.namespace]: (item) => item.getNs(),
        [columnId.storageClass]: (item) => item.storageClassName,
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="CSI Storage Capacities"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Namespace", className: "namespace", sortBy: columnId.namespace, id: columnId.namespace },
        { title: "Storage Class", className: "storageClass", sortBy: columnId.storageClass, id: columnId.storageClass },
        { title: "Capacity", className: "capacity", id: columnId.capacity },
        { title: "Maximum Volume Size", className: "maximumVolumeSize", id: columnId.maximumVolumeSize },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <NamespaceSelectBadge key="namespace" namespace={item.getNs()} />,
        <WithTooltip>{text(item.storageClassName)}</WithTooltip>,
        <WithTooltip>{text(item.capacity)}</WithTooltip>,
        <WithTooltip>{text(item.maximumVolumeSize)}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const CSIStorageCapacities = withInjectables<Dependencies>(NonInjectedCSIStorageCapacities, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(csiStorageCapacityStoreInjectable),
  }),
});
