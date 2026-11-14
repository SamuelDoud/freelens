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
import controllerRevisionStoreInjectable from "./store.injectable";

import type { ControllerRevisionStore } from "./store";

enum columnId {
  name = "name",
  namespace = "namespace",
  revision = "revision",
  controller = "controller",
  age = "age",
}

interface Dependencies {
  store: ControllerRevisionStore;
}

const NonInjectedControllerRevisions = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="workloads_controllerrevisions"
      className="ControllerRevisions"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.namespace]: (item) => item.getNs(),
        [columnId.revision]: (item) => item.revision,
        [columnId.controller]: (item) => item.getController(),
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Controller Revisions"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Namespace", className: "namespace", sortBy: columnId.namespace, id: columnId.namespace },
        { title: "Revision", className: "revision", sortBy: columnId.revision, id: columnId.revision },
        { title: "Controller", className: "controller", sortBy: columnId.controller, id: columnId.controller },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <NamespaceSelectBadge key="namespace" namespace={item.getNs()} />,
        <WithTooltip>{text(item.revision)}</WithTooltip>,
        <WithTooltip>{text(item.getController())}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const ControllerRevisions = withInjectables<Dependencies>(NonInjectedControllerRevisions, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(controllerRevisionStoreInjectable),
  }),
});
