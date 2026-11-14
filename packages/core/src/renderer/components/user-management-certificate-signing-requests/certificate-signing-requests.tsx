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
import certificateSigningRequestStoreInjectable from "./store.injectable";

import type { CertificateSigningRequestStore } from "./store";

enum columnId {
  name = "name",
  signer = "signer",
  requestor = "requestor",
  condition = "condition",
  age = "age",
}

interface Dependencies {
  store: CertificateSigningRequestStore;
}

const NonInjectedCertificateSigningRequests = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="user_management_certificatesigningrequests"
      className="CertificateSigningRequests"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.signer]: (item) => item.spec?.signerName,
        [columnId.requestor]: (item) => item.spec?.username,
        [columnId.condition]: (item) => item.getCondition(),
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Certificate Signing Requests"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Signer", className: "signer", sortBy: columnId.signer, id: columnId.signer },
        { title: "Requestor", className: "requestor", sortBy: columnId.requestor, id: columnId.requestor },
        { title: "Condition", className: "condition", sortBy: columnId.condition, id: columnId.condition },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.spec?.signerName)}</WithTooltip>,
        <WithTooltip>{text(item.spec?.username)}</WithTooltip>,
        <WithTooltip>{text(item.getCondition())}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const CertificateSigningRequests = withInjectables<Dependencies>(NonInjectedCertificateSigningRequests, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(certificateSigningRequestStoreInjectable),
  }),
});
