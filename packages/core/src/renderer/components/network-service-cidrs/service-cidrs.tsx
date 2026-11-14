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
import serviceCidrStoreInjectable from "./store.injectable";

import type { ServiceCIDRStore } from "./store";

enum columnId {
  name = "name",
  cidrs = "cidrs",
  ready = "ready",
  age = "age",
}

interface Dependencies {
  store: ServiceCIDRStore;
}

const NonInjectedServiceCIDRs = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="network_servicecidrs"
      className="ServiceCIDRs"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.cidrs]: (item) => item.spec?.cidrs?.join(","),
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Service CIDRs"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "CIDRs", className: "cidrs", sortBy: columnId.cidrs, id: columnId.cidrs },
        { title: "Ready", className: "ready", id: columnId.ready },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.spec?.cidrs?.join(", "))}</WithTooltip>,
        <WithTooltip>{text(describeTrueConditions(item.status?.conditions, "No"))}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const ServiceCIDRs = withInjectables<Dependencies>(NonInjectedServiceCIDRs, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(serviceCidrStoreInjectable),
  }),
});
