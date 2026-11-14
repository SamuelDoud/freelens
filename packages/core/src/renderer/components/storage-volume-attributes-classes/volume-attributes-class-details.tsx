/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";

import type { VolumeAttributesClass } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const VolumeAttributesClassDetails = observer(({ object }: KubeObjectDetailsProps<VolumeAttributesClass>) => (
  <div className="VolumeAttributesClassDetails">
    <ResourceDetailItem name="Driver" value={object.driverName} />
    <YamlDetails title="Parameters" value={object.parameters} />
  </div>
));
