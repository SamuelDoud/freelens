/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectListLayout } from "../kube-object-list-layout";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { text, yesNo } from "../resource-details/format";
import { WithTooltip } from "../with-tooltip";
import csiDriverStoreInjectable from "./store.injectable";

import type { CSIDriverStore } from "./store";

enum columnId {
  name = "name",
  attachRequired = "attachRequired",
  podInfoOnMount = "podInfoOnMount",
  storageCapacity = "storageCapacity",
  modes = "modes",
  age = "age",
}

interface Dependencies {
  store: CSIDriverStore;
}

const NonInjectedCSIDrivers = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="storage_csidrivers"
      className="CSIDrivers"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),

        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="CSI Drivers"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Attach Required", className: "attachRequired", id: columnId.attachRequired },
        { title: "Pod Info On Mount", className: "podInfoOnMount", id: columnId.podInfoOnMount },
        { title: "Storage Capacity", className: "storageCapacity", id: columnId.storageCapacity },
        { title: "Modes", className: "modes", id: columnId.modes },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(yesNo(item.spec?.attachRequired))}</WithTooltip>,
        <WithTooltip>{text(yesNo(item.spec?.podInfoOnMount))}</WithTooltip>,
        <WithTooltip>{text(yesNo(item.spec?.storageCapacity))}</WithTooltip>,
        <WithTooltip>{text(item.spec?.volumeLifecycleModes?.join(", "))}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const CSIDrivers = withInjectables<Dependencies>(NonInjectedCSIDrivers, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(csiDriverStoreInjectable),
  }),
});
