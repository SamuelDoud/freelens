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
import flowSchemaStoreInjectable from "./store.injectable";

import type { FlowSchemaStore } from "./store";

enum columnId {
  name = "name",
  priorityLevel = "priorityLevel",
  precedence = "precedence",
  distinguisher = "distinguisher",
  age = "age",
}

interface Dependencies {
  store: FlowSchemaStore;
}

const NonInjectedFlowSchemas = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="config_flowschemas"
      className="FlowSchemas"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.priorityLevel]: (item) => item.spec?.priorityLevelConfiguration?.name,
        [columnId.precedence]: (item) => item.spec?.matchingPrecedence,
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Flow Schemas"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        {
          title: "Priority Level",
          className: "priorityLevel",
          sortBy: columnId.priorityLevel,
          id: columnId.priorityLevel,
        },
        { title: "Matching Precedence", className: "precedence", sortBy: columnId.precedence, id: columnId.precedence },
        { title: "Distinguisher", className: "distinguisher", id: columnId.distinguisher },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.spec?.priorityLevelConfiguration?.name)}</WithTooltip>,
        <WithTooltip>{text(item.spec?.matchingPrecedence)}</WithTooltip>,
        <WithTooltip>{text(item.spec?.distinguisherMethod?.type)}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const FlowSchemas = withInjectables<Dependencies>(NonInjectedFlowSchemas, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(flowSchemaStoreInjectable),
  }),
});
