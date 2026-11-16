/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import kubeconfigManagerInjectable from "../../kubeconfig-manager/kubeconfig-manager.injectable";
import execHelmInjectable from "../exec-helm/exec-helm.injectable";
import getHelmEnvInjectable from "../get-helm-env/get-helm-env.injectable";
import { HelmChartManager } from "../helm-chart-manager";
import getHelmReleaseInjectable from "../helm-service/get-helm-release.injectable";
import getHelmReleaseDataInjectable from "../helm-service/get-helm-release-data.injectable";
import getHelmReleaseResourcesInjectable from "../helm-service/get-helm-release-resources/get-helm-release-resources.injectable";
import updateHelmRepositoriesInjectable from "../repositories/update-helm-repositories.injectable";

import type { Logger } from "@freelensapp/logger";

import type { ExecHelm } from "../exec-helm/exec-helm.injectable";

const ok = (response: string) => ({ callWasSuccessful: true as const, response });
const fail = (stderr: string) => ({
  callWasSuccessful: false as const,
  error: Object.assign(new Error(stderr), { stderr }) as any,
});

describe("helm env", () => {
  it("runs `helm env` once while the binary and environment are the same, and keeps failures out", async () => {
    const di = getDiForUnitTesting();
    let result: any = fail("no helm");
    const execHelm = vi.fn(async () => result);

    di.override(execHelmInjectable, () => execHelm as unknown as ExecHelm);

    const getHelmEnv = di.inject(getHelmEnvInjectable);

    expect(await getHelmEnv()).toEqual({ callWasSuccessful: false, error: "no helm" });

    result = ok('HELM_REPOSITORY_CACHE="/c"\nHELM_REPOSITORY_CONFIG="/r"\n');

    const first = await getHelmEnv();
    const second = await getHelmEnv();

    expect(first).toEqual({
      callWasSuccessful: true,
      response: { HELM_REPOSITORY_CACHE: "/c", HELM_REPOSITORY_CONFIG: "/r" },
    });
    expect(second).toEqual(first);
    expect(execHelm).toHaveBeenCalledTimes(2);
  });

  it("shares a run in progress between concurrent callers", async () => {
    const di = getDiForUnitTesting();
    const execHelm = vi.fn(async () => ok('A="1"'));

    di.override(execHelmInjectable, () => execHelm as unknown as ExecHelm);

    const getHelmEnv = di.inject(getHelmEnvInjectable);

    await Promise.all([getHelmEnv(), getHelmEnv(), getHelmEnv()]);

    expect(execHelm).toHaveBeenCalledTimes(1);
  });
});

describe("helm repo update", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = (outcome: () => Promise<any>) => {
    const di = getDiForUnitTesting();
    const execHelm = vi.fn(outcome);

    di.override(execHelmInjectable, () => execHelm as unknown as ExecHelm);

    return { execHelm, update: di.inject(updateHelmRepositoriesInjectable) };
  };

  it("shares one run between concurrent callers", async () => {
    const { execHelm, update } = setup(async () => ok(""));

    await Promise.all([update(), update(), update()]);

    expect(execHelm).toHaveBeenCalledTimes(1);
    expect(execHelm).toHaveBeenCalledWith(["repo", "update"]);
  });

  it("reuses a success only for the short window, and not after invalidate", async () => {
    const { execHelm, update } = setup(async () => ok(""));

    await update();
    await update();
    expect(execHelm).toHaveBeenCalledTimes(1);

    update.invalidate();
    await update();
    expect(execHelm).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(10_001);
    await update();
    expect(execHelm).toHaveBeenCalledTimes(3);
  });

  it("never reuses a failure", async () => {
    const { execHelm, update } = setup(async () => fail("network down"));

    expect(await update()).toMatchObject({ callWasSuccessful: false });
    await Promise.resolve();
    expect(await update()).toMatchObject({ callWasSuccessful: false });
    expect(execHelm).toHaveBeenCalledTimes(2);
  });
});

describe("helm chart manager", () => {
  const index = (extra = "") =>
    `apiVersion: v1\nentries:\n  nginx:\n    - name: nginx\n      version: 1.0.0\n      created: "2024-01-01T00:00:00Z"\n${extra}`;

  const setup = () => {
    const files = { text: index(), mtimeMs: 1 };
    const readFile = vi.fn(async () => files.text);
    const stat = vi.fn(async () => ({ mtimeMs: files.mtimeMs }) as any);
    const cache = new Map();
    const manager = new HelmChartManager(
      {
        cache,
        logger: { error: vi.fn() } as unknown as Logger,
        execHelm: vi.fn() as any,
        readFile,
        stat,
      },
      { name: "repo", url: "u", cacheFilePath: "/index.yaml" } as any,
    );

    return { files, manager, readFile, cache };
  };

  it("parses the index again only when its content changes, not when only its mtime does", async () => {
    const { files, manager, cache } = setup();
    const first = await manager.charts();

    // helm repo update rewrote the same content
    files.mtimeMs = 2;
    expect(await manager.charts()).toEqual(first);
    expect(cache.get("repo").mtimeMs).toBe(2);

    const parsed = cache.get("repo").data;

    files.mtimeMs = 3;
    files.text = index().replace("1.0.0", "2.0.0");

    const changed = await manager.charts();

    expect(changed.nginx[0].version).toBe("2.0.0");
    expect(cache.get("repo").data).not.toBe(parsed);
  });

  it("returns what it returned before for the same index", async () => {
    const { manager } = setup();

    expect(await manager.chartVersions("nginx")).toEqual([
      expect.objectContaining({ name: "nginx", version: "1.0.0", repo: "repo" }),
    ]);
  });
});

describe("get helm release", () => {
  it("runs the data and resource commands together and reports the data error first", async () => {
    const di = getDiForUnitTesting();
    const started: string[] = [];

    di.override(
      getHelmReleaseDataInjectable,
      () =>
        (async () => {
          started.push("data");
          return { callWasSuccessful: false, error: "data failed" };
        }) as any,
    );
    di.override(
      getHelmReleaseResourcesInjectable,
      () =>
        (async () => {
          started.push("resources");
          return { callWasSuccessful: false, error: "resources failed" };
        }) as any,
    );

    di.unoverride(getHelmReleaseInjectable);
    di.permitSideEffects(getHelmReleaseInjectable);
    di.override(kubeconfigManagerInjectable, () => ({ ensurePaths: async () => ({}) }) as any);

    const result = await di.inject(getHelmReleaseInjectable)({
      cluster: { id: "c" } as any,
      namespace: "n",
      releaseName: "r",
    });

    expect(started).toEqual(["data", "resources"]);
    expect(result).toEqual({ callWasSuccessful: false, error: "Failed to get helm release data: data failed" });
  });
});
