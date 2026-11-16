/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import clusterApiUrlInjectable from "../../features/cluster/connections/main/api-url.injectable";
import createFreelensK8sProxyInjectable from "../freelens-k8s-proxy/create-freelens-k8s-proxy.injectable";
import freelensK8sProxyCertificateInjectable from "../freelens-k8s-proxy/freelens-k8s-proxy-certificate.injectable";
import freelensK8sProxyManagersInjectable from "./freelens-k8s-proxy-managers.injectable";
import { apiTargetOptions, createFreelensK8sProxyAgent, dispatcherFor } from "./freelens-k8s-proxy-target";

import type { ServerOptions } from "http-proxy-3";
import type { Agent, Dispatcher } from "undici";

import type { Cluster } from "../../common/cluster/cluster";
import type { FreelensK8sProxy } from "../freelens-k8s-proxy/create-freelens-k8s-proxy.injectable";

export interface FreelensK8sProxyManager {
  getApiTarget(isLongRunningRequest?: boolean): Promise<ServerOptions>;
  ensureFreelensK8sProxyUrl(): Promise<string>;
  restart(): Promise<void>;
  ensureRunning(): Promise<void>;
  stop(): void;

  /**
   * The URL of the API server that the last target forwards to, as the
   * kubeconfig gives it: `undefined` until a target has been made.
   */
  readonly apiUrl?: URL;
}

interface ApiTarget {
  /**
   * The port of the proxy process that the targets forward to.
   */
  port: number;
  /**
   * What the targets were made from: they are made again when the cluster
   * points at another kubeconfig or context.
   */
  kubeConfigPath: string;
  contextName: string;
  /** The target of a request, and of a long-running one (watch, follow). */
  options: ServerOptions;
  longRunningOptions: ServerOptions;
}

const fourHoursInMs = 4 * 60 * 60 * 1000;
const thirtySecondsInMs = 30 * 1000;

/**
 * How often a long-running request looks whether the kubeconfig has changed,
 * which takes a stat of the file: a cluster opens hundreds of watches at once,
 * and one look serves them all.
 */
const kubeconfigCheckIntervalMs = 1000;

