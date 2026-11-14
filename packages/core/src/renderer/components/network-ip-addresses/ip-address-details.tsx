/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem } from "../resource-details/detail-items";

import type { IPAddress } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const IPAddressDetails = observer(({ object }: KubeObjectDetailsProps<IPAddress>) => (
  <div className="IPAddressDetails">
    <ResourceDetailItem name="Parent" value={object.getParent()} />
  </div>
));
