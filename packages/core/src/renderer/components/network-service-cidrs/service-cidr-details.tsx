/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ConditionsDetails } from "../resource-details/conditions-details";
import { ResourceDetailItem } from "../resource-details/detail-items";

import type { ServiceCIDR } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const ServiceCIDRDetails = observer(({ object }: KubeObjectDetailsProps<ServiceCIDR>) => (
  <div className="ServiceCIDRDetails">
    <ResourceDetailItem name="CIDRs" value={object.spec?.cidrs?.join(", ")} />

    <ConditionsDetails conditions={object.status?.conditions} />
  </div>
));
