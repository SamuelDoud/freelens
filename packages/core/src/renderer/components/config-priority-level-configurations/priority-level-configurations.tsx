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
import priorityLevelConfigurationStoreInjectable from "./store.injectable";

import type { PriorityLevelConfigurationStore } from "./store";

enum columnId {
  name = "name",
  type = "type",
  shares = "shares",
  queues = "queues",
  age = "age",
}

interface Dependencies {
  store: PriorityLevelConfigurationStore;
}

const NonInjectedPriorityLevelConfigurations = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="config_prioritylevelconfigurations"
      className="PriorityLevelConfigurations"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.type]: (item) => item.spec?.type,
        [columnId.shares]: (item) =>
          item.spec?.limited?.nominalConcurrencyShares ?? item.spec?.exempt?.nominalConcurrencyShares,
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Priority Levels"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Type", className: "type", sortBy: columnId.type, id: columnId.type },
        { title: "Nominal Shares", className: "shares", sortBy: columnId.shares, id: columnId.shares },
        { title: "Queues", className: "queues", id: columnId.queues },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.spec?.type)}</WithTooltip>,
        <WithTooltip>
          {text(item.spec?.limited?.nominalConcurrencyShares ?? item.spec?.exempt?.nominalConcurrencyShares)}
        </WithTooltip>,
        <WithTooltip>{text(item.spec?.limited?.limitResponse?.queuing?.queues)}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const PriorityLevelConfigurations = withInjectables<Dependencies>(NonInjectedPriorityLevelConfigurations, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(priorityLevelConfigurationStoreInjectable),
  }),
});
