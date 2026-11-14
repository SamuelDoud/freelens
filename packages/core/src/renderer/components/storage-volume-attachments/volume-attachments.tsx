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
import volumeAttachmentStoreInjectable from "./store.injectable";

import type { VolumeAttachmentStore } from "./store";

enum columnId {
  name = "name",
  attacher = "attacher",
  pv = "pv",
  node = "node",
  attached = "attached",
  age = "age",
}

interface Dependencies {
  store: VolumeAttachmentStore;
}

const NonInjectedVolumeAttachments = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="storage_volumeattachments"
      className="VolumeAttachments"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.attacher]: (item) => item.spec?.attacher,
        [columnId.pv]: (item) => item.spec?.source?.persistentVolumeName,
        [columnId.node]: (item) => item.spec?.nodeName,
        [columnId.attached]: (item) => String(item.status?.attached ?? false),
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Volume Attachments"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Attacher", className: "attacher", sortBy: columnId.attacher, id: columnId.attacher },
        { title: "Persistent Volume", className: "pv", sortBy: columnId.pv, id: columnId.pv },
        { title: "Node", className: "node", sortBy: columnId.node, id: columnId.node },
        { title: "Attached", className: "attached", sortBy: columnId.attached, id: columnId.attached },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.spec?.attacher)}</WithTooltip>,
        <WithTooltip>{text(item.spec?.source?.persistentVolumeName)}</WithTooltip>,
        <WithTooltip>{text(item.spec?.nodeName)}</WithTooltip>,
        <WithTooltip>{text(item.status?.attached ? "Yes" : "No")}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const VolumeAttachments = withInjectables<Dependencies>(NonInjectedVolumeAttachments, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(volumeAttachmentStoreInjectable),
  }),
});
