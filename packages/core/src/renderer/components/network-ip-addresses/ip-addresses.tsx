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
import ipAddressStoreInjectable from "./store.injectable";

import type { IPAddressStore } from "./store";

enum columnId {
  name = "name",
  parent = "parent",
  age = "age",
}

interface Dependencies {
  store: IPAddressStore;
}

const NonInjectedIPAddresses = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="network_ipaddresses"
      className="IPAddresses"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.parent]: (item) => item.getParent(),
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="IP Addresses"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Parent", className: "parent", sortBy: columnId.parent, id: columnId.parent },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.getParent())}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const IPAddresses = withInjectables<Dependencies>(NonInjectedIPAddresses, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(ipAddressStoreInjectable),
  }),
});
