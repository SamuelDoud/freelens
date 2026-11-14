/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";

import type { ResourceSlice } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const ResourceSliceDetails = observer(({ object }: KubeObjectDetailsProps<ResourceSlice>) => (
  <div className="ResourceSliceDetails">
    <ResourceDetailItem name="Driver" value={object.spec?.driver} />
    <ResourceDetailItem
      name="Node"
      value={object.spec?.nodeName ?? (object.spec?.allNodes ? "All nodes" : undefined)}
    />
    <ResourceDetailItem name="Pool" value={object.spec?.pool?.name} />
    <ResourceDetailItem name="Pool Generation" value={object.spec?.pool?.generation} />
    <YamlDetails title="Devices" value={object.getDevices()} />
  </div>
));
