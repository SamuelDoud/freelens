/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectListLayout } from "../kube-object-list-layout";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { describeTrueConditions } from "../resource-details/conditions-details";
import { text } from "../resource-details/format";
import { WithTooltip } from "../with-tooltip";
import storageVersionMigrationStoreInjectable from "./store.injectable";

import type { StorageVersionMigrationStore } from "./store";

enum columnId {
  name = "name",
  resource = "resource",
  status = "status",
  age = "age",
}

interface Dependencies {
  store: StorageVersionMigrationStore;
}

const NonInjectedStorageVersionMigrations = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="config_storageversionmigrations"
      className="StorageVersionMigrations"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.resource]: (item) => item.getResource(),
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Storage Version Migrations"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Resource", className: "resource", sortBy: columnId.resource, id: columnId.resource },
        { title: "Status", className: "status", id: columnId.status },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.getResource())}</WithTooltip>,
        <WithTooltip>{text(describeTrueConditions(item.status?.conditions, "Pending"))}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const StorageVersionMigrations = withInjectables<Dependencies>(NonInjectedStorageVersionMigrations, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(storageVersionMigrationStoreInjectable),
  }),
});
