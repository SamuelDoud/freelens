/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeConfig, loadYaml } from "@kubernetes/client-node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import readFileInjectable from "../../../../common/fs/read-file.injectable";
import writeFileInjectable from "../../../../common/fs/write-file.injectable";
import { getDiForUnitTesting } from "../../../getDiForUnitTesting";
import saveKubeconfigInjectable from "../save-kubeconfig.injectable";

import type { SaveKubeconfig } from "../save-kubeconfig.injectable";

vi.mock("proper-lockfile", () => ({
  lock: vi.fn(async () => async () => {}),
}));

const kubeconfigFile = `
apiVersion: v1
kind: Config
current-context: first
preferences:
  colors: true
clusters:
  - name: first
    cluster:
      server: https://first.example.com
      extensions:
        - name: client.authentication.k8s.io/exec
          extension:
            clusterName: first-name
            region: eu01
  - name: second
    cluster:
      server: https://second.example.com
contexts:
  - name: first
    context:
      cluster: first
      user: first-user
  - name: second
    context:
      cluster: second
      user: second-user
users:
  - name: first-user
    user: {}
  - name: second-user
    user: {}
`;

describe("saving a kubeconfig after a context was deleted", () => {
  let saveKubeconfig: SaveKubeconfig;
  let written: string | undefined;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    written = undefined;
    di.override(readFileInjectable, () => async () => kubeconfigFile);
    di.override(writeFileInjectable, () => async (_path: string, contents: string) => {
      written = contents;
    });
    di.unoverride(saveKubeconfigInjectable);
    di.permitSideEffects(saveKubeconfigInjectable);

    saveKubeconfig = di.inject(saveKubeconfigInjectable);
  });

  it("keeps the extensions of the clusters and the other fields of the file", async () => {
    const config = new KubeConfig();

    config.loadFromString(kubeconfigFile);
    config.contexts = config.contexts.filter((context) => context.name !== "second");

    await saveKubeconfig(config, "/some/kubeconfig");

    const saved = loadYaml<any>(written!);

    expect(saved.contexts.map((context: { name: string }) => context.name)).toEqual(["first"]);
    expect(saved["current-context"]).toBe("first");
    expect(saved.preferences).toEqual({ colors: true });
    expect(saved.clusters[0].cluster.extensions).toEqual([
      { name: "client.authentication.k8s.io/exec", extension: { clusterName: "first-name", region: "eu01" } },
    ]);
    expect(saved.clusters[0].cluster["insecure-skip-tls-verify"]).toBeUndefined();
  });

  it("writes the new current context", async () => {
    const config = new KubeConfig();

    config.loadFromString(kubeconfigFile);
    config.contexts = config.contexts.filter((context) => context.name !== "first");
    config.setCurrentContext("second");

    await saveKubeconfig(config, "/some/kubeconfig");

    expect(loadYaml<any>(written!)["current-context"]).toBe("second");
  });
});
