/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { SecretDetails } from "../../../config-secrets";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const secretsDetailItemInjectable = getInjectable({
  id: "secrets-detail-item",

  instantiate: () => ({
    Component: SecretDetails,
    isFor: isSecret,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

const isSecret = kubeObjectMatchesToKindAndApiVersion("Secret", ["v1"]);

export default secretsDetailItemInjectable;
