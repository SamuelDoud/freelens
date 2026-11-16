/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import net from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import directoryForTempInjectable from "../../common/app-paths/directory-for-temp/directory-for-temp.injectable";
import directoryForUserDataInjectable from "../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import freelensProxyCertificateInjectable from "../../common/certificate/freelens-proxy-certificate.injectable";
import { testCertificate } from "../../test-utils/test-certificate";
import { getDiForUnitTesting } from "../getDiForUnitTesting";
import routerInjectable from "../router/router.injectable";
import freelensProxyInjectable from "./freelens-proxy.injectable";
import freelensProxyPortInjectable from "./freelens-proxy-port.injectable";
import freelensProxyPreferredPortInjectable from "./freelens-proxy-preferred-port.injectable";
import getClusterForRequestInjectable from "./get-cluster-for-request.injectable";
import kubeApiUpgradeRequestInjectable from "./proxy-functions/kube-api-upgrade-request.injectable";
import shellApiRequestInjectable from "./proxy-functions/shell-api-request.injectable";

import type { DiContainer } from "@ogre-tools/injectable";

import type { Router } from "../router/router";
import type { FreelensProxy } from "./freelens-proxy";

const freePort = () =>
  new Promise<number>((resolve) => {
    const server = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = server.address() as net.AddressInfo;

      server.close(() => resolve(port));
    });
  });

describe("the port of the Freelens proxy", () => {
  let di: DiContainer;
  let proxy: FreelensProxy;
  let blocker: net.Server | undefined;
  const save = vi.fn(async (_port: number) => {});

  const start = async (preferred: number | undefined) => {
    di.override(freelensProxyPreferredPortInjectable, () => ({ get: async () => preferred, save }));
    proxy = di.inject(freelensProxyInjectable);
    await proxy.listen();

    return di.inject(freelensProxyPortInjectable).get();
  };

  beforeEach(() => {
    di = getDiForUnitTesting();
    di.override(directoryForUserDataInjectable, () => "/some-directory-for-user-data");
    di.override(directoryForTempInjectable, () => "/some-directory-for-tmp");
    di.override(freelensProxyCertificateInjectable, () => ({ get: () => testCertificate, set: () => {} }));
    di.override(getClusterForRequestInjectable, () => () => undefined);
    di.override(shellApiRequestInjectable, () => () => {});
    di.override(kubeApiUpgradeRequestInjectable, () => vi.fn());
    di.override(routerInjectable, () => ({ route: () => Promise.resolve() }) as unknown as Router);
    save.mockClear();
  });

  afterEach(async () => {
    await proxy?.close();
    blocker?.close();
    blocker = undefined;
  });

  it("is the one of the previous run when it is free", async () => {
    const preferred = await freePort();

    expect(await start(preferred)).toBe(preferred);
    expect(save).toHaveBeenCalledWith(preferred);
  });

  it("is a port the OS picks when the previous one is taken, and that port is remembered", async () => {
    blocker = net.createServer().listen(0, "127.0.0.1");
    await new Promise((resolve) => blocker!.once("listening", resolve));

    const taken = (blocker.address() as net.AddressInfo).port;
    const port = await start(taken);

    expect(port).not.toBe(taken);
    expect(save).toHaveBeenCalledWith(port);
  });

  it("is a port the OS picks when there is no previous one", async () => {
    const port = await start(undefined);

    expect(port).toBeGreaterThan(0);
    expect(save).toHaveBeenCalledWith(port);
  });
});
