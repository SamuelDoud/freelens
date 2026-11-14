/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";

import type { DeviceTaintRule } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const DeviceTaintRuleDetails = observer(({ object }: KubeObjectDetailsProps<DeviceTaintRule>) => (
  <div className="DeviceTaintRuleDetails">
    <ResourceDetailItem name="Taint" value={object.getTaint()} />
    <YamlDetails title="Device Selector" value={object.spec?.deviceSelector} />
  </div>
));
