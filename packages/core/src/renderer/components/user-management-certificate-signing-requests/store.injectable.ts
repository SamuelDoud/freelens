/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  certificateSigningRequestApiInjectable,
  storesAndApisCanBeCreatedInjectionToken,
} from "@freelensapp/kube-api-specifics";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForClusterScopedResourcesInjectable from "../../cluster-frame-context/for-cluster-scoped-resources.injectable";
import { CertificateSigningRequestStore } from "./store";

const certificateSigningRequestStoreInjectable = getInjectable({
  id: "certificate-signing-request-store",
  instantiate: (di) => {
    if (!di.inject(storesAndApisCanBeCreatedInjectionToken)) {
      throw new Error("certificateSigningRequestStore is only available in certain environments");
    }

    return new CertificateSigningRequestStore(
      {
        context: di.inject(clusterFrameContextForClusterScopedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      di.inject(certificateSigningRequestApiInjectable),
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default certificateSigningRequestStoreInjectable;
