/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ConditionsDetails } from "../resource-details/conditions-details";
import { ResourceDetailItem } from "../resource-details/detail-items";

import type { APIService } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const APIServiceDetails = observer(({ object }: KubeObjectDetailsProps<APIService>) => (
  <div className="APIServiceDetails">
    <ResourceDetailItem name="Group" value={object.spec?.group} />
    <ResourceDetailItem name="Version" value={object.spec?.version} />
    <ResourceDetailItem name="Service" value={object.getServiceName()} />
    <ResourceDetailItem name="Group Priority Minimum" value={object.spec?.groupPriorityMinimum} />
    <ResourceDetailItem name="Version Priority" value={object.spec?.versionPriority} />
    <ResourceDetailItem
      name="Insecure Skip TLS Verify"
      value={object.spec?.insecureSkipTLSVerify ? "Yes" : undefined}
    />

    <ConditionsDetails conditions={object.status?.conditions} />
  </div>
));
