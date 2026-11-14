/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";

import type { CSIStorageCapacity } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const CSIStorageCapacityDetails = observer(({ object }: KubeObjectDetailsProps<CSIStorageCapacity>) => (
  <div className="CSIStorageCapacityDetails">
    <ResourceDetailItem name="Storage Class" value={object.storageClassName} />
    <ResourceDetailItem name="Capacity" value={object.capacity} />
    <ResourceDetailItem name="Maximum Volume Size" value={object.maximumVolumeSize} />
    <YamlDetails title="Node Topology" value={object.nodeTopology} />
  </div>
));