const freelensK8sProxyManagerInjectable = getInjectable({
  id: "freelens-k8s-proxy-manager",
  instantiate: (di, cluster): FreelensK8sProxyManager => {
    const clusterApiUrl = di.inject(clusterApiUrlInjectable, cluster);
    const createFreelensK8sProxy = di.inject(createFreelensK8sProxyInjectable, cluster);

    let freelensK8sProxy: FreelensK8sProxy | undefined = undefined;
    let apiTarget: ApiTarget | undefined = undefined;
    /** The target being made, which concurrent requests wait for instead of making their own. */
    let pendingApiTarget: Promise<ApiTarget> | undefined = undefined;
    let lastKubeconfigCheck = 0;
    let apiUrl: URL | undefined = undefined;
    let agent: Agent | undefined;
    let dispatcher: Dispatcher | undefined;

    /**
     * One pool for every request to the proxy process, created with the
     * certificate of its first target, which is the one the process serves.
     */
    const getDispatcher = (ca: string) => {
      agent ??= createFreelensK8sProxyAgent(ca);
      dispatcher ??= dispatcherFor(agent);

      return dispatcher;
    };

    const ensureServerHelper = async (): Promise<FreelensK8sProxy> => {
      if (!freelensK8sProxy) {
        const proxyEnv = {
          ...process.env,
        };

        if (cluster.preferences.httpsProxy) {
          proxyEnv.HTTPS_PROXY = cluster.preferences.httpsProxy;
        }

        freelensK8sProxy = createFreelensK8sProxy(proxyEnv);
      }

      await freelensK8sProxy.run();

      return freelensK8sProxy;
    };

    const newApiTarget = async (): Promise<ApiTarget> => {
      const kubeConfigPath = cluster.kubeConfigPath.get();
      const contextName = cluster.contextName.get();
      // The proxy is created and its start begun before anything is awaited,
      // so a stop() while the API URL is read reaches its exit(), which aborts
      // the start. Awaited first, they would let the start spawn a process
      // after the stop.
      const [{ port, apiPrefix: path }, url] = await Promise.all([ensureServerHelper(), clusterApiUrl()]);
      const { hostname } = url;
      const certificate = await di.inject(freelensK8sProxyCertificateInjectable, hostname);

      apiUrl = url;
      lastKubeconfigCheck = Date.now();

      const target = new URL(`https://127.0.0.1:${port}${path}`);
      const dispatcher = getDispatcher(certificate.cert);

      return {
        port,
        kubeConfigPath,
        contextName,
        options: apiTargetOptions({ target, dispatcher, timeout: thirtySecondsInMs }),
        longRunningOptions: apiTargetOptions({ target, dispatcher, timeout: fourHoursInMs }),
      };
    };

    const isCurrent = (target: ApiTarget) =>
      freelensK8sProxy?.isRunning === true &&
      target.port === freelensK8sProxy.port &&
      target.kubeConfigPath === cluster.kubeConfigPath.get() &&
      target.contextName === cluster.contextName.get();

    const stopServer = () => {
      // Never reuse a connection to a stopped proxy process after a restart.
      // The requests still open on it fail, and their clients see them end.
      void agent?.destroy();
      agent = undefined;
      dispatcher = undefined;
      freelensK8sProxy?.exit();
      freelensK8sProxy = undefined;
      apiTarget = undefined;
      pendingApiTarget = undefined;
    };

    const freelensK8sProxyManager: FreelensK8sProxyManager = {
      get apiUrl() {
        return apiUrl;
      },
      getApiTarget: async (isLongRunningRequest = false) => {
        // A watch is where a changed API server address of the kubeconfig
        // reaches the routes of the cluster: clusterApiUrl() gives the same URL
        // until the file changes.
        if (isLongRunningRequest && apiTarget && Date.now() - lastKubeconfigCheck >= kubeconfigCheckIntervalMs) {
          lastKubeconfigCheck = Date.now();

          const url = await clusterApiUrl();

          if (url !== apiUrl) {
            apiTarget = undefined;
          }
        }

        // The targets point at the port of one proxy process, and are made once
        // for it, for every request and every watch. Once that process has
        // exited, on its own or not, a new target starts a new one, or points
        // at the one that ensureRunning() or ensureFreelensK8sProxyUrl() has
        // started in its place. Requests that arrive while one is made wait
        // for it.
        if (!apiTarget || !isCurrent(apiTarget)) {
          const pending = (pendingApiTarget ??= newApiTarget().then(
            (made) => {
              if (pendingApiTarget === pending) {
                apiTarget = made;
                pendingApiTarget = undefined;
              }

              return made;
            },
            (error) => {
              if (pendingApiTarget === pending) {
                pendingApiTarget = undefined;
              }

              throw error;
            },
          ));

          const made = await pending;

          return isLongRunningRequest ? made.longRunningOptions : made.options;
        }

        return isLongRunningRequest ? apiTarget.longRunningOptions : apiTarget.options;
      },
      ensureFreelensK8sProxyUrl: async () => {
        const freelensK8sProxy = await ensureServerHelper();

        return `https://127.0.0.1:${freelensK8sProxy.port}${freelensK8sProxy.apiPrefix}`;
      },
      ensureRunning: async () => {
        await ensureServerHelper();
      },
      restart: async () => {
        stopServer();
        await ensureServerHelper();
      },
      stop: stopServer,
    };

    di.inject(freelensK8sProxyManagersInjectable).add(freelensK8sProxyManager);

    return freelensK8sProxyManager;
  },
  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (di, cluster: Cluster) => cluster.id,
  }),
});

export default freelensK8sProxyManagerInjectable;
