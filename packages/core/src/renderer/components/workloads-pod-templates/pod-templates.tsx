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
import podTemplateStoreInjectable from "./store.injectable";

import type { PodTemplateStore } from "./store";

enum columnId {
  name = "name",
  namespace = "namespace",
  containers = "containers",
  images = "images",
  age = "age",
}

interface Dependencies {
  store: PodTemplateStore;
}

const NonInjectedPodTemplates = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="workloads_podtemplates"
      className="PodTemplates"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.namespace]: (item) => item.getNs(),
        [columnId.containers]: (item) => item.getContainers().length,
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Pod Templates"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Namespace", className: "namespace", sortBy: columnId.namespace, id: columnId.namespace },
        { title: "Containers", className: "containers", sortBy: columnId.containers, id: columnId.containers },
        { title: "Images", className: "images", id: columnId.images },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <NamespaceSelectBadge key="namespace" namespace={item.getNs()} />,
        <WithTooltip>
          {text(
            item
              .getContainers()
              .map((container) => container.name)
              .join(", "),
          )}
        </WithTooltip>,
        <WithTooltip>
          {text(
            item
              .getContainers()
              .map((container) => container.image)
              .join(", "),
          )}
        </WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const PodTemplates = withInjectables<Dependencies>(NonInjectedPodTemplates, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(podTemplateStoreInjectable),
  }),
});
