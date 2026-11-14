/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";

import type { DeviceClass } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const DeviceClassDetails = observer(({ object }: KubeObjectDetailsProps<DeviceClass>) => (
  <div className="DeviceClassDetails">
    <ResourceDetailItem
      name="Selectors"
      value={object.spec?.selectors
        ?.map((selector) => selector.cel?.expression)
        .filter(Boolean)
        .join("\n")}
    />
    <ResourceDetailItem name="Extended Resource" value={object.spec?.extendedResourceName} />
    <YamlDetails title="Config" value={object.spec?.config} />
  </div>
));
