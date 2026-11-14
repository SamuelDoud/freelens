/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observableHistoryInjectionToken } from "@freelensapp/routing";
import { getInjectable } from "@ogre-tools/injectable";
import { runInAction } from "mobx";
import hostedClusterInjectable from "../../../renderer/cluster-frame-context/hosted-cluster.injectable";
import persistentSearchStoreInjectable from "../../../renderer/components/input/persistent-search-store.injectable";
import searchUrlPageParamInjectable from "../../../renderer/components/input/search-url-page-param.injectable";
import showDetailsInjectable from "../../../renderer/components/kube-detail-params/show-details.injectable";
import namespaceStoreInjectable from "../../../renderer/components/namespaces/store.injectable";
import apiKubeInjectable from "../../../renderer/k8s/api-kube.injectable";
import navigateInjectable from "../../../renderer/navigation/navigate.injectable";
import advancedSearchStateInjectable from "../../advanced-search/renderer/advanced-search-state.injectable";
import { AiToolExecutor } from "./tool-executor";

// The linked search of all views, as the search box keeps it when the persistent search is on.
const linkedSearchKey = "global:linked";

const aiToolExecutorInjectable = getInjectable({
  id: "ai-chat-tool-executor",
  instantiate: (di) => {
    const apiKube = di.inject(apiKubeInjectable);
    const hostedCluster = di.inject(hostedClusterInjectable);
    const observableHistory = di.inject(observableHistoryInjectionToken);
    const namespaceStore = di.inject(namespaceStoreInjectable);
    const searchUrlParam = di.inject(searchUrlPageParamInjectable);
    const persistentSearchStore = di.inject(persistentSearchStoreInjectable);
    const advancedSearchState = di.inject(advancedSearchStateInjectable);

    return new AiToolExecutor({
      knownResources: () => hostedCluster?.knownResources ?? [],
      kube: {
        get: (path, query) => apiKube.get(path, query ? { query } : undefined),
        patch: (path, patch, contentType) =>
          apiKube.patch(path, { data: patch as never }, { headers: { "content-type": contentType } }),
        del: (path) => apiKube.del(path),
      },
      navigate: di.inject(navigateInjectable),
      showDetails: di.inject(showDetailsInjectable),
      currentLocation: () => ({
        pathname: observableHistory.location.pathname,
        search: observableHistory.location.search,
      }),
      namespaces: {
        selected: () => [...namespaceStore.selectedNames],
        allSelected: () => namespaceStore.areAllSelectedImplicitly,
        select: (namespaces) => namespaceStore.selectNamespaces(namespaces),
      },
      quickSearch: {
        get: () => searchUrlParam.get(),
        set: (text) =>
          runInAction(() => {
            if (persistentSearchStore.isEnabled) {
              persistentSearchStore.setValue(linkedSearchKey, text);
            }

            if (text) {
              searchUrlParam.set(text);
            } else {
              searchUrlParam.clear();
            }
          }),
      },
      advancedSearch: {
        get: (viewKey) => advancedSearchState.getConditions(viewKey),
        set: (viewKey, conditions) =>
          runInAction(() => {
            advancedSearchState.setConditions(viewKey, conditions);
          }),
      },
      now: () => Date.now(),
    });
  },
});

export default aiToolExecutorInjectable;
