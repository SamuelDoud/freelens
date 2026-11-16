/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { computed, observable, runInAction, when } from "mobx";
import { describe, expect, it, vi } from "vitest";
import requestListHelmReleasesInjectable from "../../../../features/helm-releases/renderer/request-list-helm-releases.injectable";
import clusterFrameContextForNamespacedResourcesInjectable from "../../../cluster-frame-context/for-namespaced-resources.injectable";
import hostedClusterIdInjectable from "../../../cluster-frame-context/hosted-cluster-id.injectable";
import { getDiForUnitTesting } from "../../../getDiForUnitTesting";
import secretStoreInjectable from "../../config-secrets/store.injectable";
import releaseSecretsInjectable from "../release-secrets.injectable";
import releasesInjectable from "../releases.injectable";
import { syntheticCases } from "./synthetic-release-secrets";

import type { ListedHelmRelease } from "../../../../features/helm-releases/common/channels";

const helmLsRow: ListedHelmRelease = {
  name: "from-helm",
  namespace: "n",
  revision: "1",
  updated: "-",
  status: "deployed",
  chart: "c-1",
  app_version: "1",
};

const setup = (secrets: unknown[], store: { isLoaded: boolean; isLoading: boolean; failedLoading: boolean }) => {
  const di = getDiForUnitTesting();
  const storeState = observable({ ...store });
  const secretList = observable.box(secrets);
  const requestListHelmReleases = vi.fn(async () => ({ callWasSuccessful: true as const, response: [helmLsRow] }));

  di.override(hostedClusterIdInjectable, () => "some-cluster");
  di.override(
    clusterFrameContextForNamespacedResourcesInjectable,
    () => ({ hasSelectedAll: true, contextNamespaces: [] }) as never,
  );
  di.override(secretStoreInjectable, () => storeState as never);
  di.override(releaseSecretsInjectable, () => computed(() => secretList.get()) as never);
  di.override(requestListHelmReleasesInjectable, () => requestListHelmReleases as never);

  const releases = di.inject(releasesInjectable);
  const names = async () => {
    await when(() => !releases.pending.get());

    return releases.value.get().map((release) => release.getName());
  };

  return { names, requestListHelmReleases, storeState, secretList };
};

describe("releases", () => {
  it("lists from the release Secrets of a loaded store without asking helm", async () => {
    const { names, requestListHelmReleases } = setup(syntheticCases(), {
      isLoaded: true,
      isLoading: false,
      failedLoading: false,
    });

    expect(await names()).toContain("multi");
    expect(requestListHelmReleases).not.toHaveBeenCalled();
  });

  it("asks helm when the store holds no release Secrets, as with the ConfigMap or SQL storage", async () => {
    const { names, requestListHelmReleases } = setup([], { isLoaded: true, isLoading: false, failedLoading: false });

    expect(await names()).toEqual(["from-helm"]);
    expect(requestListHelmReleases).toHaveBeenCalledTimes(1);
  });

  it("asks helm when the Secrets could not be read", async () => {
    const { names, requestListHelmReleases } = setup([], { isLoaded: false, isLoading: false, failedLoading: true });

    expect(await names()).toEqual(["from-helm"]);
    expect(requestListHelmReleases).toHaveBeenCalledTimes(1);
  });

  it("waits for a store that is loading, then lists from its Secrets", async () => {
    const { names, requestListHelmReleases, storeState } = setup(syntheticCases(), {
      isLoaded: false,
      isLoading: true,
      failedLoading: false,
    });
    const listed = names();

    runInAction(() => {
      storeState.isLoaded = true;
      storeState.isLoading = false;
    });

    expect(await listed).toContain("multi");
    expect(requestListHelmReleases).not.toHaveBeenCalled();
  });

  it("waits for a store that has not started to load, so that a normal start never asks helm", async () => {
    const { names, requestListHelmReleases, storeState } = setup(syntheticCases(), {
      isLoaded: false,
      isLoading: false,
      failedLoading: false,
    });
    const listed = names();

    await Promise.resolve();
    runInAction(() => {
      storeState.isLoading = true;
    });
    runInAction(() => {
      storeState.isLoaded = true;
      storeState.isLoading = false;
    });

    expect(await listed).toContain("multi");
    expect(requestListHelmReleases).not.toHaveBeenCalled();
  });

  it("asks helm when the store does not load in time", async () => {
    vi.useFakeTimers();

    try {
      const { names, requestListHelmReleases } = setup([], { isLoaded: false, isLoading: false, failedLoading: false });
      const listed = names();

      await vi.advanceTimersByTimeAsync(3000);

      expect(await listed).toEqual(["from-helm"]);
      expect(requestListHelmReleases).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
