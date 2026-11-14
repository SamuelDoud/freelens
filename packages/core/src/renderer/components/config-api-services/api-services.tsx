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
import apiServiceStoreInjectable from "./store.injectable";

import type { APIServiceStore } from "./store";

enum columnId {
  name = "name",
  service = "service",
  available = "available",
  age = "age",
}

interface Dependencies {
  store: APIServiceStore;
}

const NonInjectedAPIServices = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="config_apiservices"
      className="APIServices"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.service]: (item) => item.getServiceName(),
        [columnId.available]: (item) => item.getAvailability(),
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="API Services"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Service", className: "service", sortBy: columnId.service, id: columnId.service },
        { title: "Available", className: "available", sortBy: columnId.available, id: columnId.available },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.getServiceName())}</WithTooltip>,
        <WithTooltip>{text(item.getAvailability())}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const APIServices = withInjectables<Dependencies>(NonInjectedAPIServices, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(apiServiceStoreInjectable),
  }),
});
