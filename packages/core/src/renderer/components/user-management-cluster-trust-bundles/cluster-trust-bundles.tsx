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
import clusterTrustBundleStoreInjectable from "./store.injectable";

import type { ClusterTrustBundleStore } from "./store";

enum columnId {
  name = "name",
  signer = "signer",
  certificates = "certificates",
  age = "age",
}

interface Dependencies {
  store: ClusterTrustBundleStore;
}

const NonInjectedClusterTrustBundles = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="user_management_clustertrustbundles"
      className="ClusterTrustBundles"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.signer]: (item) => item.spec?.signerName,
        [columnId.certificates]: (item) => item.getCertificateCount(),
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Cluster Trust Bundles"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Signer", className: "signer", sortBy: columnId.signer, id: columnId.signer },
        { title: "Certificates", className: "certificates", sortBy: columnId.certificates, id: columnId.certificates },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.spec?.signerName)}</WithTooltip>,
        <WithTooltip>{text(item.getCertificateCount())}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const ClusterTrustBundles = withInjectables<Dependencies>(NonInjectedClusterTrustBundles, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(clusterTrustBundleStoreInjectable),
  }),
});
