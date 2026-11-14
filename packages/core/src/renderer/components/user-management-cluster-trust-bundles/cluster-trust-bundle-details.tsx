/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem } from "../resource-details/detail-items";

import type { ClusterTrustBundle } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const ClusterTrustBundleDetails = observer(({ object }: KubeObjectDetailsProps<ClusterTrustBundle>) => (
  <div className="ClusterTrustBundleDetails">
    <ResourceDetailItem name="Signer" value={object.spec?.signerName} />
    <ResourceDetailItem name="Certificates" value={object.getCertificateCount()} />
  </div>
));
