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
import csiNodeStoreInjectable from "./store.injectable";

import type { CSINodeStore } from "./store";

enum columnId {
  name = "name",
  drivers = "drivers",
  age = "age",
}

interface Dependencies {
  store: CSINodeStore;
}

const NonInjectedCSINodes = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="storage_csinodes"
      className="CSINodes"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.drivers]: (item) => item.getDrivers().length,
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="CSI Nodes"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Drivers", className: "drivers", sortBy: columnId.drivers, id: columnId.drivers },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>
          {text(
            item
              .getDrivers()
              .map((driver) => driver.name)
              .join(", "),
          )}
        </WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const CSINodes = withInjectables<Dependencies>(NonInjectedCSINodes, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(csiNodeStoreInjectable),
  }),
});
