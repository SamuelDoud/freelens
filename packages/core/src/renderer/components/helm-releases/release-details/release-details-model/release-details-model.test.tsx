/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observable } from "mobx";
import { describe, expect, it, vi } from "vitest";
import { toHelmRelease } from "../../to-helm-release";
import { ReleaseDetailsModel } from "./release-details-model.injectable";

import type { ListedHelmRelease } from "../../../../../features/helm-releases/common/channels";

const listed = (revision: string) =>
  ({
    name: "r",
    namespace: "ns",
    revision,
    status: "deployed",
    chart: "a-1.0.0",
    app_version: "1",
    updated: "2024-01-01 10:00:00 +0000 UTC",
  }) as ListedHelmRelease;

const setup = (updateRelease: () => Promise<unknown>) => {
  let revision = 1;
  const requestDetailedHelmRelease = vi.fn(async () => ({
    callWasSuccessful: true as const,
    response: {
      release: toHelmRelease(listed(String(revision))),
      details: { info: { notes: "" }, resources: [] },
    },
  }));
  const requestHelmReleaseConfiguration = vi.fn(async () => `rev: ${revision}`);
  const showCheckedErrorNotification = vi.fn();

  const model = new ReleaseDetailsModel({
    targetRelease: { namespace: "ns", name: "r" },
    activeTheme: observable.box({ type: "dark" }) as never,
    clusterId: "c",
    requestDetailedHelmRelease: requestDetailedHelmRelease as never,
    requestHelmReleaseConfiguration,
    getResourceDetailsUrl: vi.fn(),
    updateRelease: (async () => {
      const result = await updateRelease();

      revision += 1;

      return result;
    }) as never,
    showCheckedErrorNotification,
    showSuccessNotification: vi.fn(),
    createUpgradeChartTab: vi.fn(),
    navigateToHelmReleases: vi.fn(),
    helmChartRepo: (() => ({ value: observable.box("repo") })) as never,
  } as never);

  return { model, requestDetailedHelmRelease, showCheckedErrorNotification };
};

describe("ReleaseDetailsModel.configuration.save", () => {
  it("reloads the release after a successful update", async () => {
    const { model, requestDetailedHelmRelease } = setup(async () => ({ callWasSuccessful: true }));

    await model.load();
    expect(model.release.getRevision()).toBe(1);

    await model.configuration.save();

    expect(requestDetailedHelmRelease).toHaveBeenCalledTimes(2);
    expect(model.release.getRevision()).toBe(2);
    expect(model.configuration.nonSavedValue.get()).toBe("rev: 2");
  });

  it("stops saving and reports the error when the update throws", async () => {
    const { model, showCheckedErrorNotification } = setup(async () => {
      throw new Error("boom");
    });

    await model.load();
    await model.configuration.save();

    expect(model.configuration.isSaving.get()).toBe(false);
    expect(showCheckedErrorNotification).toHaveBeenCalled();
  });
});
