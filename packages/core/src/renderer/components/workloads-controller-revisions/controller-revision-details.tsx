/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";

import type { ControllerRevision } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const ControllerRevisionDetails = observer(({ object }: KubeObjectDetailsProps<ControllerRevision>) => (
  <div className="ControllerRevisionDetails">
    <ResourceDetailItem name="Revision" value={object.revision} />
    <ResourceDetailItem name="Controller" value={object.getController()} />
    <YamlDetails title="Data" value={object.data} />
  </div>
));
