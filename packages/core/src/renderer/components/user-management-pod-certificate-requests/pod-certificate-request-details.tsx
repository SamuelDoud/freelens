/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ConditionsDetails } from "../resource-details/conditions-details";
import { ResourceDetailItem } from "../resource-details/detail-items";

import type { PodCertificateRequest } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const PodCertificateRequestDetails = observer(({ object }: KubeObjectDetailsProps<PodCertificateRequest>) => (
  <div className="PodCertificateRequestDetails">
    <ResourceDetailItem name="Signer" value={object.spec?.signerName} />
    <ResourceDetailItem name="Pod" value={object.spec?.podName} />
    <ResourceDetailItem name="Service Account" value={object.spec?.serviceAccountName} />
    <ResourceDetailItem name="Node" value={object.spec?.nodeName} />
    <ResourceDetailItem name="Not Before" value={object.status?.notBefore} />
    <ResourceDetailItem name="Not After" value={object.status?.notAfter} />
    <ResourceDetailItem name="Refresh From" value={object.status?.beginRefreshAt} />

    <ConditionsDetails conditions={object.status?.conditions} />
  </div>
));
