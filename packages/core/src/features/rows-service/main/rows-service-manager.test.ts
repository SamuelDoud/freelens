/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { runInAction } from "mobx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import spawnInjectable from "../../../main/child-process/spawn.injectable";
import loadProxyKubeconfigInjectable from "../../../main/cluster/load-proxy-kubeconfig.injectable";
import { getDiForUnitTesting } from "../../../main/getDiForUnitTesting";
import { createMockCluster } from "../../cluster/execute/common/testing";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import rowsServiceManagerInjectable, { RowsServiceUnavailableError } from "./rows-service-manager.injectable";
import rowsServicePathInjectable from "./rows-service-path.injectable";

import type { DiContainer } from "@ogre-tools/injectable";

import type { Cluster } from "../../../common/cluster/cluster";
import type { UserPreferencesState } from "../../user-preferences/common/state.injectable";

class FakeChild extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly kill = vi.fn(() => true);

  listen(port: number) {
    this.stdout.write(`freelens-rows listening on 127.0.0.1:${port}\n`);
  }
}

const contextName = "context-rows";

describe("rows service manager", () => {
  let di: DiContainer;
  let cluster: Cluster;
  let preferences: UserPreferencesState;
  let children: FakeChild[];
  let spawn: ReturnType<typeof vi.fn>;

  const setOption = (on: boolean) => runInAction(() => (preferences.rowsService = on));
  const manager = () => di.inject(rowsServiceManagerInjectable, cluster);
  const startAndListen = async (port = 4100) => {
    const endpoint = manager().ensure();

    await vi.waitFor(() => expect(children).toHaveLength(1));
    children[0].listen(port);

    return await endpoint;
  };

  beforeEach(() => {
    di = getDiForUnitTesting();
    children = [];
    spawn = vi.fn(() => {
      const child = new FakeChild();

      children.push(child);

      return child;
    });

    di.override(spawnInjectable, () => spawn as never);
    di.override(rowsServicePathInjectable, () => "/bin/freelens-rows");
    di.override(
      loadProxyKubeconfigInjectable,
      () => async () =>
        ({
          getContextObject: () => ({ cluster: contextName, user: "proxy" }),
          getCluster: () => ({ server: "https://127.0.0.1:9000/rows", caData: "Y2E=" }),
          getUser: () => ({ token: "proxy-token" }),
        }) as never,
    );

    cluster = createMockCluster("rows", true);
    cluster.contextName.set(contextName);
    // A new cluster starts disconnected: these tests are about a connected one
    runInAction(() => cluster.disconnected.set(false));
    preferences = di.inject(userPreferencesStateInjectable);
  });

  it("starts nothing while the option is off", async () => {
    setOption(false);

    await expect(manager().ensure()).rejects.toBeInstanceOf(RowsServiceUnavailableError);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("starts the service on the first request while the option is on, and reuses it", async () => {
    setOption(true);

    const endpoint = await startAndListen(4100);

    expect(endpoint.port).toBe(4100);
    expect(endpoint.token).toMatch(/^[0-9a-f]{48}$/);
    expect(await manager().ensure()).toBe(endpoint);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it("stops the service at once when the option is turned off", async () => {
    setOption(true);
    await startAndListen();

    setOption(false);

    expect(children[0].kill).toHaveBeenCalled();
    await expect(manager().ensure()).rejects.toBeInstanceOf(RowsServiceUnavailableError);
  });

  it("stops the service when the cluster disconnects", async () => {
    setOption(true);
    await startAndListen();

    runInAction(() => cluster.disconnected.set(true));

    expect(children[0].kill).toHaveBeenCalled();
  });

  it("does not start again after the user was found unable to list pods, until the option changes", async () => {
    setOption(true);

    const first = manager().ensure();

    await vi.waitFor(() => expect(children).toHaveLength(1));
    children[0].emit("exit", 3, null);

    await expect(first).rejects.toBeInstanceOf(RowsServiceUnavailableError);
    await expect(manager().ensure()).rejects.toBeInstanceOf(RowsServiceUnavailableError);
    expect(spawn).toHaveBeenCalledTimes(1);

    setOption(false);
    setOption(true);

    const again = manager().ensure();

    await vi.waitFor(() => expect(children).toHaveLength(2));
    children[1].listen(4200);
    expect((await again).port).toBe(4200);
  });

  it("treats a missing binary as unavailable", async () => {
    setOption(true);

    const first = manager().ensure();

    await vi.waitFor(() => expect(children).toHaveLength(1));
    children[0].emit("error", Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }));

    await expect(first).rejects.toBeInstanceOf(RowsServiceUnavailableError);
    await expect(manager().ensure()).rejects.toThrow(/binary is missing/);
  });

  it("passes the connection in the environment, not in the arguments", async () => {
    setOption(true);
    await startAndListen();

    const [, args, options] = spawn.mock.calls[0] as [string, string[], { env: Record<string, string> }];

    expect(args).toEqual([]);
    expect(options.env).toMatchObject({
      ROWS_SERVER: "https://127.0.0.1:9000/rows",
      ROWS_CA_DATA: "Y2E=",
      ROWS_BEARER_TOKEN: "proxy-token",
    });
    expect(options.env.ROWS_SERVICE_TOKEN).toMatch(/^[0-9a-f]{48}$/);
  });
});
