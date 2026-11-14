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
import resourceClaimStoreInjectable from "./store.injectable";

import type { ResourceClaimStore } from "./store";

enum columnId {
  name = "name",
  namespace = "namespace",
  requests = "requests",
  state = "state",
  age = "age",
}

interface Dependencies {
  store: ResourceClaimStore;
}

const NonInjectedResourceClaims = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="devices_resourceclaims"
      className="ResourceClaims"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.namespace]: (item) => item.getNs(),
        [columnId.requests]: (item) => item.getRequests().length,
        [columnId.state]: (item) => item.getState(),
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Resource Claims"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Namespace", className: "namespace", sortBy: columnId.namespace, id: columnId.namespace },
        { title: "Requests", className: "requests", sortBy: columnId.requests, id: columnId.requests },
        { title: "State", className: "state", sortBy: columnId.state, id: columnId.state },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <NamespaceSelectBadge key="namespace" namespace={item.getNs()} />,
        <WithTooltip>
          {text(
            item
              .getRequests()
              .map((request) => request.name)
              .join(", "),
          )}
        </WithTooltip>,
        <WithTooltip>{text(item.getState())}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const ResourceClaims = withInjectables<Dependencies>(NonInjectedResourceClaims, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(resourceClaimStoreInjectable),
  }),
});
