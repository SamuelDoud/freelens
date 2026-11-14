/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ConditionsDetails } from "../resource-details/conditions-details";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";

import type { PriorityLevelConfiguration } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const PriorityLevelConfigurationDetails = observer(
  ({ object }: KubeObjectDetailsProps<PriorityLevelConfiguration>) => (
    <div className="PriorityLevelConfigurationDetails">
      <ResourceDetailItem name="Type" value={object.spec?.type} />
      <ResourceDetailItem
        name="Nominal Concurrency Shares"
        value={object.spec?.limited?.nominalConcurrencyShares ?? object.spec?.exempt?.nominalConcurrencyShares}
      />
      <ResourceDetailItem
        name="Lendable Percent"
        value={object.spec?.limited?.lendablePercent ?? object.spec?.exempt?.lendablePercent}
      />
      <ResourceDetailItem name="Limit Response" value={object.spec?.limited?.limitResponse?.type} />
      <YamlDetails title="Queuing" value={object.spec?.limited?.limitResponse?.queuing} />
      <ConditionsDetails conditions={object.status?.conditions} />
    </div>
  ),
);
