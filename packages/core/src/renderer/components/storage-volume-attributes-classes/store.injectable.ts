/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  storesAndApisCanBeCreatedInjectionToken,
  volumeAttributesClassApiInjectable,
} from "@freelensapp/kube-api-specifics";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForClusterScopedResourcesInjectable from "../../cluster-frame-context/for-cluster-scoped-resources.injectable";
import { VolumeAttributesClassStore } from "./store";

const volumeAttributesClassStoreInjectable = getInjectable({
  id: "volume-attributes-class-store",
  instantiate: (di) => {
    if (!di.inject(storesAndApisCanBeCreatedInjectionToken)) {
      throw new Error("volumeAttributesClassStore is only available in certain environments");
    }

    return new VolumeAttributesClassStore(
      {
        context: di.inject(clusterFrameContextForClusterScopedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      di.inject(volumeAttributesClassApiInjectable),
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default volumeAttributesClassStoreInjectable;
