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
import deviceClassStoreInjectable from "./store.injectable";

import type { DeviceClassStore } from "./store";

enum columnId {
  name = "name",
  selectors = "selectors",
  extendedResource = "extendedResource",
  age = "age",
}

interface Dependencies {
  store: DeviceClassStore;
}

const NonInjectedDeviceClasses = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="devices_deviceclasses"
      className="DeviceClasses"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.selectors]: (item) => item.spec?.selectors?.length ?? 0,
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Device Classes"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Selectors", className: "selectors", sortBy: columnId.selectors, id: columnId.selectors },
        { title: "Extended Resource", className: "extendedResource", id: columnId.extendedResource },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.spec?.selectors?.length ?? 0)}</WithTooltip>,
        <WithTooltip>{text(item.spec?.extendedResourceName)}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const DeviceClasses = withInjectables<Dependencies>(NonInjectedDeviceClasses, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(deviceClassStoreInjectable),
  }),
});
