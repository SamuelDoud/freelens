/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import assert from "node:assert";
import { prefixedLoggerInjectable } from "@freelensapp/logger";
import { iter } from "@freelensapp/utilities";
import { getInjectable } from "@ogre-tools/injectable";
import { when } from "mobx";
import { asyncComputed } from "../../../common/utils/async-computed";
import requestListHelmReleasesInjectable from "../../../features/helm-releases/renderer/request-list-helm-releases.injectable";
import clusterFrameContextForNamespacedResourcesInjectable from "../../cluster-frame-context/for-namespaced-resources.injectable";
import hostedClusterIdInjectable from "../../cluster-frame-context/hosted-cluster-id.injectable";
import secretStoreInjectable from "../config-secrets/store.injectable";
import { createReleaseSummaryCache, listReleasesFromSecrets } from "./list-releases-from-secrets";
import releaseSecretsInjectable from "./release-secrets.injectable";
import { toHelmRelease } from "./to-helm-release";

/** How long the first list waits for the secret store to load before it asks helm. */
const waitForSecretsMs = 3000;

const releasesInjectable = getInjectable({
  id: "releases",

  instantiate: (di) => {
    const clusterContext = di.inject(clusterFrameContextForNamespacedResourcesInjectable);
    const hostedClusterId = di.inject(hostedClusterIdInjectable);
    const releaseSecrets = di.inject(releaseSecretsInjectable);
    const secretStore = di.inject(secretStoreInjectable);
    const summaryCache = createReleaseSummaryCache();
    const requestListHelmReleases = di.inject(requestListHelmReleasesInjectable);
    const logger = di.inject(prefixedLoggerInjectable, "HELM-RELEASES");

    assert(hostedClusterId, "hostedClusterId is required");

    return asyncComputed({
      getValueFromObservedPromise: async () => {
        // Read before anything is awaited, so that a store that finishes loading runs this again.
        void releaseSecrets.get();

        if (!secretStore.isLoaded && !secretStore.failedLoading) {
          // The release Secrets are on their way: list from them instead of asking helm. A store that does not load
          // in time (or at all) leaves the list to helm.
          await when(() => secretStore.isLoaded || secretStore.failedLoading, { timeout: waitForSecretsMs }).catch(
            () => undefined,
          );
        }

        if (secretStore.isLoaded && !secretStore.failedLoading) {
          // The Secrets the store watches already hold every release, so listing from them transfers nothing.
          // Without release Secrets (another storage driver, no access to Secrets) helm is asked, as before.
          const listed = await listReleasesFromSecrets(releaseSecrets.get(), summaryCache).catch(() => undefined);

          if (listed) {
            return listed.map(toHelmRelease);
          }
        }

        const releaseResults = await (clusterContext.hasSelectedAll
          ? requestListHelmReleases({ clusterId: hostedClusterId })
          : Promise.all(
              clusterContext.contextNamespaces.map((namespace) =>
                requestListHelmReleases({ clusterId: hostedClusterId, namespace }),
              ),
            ));

        return iter
          .chain([releaseResults].flat().values())
          .filterMap((result) => {
            if (result.callWasSuccessful) {
              return result.response;
            }

            logger.warn("Failed to list helm releases", { error: result.error });

            return undefined;
          })
          .flatMap((releases) => releases)
          .map(toHelmRelease)
          .toArray();
      },
      valueWhenPending: [],
    });
  },
});

export default releasesInjectable;
