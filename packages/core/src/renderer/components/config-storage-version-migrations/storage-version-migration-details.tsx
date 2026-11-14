/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ConditionsDetails } from "../resource-details/conditions-details";
import { ResourceDetailItem } from "../resource-details/detail-items";

import type { StorageVersionMigration } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const StorageVersionMigrationDetails = observer(
  ({ object }: KubeObjectDetailsProps<StorageVersionMigration>) => (
    <div className="StorageVersionMigrationDetails">
      <ResourceDetailItem name="Resource" value={object.getResource()} />
      <ResourceDetailItem name="Resource Version" value={object.status?.resourceVersion} />

      <ConditionsDetails conditions={object.status?.conditions} />
    </div>
  ),
);
