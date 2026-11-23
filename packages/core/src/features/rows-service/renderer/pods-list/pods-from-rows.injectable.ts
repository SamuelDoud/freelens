/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import rowsServiceEnabledInjectable from "../../common/rows-service-enabled.injectable";
import podRowStoreInjectable from "./pod-row-store.injectable";

/**
 * Whether this cluster frame takes its pods from the rows service: the option is
 * on and the service can serve the cluster. The Pods list and the Workloads
 * overview both ask this, and use the pod store of full objects otherwise.
 */
const podsFromRowsInjectable = getInjectable({
  id: "pods-from-rows",
  instantiate: (di) => {
    const enabled = di.inject(rowsServiceEnabledInjectable);
    const rowStore = di.inject(podRowStoreInjectable);

    return computed(() => enabled.get() && !rowStore.unavailable);
  },
});

export default podsFromRowsInjectable;
