/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  podCertificateRequestApiInjectable,
  storesAndApisCanBeCreatedInjectionToken,
} from "@freelensapp/kube-api-specifics";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForNamespacedResourcesInjectable from "../../cluster-frame-context/for-namespaced-resources.injectable";
import { PodCertificateRequestStore } from "./store";

const podCertificateRequestStoreInjectable = getInjectable({
  id: "pod-certificate-request-store",
  instantiate: (di) => {
    if (!di.inject(storesAndApisCanBeCreatedInjectionToken)) {
      throw new Error("podCertificateRequestStore is only available in certain environments");
    }

    return new PodCertificateRequestStore(
      {
        context: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      di.inject(podCertificateRequestApiInjectable),
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default podCertificateRequestStoreInjectable;
