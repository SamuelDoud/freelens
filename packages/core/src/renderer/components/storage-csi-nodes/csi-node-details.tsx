/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { YamlDetails } from "../resource-details/detail-items";

import type { CSINode } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const CSINodeDetails = observer(({ object }: KubeObjectDetailsProps<CSINode>) => (
  <div className="CSINodeDetails">
    <YamlDetails title="Drivers" value={object.getDrivers()} />
  </div>
));
