/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ConditionsDetails } from "../resource-details/conditions-details";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";

import type { FlowSchema } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const FlowSchemaDetails = observer(({ object }: KubeObjectDetailsProps<FlowSchema>) => (
  <div className="FlowSchemaDetails">
    <ResourceDetailItem name="Priority Level" value={object.spec?.priorityLevelConfiguration?.name} />
    <ResourceDetailItem name="Matching Precedence" value={object.spec?.matchingPrecedence} />
    <ResourceDetailItem name="Distinguisher Method" value={object.spec?.distinguisherMethod?.type} />
    <YamlDetails title="Rules" value={object.spec?.rules} />
    <ConditionsDetails conditions={object.status?.conditions} />
  </div>
));
