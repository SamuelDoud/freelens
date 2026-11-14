/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";

import type { ResourceClaim } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const ResourceClaimDetails = observer(({ object }: KubeObjectDetailsProps<ResourceClaim>) => (
  <div className="ResourceClaimDetails">
    <ResourceDetailItem name="State" value={object.getState()} />
    <ResourceDetailItem
      name="Reserved For"
      value={object.status?.reservedFor?.map((consumer) => `${consumer.resource}/${consumer.name}`).join(", ")}
    />
    <YamlDetails title="Requests" value={object.getRequests()} />
    <YamlDetails title="Allocation" value={object.status?.allocation?.devices?.results} />
  </div>
));
