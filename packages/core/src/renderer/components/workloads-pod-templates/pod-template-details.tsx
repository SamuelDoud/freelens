/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";

import type { PodTemplate } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const PodTemplateDetails = observer(({ object }: KubeObjectDetailsProps<PodTemplate>) => (
  <div className="PodTemplateDetails">
    <ResourceDetailItem
      name="Containers"
      value={object
        .getContainers()
        .map((container) => `${container.name}: ${container.image ?? ""}`)
        .join("\n")}
    />
    <YamlDetails title="Template" value={object.template?.spec} />
  </div>
));
