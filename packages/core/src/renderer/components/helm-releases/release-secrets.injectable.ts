/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { compareShallow, computed, onBecomeObserved, onBecomeUnobserved } from "mobx";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import secretStoreInjectable from "../config-secrets/store.injectable";

const releaseSecretsInjectable = getInjectable({
  id: "release-secrets",

  instantiate: (di) => {
    const subscribeStores = di.inject(subscribeStoresInjectable);
    const secretStore = di.inject(secretStoreInjectable);

    // Equal while the same Secrets are listed, so that changes of other Secrets do not list releases again.
    const releaseSecrets = computed(
      () =>
        secretStore.contextItems.filter(
          (secret) => secret.type.startsWith("helm.sh/release") || secret.metadata.labels?.owner === "helm",
        ),
      { equals: compareShallow },
    );

    let unsubscribe: () => void;

    onBecomeObserved(releaseSecrets, () => {
      unsubscribe = subscribeStores([secretStore]);
    });

    onBecomeUnobserved(releaseSecrets, () => {
      unsubscribe?.();
    });

    return releaseSecrets;
  },
});

export default releaseSecretsInjectable;
