/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ConditionsDetails } from "../resource-details/conditions-details";
import { ResourceDetailItem } from "../resource-details/detail-items";
import { CertificateSigningRequestActions } from "./certificate-signing-request-actions";

import type { CertificateSigningRequest } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const CertificateSigningRequestDetails = observer(
  ({ object }: KubeObjectDetailsProps<CertificateSigningRequest>) => (
    <div className="CertificateSigningRequestDetails">
      <CertificateSigningRequestActions request={object} />
      <ResourceDetailItem name="Signer" value={object.spec?.signerName} />
      <ResourceDetailItem name="Requestor" value={object.spec?.username} />
      <ResourceDetailItem name="Groups" value={object.spec?.groups?.join(", ")} />
      <ResourceDetailItem name="Usages" value={object.spec?.usages?.join(", ")} />
      <ResourceDetailItem
        name="Requested Duration"
        value={object.spec?.expirationSeconds === undefined ? undefined : `${object.spec.expirationSeconds}s`}
      />
      <ResourceDetailItem name="Condition" value={object.getCondition()} />

      <ConditionsDetails conditions={object.status?.conditions} />
    </div>
  ),
);
