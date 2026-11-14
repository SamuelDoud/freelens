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
import { describeTrueConditions } from "../resource-details/conditions-details";
import { text } from "../resource-details/format";
import { WithTooltip } from "../with-tooltip";
import podCertificateRequestStoreInjectable from "./store.injectable";

import type { PodCertificateRequestStore } from "./store";

enum columnId {
  name = "name",
  namespace = "namespace",
  signer = "signer",
  pod = "pod",
  node = "node",
  status = "status",
  age = "age",
}

interface Dependencies {
  store: PodCertificateRequestStore;
}

const NonInjectedPodCertificateRequests = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="user_management_podcertificaterequests"
      className="PodCertificateRequests"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.namespace]: (item) => item.getNs(),
        [columnId.signer]: (item) => item.spec?.signerName,
        [columnId.pod]: (item) => item.spec?.podName,
        [columnId.node]: (item) => item.spec?.nodeName,
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Pod Certificate Requests"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Namespace", className: "namespace", sortBy: columnId.namespace, id: columnId.namespace },
        { title: "Signer", className: "signer", sortBy: columnId.signer, id: columnId.signer },
        { title: "Pod", className: "pod", sortBy: columnId.pod, id: columnId.pod },
        { title: "Node", className: "node", sortBy: columnId.node, id: columnId.node },
        { title: "Status", className: "status", id: columnId.status },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <NamespaceSelectBadge key="namespace" namespace={item.getNs()} />,
        <WithTooltip>{text(item.spec?.signerName)}</WithTooltip>,
        <WithTooltip>{text(item.spec?.podName)}</WithTooltip>,
        <WithTooltip>{text(item.spec?.nodeName)}</WithTooltip>,
        <WithTooltip>{text(describeTrueConditions(item.status?.conditions, "Pending"))}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const PodCertificateRequests = withInjectables<Dependencies>(NonInjectedPodCertificateRequests, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(podCertificateRequestStoreInjectable),
  }),
});
