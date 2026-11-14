/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { YamlDetails } from "../resource-details/detail-items";

import type { ResourceClaimTemplate } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const ResourceClaimTemplateDetails = observer(({ object }: KubeObjectDetailsProps<ResourceClaimTemplate>) => (
  <div className="ResourceClaimTemplateDetails">
    <YamlDetails title="Claim" value={object.spec?.spec} />
  </div>
));
