/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { reaction } from "mobx";
import randomBytesInjectable from "../../../common/utils/random-bytes.injectable";
import spawnInjectable from "../../../main/child-process/spawn.injectable";
import loadProxyKubeconfigInjectable from "../../../main/cluster/load-proxy-kubeconfig.injectable";
import rowsServiceEnabledInjectable from "../common/rows-service-enabled.injectable";
import rowsServicePathInjectable from "./rows-service-path.injectable";
import type { ChildProcess } from "node:child_process";

import type { Cluster } from "../../../common/cluster/cluster";

export interface RowsServiceEndpoint {
  readonly port: number;
  /** Sent as `X-Rows-Token`, which the service requires on every request. */
  readonly token: string;
}

/** The rows service cannot serve the cluster until the option or the connection changes. */
export class RowsServiceUnavailableError extends Error {}

export interface RowsServiceManager {
  /**
   * Starts the service of the cluster unless it runs, and resolves once it listens.
   * Rejects with `RowsServiceUnavailableError` while the option is off, or after the
   * service found that it cannot serve this cluster.
   */
  ensure(): Promise<RowsServiceEndpoint>;
}

const listeningRegex = /listening on 127\.0\.0\.1:(?<port>\d+)/;
const startTimeoutMs = 20_000;

/** The exit code with which the service says the user may not list and watch pods in every namespace. */
const accessDeniedExitCode = 3;

/**
 * One rows service process per cluster, started on the first request for it.
 *
 * It runs only while the `rowsService` option is on and the cluster is connected:
 * turning the option off or disconnecting stops it at once.
 *
 * It reaches the cluster through the local freelens-proxy, with the token and the
 * certificate of the proxy kubeconfig, so it authenticates the way kubectl does. It
 * exits when its stdin closes, which is when this process ends.
 */
const rowsServiceManagerInjectable = getInjectable({
  id: "rows-service-manager",

  instantiate: (di, cluster): RowsServiceManager => {
    const enabled = di.inject(rowsServiceEnabledInjectable);
    const binaryPath = di.inject(rowsServicePathInjectable);
    const spawn = di.inject(spawnInjectable);
    const logger = di.inject(loggerInjectionToken);
    const randomBytes = di.inject(randomBytesInjectable);
    const loadProxyKubeconfig = di.inject(loadProxyKubeconfigInjectable, cluster);

    let child: ChildProcess | undefined;
    let starting: Promise<RowsServiceEndpoint> | undefined;
    let endpoint: RowsServiceEndpoint | undefined;
    /** Why the service cannot serve this cluster, until the option or the connection changes. */
    let unavailable: string | undefined;

    const stop = () => {
      const stopped = child;

      child = undefined;
      endpoint = undefined;
      starting = undefined;

      if (stopped) {
        stopped.removeAllListeners();
        stopped.kill();
        logger.info(`[ROWS-SERVICE]: stopped for cluster ${cluster.id}`);
      }
    };

    const start = async (): Promise<RowsServiceEndpoint> => {
      const kubeconfig = await loadProxyKubeconfig();
      const context = kubeconfig.getContextObject(cluster.contextName.get());
      const clusterConfig = kubeconfig.getCluster(context?.cluster ?? "");
      const user = kubeconfig.getUser(context?.user ?? "");

      if (!clusterConfig?.server) {
        throw new Error(`No server in the proxy kubeconfig of cluster ${cluster.id}`);
      }

      const token = randomBytes(24).toString("hex");
      const rowsProcess = spawn(binaryPath, [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ROWS_SERVER: clusterConfig.server,
          ROWS_CA_DATA: clusterConfig.caData ?? "",
          ROWS_BEARER_TOKEN: user?.token ?? "",
          ROWS_SERVICE_TOKEN: token,
        },
      });

      child = rowsProcess;

      return await new Promise<RowsServiceEndpoint>((resolve, reject) => {
        let output = "";
        const timer = setTimeout(() => {
          fail(new Error(`The rows service did not start within ${startTimeoutMs} ms: ${output.trim()}`));
        }, startTimeoutMs);
        const fail = (error: Error) => {
          clearTimeout(timer);

          if (child === rowsProcess) {
            stop();
          }

          reject(error);
        };

        rowsProcess.once("error", (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") {
            unavailable = `the rows service binary is missing at ${binaryPath}`;
            fail(new RowsServiceUnavailableError(unavailable));
          } else {
            fail(error);
          }
        });
        rowsProcess.once("exit", (code, signal) => {
          logger.info(`[ROWS-SERVICE]: exited with ${code ?? signal} for cluster ${cluster.id}`);

          if (child === rowsProcess) {
            child = undefined;
            endpoint = undefined;
            starting = undefined;
          }

          if (code === accessDeniedExitCode) {
            unavailable = "the user may not list and watch pods in every namespace";
            fail(new RowsServiceUnavailableError(unavailable));
          } else {
            fail(new Error(`The rows service exited with ${code ?? signal}: ${output.trim()}`));
          }
        });
        rowsProcess.stderr?.on("data", (data: Buffer) => {
          output = (output + data.toString()).slice(-2000);
          logger.debug(`[ROWS-SERVICE]: ${data.toString().trim()}`);
        });
        rowsProcess.stdout?.on("data", (data: Buffer) => {
          const match = listeningRegex.exec(data.toString());

          if (match?.groups) {
            clearTimeout(timer);
            endpoint = { port: Number(match.groups.port), token };
            logger.info(`[ROWS-SERVICE]: serving cluster ${cluster.id} on port ${endpoint.port}`);
            resolve(endpoint);
          }
        });
      });
    };

    // The service runs only while the option is on and the cluster is connected. A change of
    // either also clears an earlier "unavailable", so the next request tries again.
    reaction(
      () => enabled.get() && !cluster.disconnected.get(),
      (active) => {
        unavailable = undefined;

        if (!active) {
          stop();
        }
      },
    );

    return {
      ensure: async () => {
        if (!enabled.get()) {
          throw new RowsServiceUnavailableError("the rows service option is off");
        }

        if (unavailable) {
          throw new RowsServiceUnavailableError(unavailable);
        }

        if (endpoint) {
          return endpoint;
        }

        starting ??= start().catch((error) => {
          starting = undefined;
          throw error;
        });

        return await starting;
      },
    };
  },

  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (di, cluster: Cluster) => cluster.id,
  }),
});

export default rowsServiceManagerInjectable;
