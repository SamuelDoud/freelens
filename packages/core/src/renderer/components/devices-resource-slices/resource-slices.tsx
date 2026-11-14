/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectListLayout } from "../kube-object-list-layout";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { text } from "../resource-details/format";
import { WithTooltip } from "../with-tooltip";
import resourceSliceStoreInjectable from "./store.injectable";

import type { ResourceSliceStore } from "./store";

enum columnId {
  name = "name",
  driver = "driver",
  node = "node",
  pool = "pool",
  devices = "devices",
  age = "age",
}

interface Dependencies {
  store: ResourceSliceStore;
}

const NonInjectedResourceSlices = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="devices_resourceslices"
      className="ResourceSlices"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.driver]: (item) => item.spec?.driver,
        [columnId.node]: (item) => item.spec?.nodeName,
        [columnId.pool]: (item) => item.spec?.pool?.name,
        [columnId.devices]: (item) => item.getDevices().length,
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Resource Slices"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Driver", className: "driver", sortBy: columnId.driver, id: columnId.driver },
        { title: "Node", className: "node", sortBy: columnId.node, id: columnId.node },
        { title: "Pool", className: "pool", sortBy: columnId.pool, id: columnId.pool },
        { title: "Devices", className: "devices", sortBy: columnId.devices, id: columnId.devices },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.spec?.driver)}</WithTooltip>,
        <WithTooltip>{text(item.spec?.nodeName ?? (item.spec?.allNodes ? "All nodes" : ""))}</WithTooltip>,
        <WithTooltip>{text(item.spec?.pool?.name)}</WithTooltip>,
        <WithTooltip>{text(item.getDevices().length)}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const ResourceSlices = withInjectables<Dependencies>(NonInjectedResourceSlices, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(resourceSliceStoreInjectable),
  }),
});
