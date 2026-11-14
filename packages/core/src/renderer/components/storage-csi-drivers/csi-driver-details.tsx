/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";
import { yesNo } from "../resource-details/format";

import type { CSIDriver } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const CSIDriverDetails = observer(({ object }: KubeObjectDetailsProps<CSIDriver>) => (
  <div className="CSIDriverDetails">
    <ResourceDetailItem name="Attach Required" value={yesNo(object.spec?.attachRequired)} />
    <ResourceDetailItem name="Pod Info On Mount" value={yesNo(object.spec?.podInfoOnMount)} />
    <ResourceDetailItem name="Storage Capacity" value={yesNo(object.spec?.storageCapacity)} />
    <ResourceDetailItem name="FS Group Policy" value={object.spec?.fsGroupPolicy} />
    <ResourceDetailItem name="Volume Lifecycle Modes" value={object.spec?.volumeLifecycleModes?.join(", ")} />
    <ResourceDetailItem name="Requires Republish" value={yesNo(object.spec?.requiresRepublish)} />
    <ResourceDetailItem name="SELinux Mount" value={yesNo(object.spec?.seLinuxMount)} />
    <YamlDetails title="Token Requests" value={object.spec?.tokenRequests} />
  </div>
));
