/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { isRequestError, object } from "@freelensapp/utilities";
import { isObject } from "es-toolkit/compat";
import { runInAction } from "mobx";
import { ClusterMetadataKey, initialFilesystemMountpoints } from "../../../common/cluster-types";
import { apiPrefix } from "../../../common/vars";
import prometheusHandlerInjectable from "../../cluster/prometheus-handler/prometheus-handler.injectable";
import getMetricsInjectable from "../../get-metrics.injectable";
import { clusterRoute } from "../../router/route";
import { getRouteInjectable } from "../../router/router.injectable";

import type { Cluster } from "../../../common/cluster/cluster";
import type { ClusterPrometheusMetadata } from "../../../common/cluster-types";
import type { GetMetrics } from "../../get-metrics.injectable";

// This is used for backoff retry tracking.
const ATTEMPTS = [false, false, false, false, true];

interface MetricsErrorDescription {
  query: string;
  status?: number;
  response?: string;
  message?: string;
}

async function describeError(query: string, error: unknown): Promise<MetricsErrorDescription> {
  if (!(error instanceof Error)) {
    return { query, message: String(error) };
  }

  const cause = error.cause as any;

  // Duck-type check for a Response
  const looksLikeResponse = cause && typeof cause.text === "function" && typeof cause.status === "number";

  if (looksLikeResponse) {
    try {
      const bodyText = await cause.text();

      if (bodyText) {
        return {
          query,
          status: cause.status,
          response: bodyText.trim(),
        };
      }
    } catch {
      // body already consumed or unreadable — fall through
    }
  }

  // k8sRequest reads the body itself, to keep what the proxy explains in it, so the response that it gives as the
  // cause has no body left: the status and the body are on the error.
  if (isRequestError(error) && typeof error.statusCode === "number") {
    return { query, status: error.statusCode, response: error.error ?? error.message };
  }

  return { query, message: error.message };
}

function isMetricsErrorDescription(value: unknown): value is MetricsErrorDescription {
  return isObject(value) && typeof (value as { query?: unknown }).query === "string";
}

const loadMetricsFor =
  (getMetrics: GetMetrics) =>
  async (
    promQueries: string[],
    cluster: Cluster,
    prometheusPath: string,
    queryParams: Partial<Record<string, string>>,
    onError: (error: unknown) => void,
  ): Promise<any[]> => {
    const queries = promQueries.map((p) => p.trim());
    const loaders = new Map<string, Promise<any>>();

    async function loadMetric(query: string): Promise<any> {
      async function loadMetricHelper(): Promise<any> {
        for (const [attempt, lastAttempt] of ATTEMPTS.entries()) {
          // retry
          try {
            return await getMetrics(cluster, prometheusPath, { query, ...queryParams });
          } catch (error) {
            if (
              !isRequestError(error) ||
              lastAttempt ||
              (!lastAttempt &&
                typeof error.statusCode === "number" &&
                400 <= error.statusCode &&
                error.statusCode < 500)
            ) {
              const description = await describeError(query, error);
              throw new Error("Metrics not available", { cause: description });
            }

            await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000)); // add delay before repeating request
          }
        }
      }

      return loaders.get(query) ?? loaders.set(query, loadMetricHelper()).get(query);
    }

    // One failing query (Prometheus rejects some of them, e.g. "found duplicate series for the match group") must cost
    // only its own metric: it answers like a missing one, and the rest of the batch keeps its data.
    return Promise.all(
      queries.map(async (query) => {
        try {
          return await loadMetric(query);
        } catch (error) {
          onError(error);

          return {};
        }
      }),
    );
  };

const addMetricsRouteInjectable = getRouteInjectable({
  id: "add-metrics-route",

  instantiate: (di) => {
    const getMetrics = di.inject(getMetricsInjectable);
    const loadMetrics = loadMetricsFor(getMetrics);
    const logger = di.inject(loggerInjectionToken);

    return clusterRoute({
      method: "post",
      path: `${apiPrefix}/metrics`,
    })(async ({ cluster, payload, query }) => {
      const queryParams: Partial<Record<string, string>> = Object.fromEntries(query.entries());
      const prometheusMetadata: ClusterPrometheusMetadata = {};
      const prometheusHandler = di.inject(prometheusHandlerInjectable, cluster);
      const mountpoints = cluster.preferences.filesystemMountpoints || initialFilesystemMountpoints;

      let failures = 0;
      const logFailure = (error: unknown) => {
        failures += 1;

        const description = error instanceof Error && isMetricsErrorDescription(error.cause) ? error.cause : undefined;
        const message = `[METRICS-ROUTE]: failed to get metrics for clusterId=${cluster.id}: ${error}`;

        if (description?.status === 422) {
          logger.warn(`[METRICS-ROUTE]: query failed for clusterId=${cluster.id}`, description);
        } else if (description) {
          logger.warn(message, description);
        } else {
          // The route is polled, and a cluster without Prometheus is common: the errors of the providers would flood
          // the log on every request.
          logger.warn(message);
        }
      };

      try {
        const { prometheusPath, provider } = await prometheusHandler.getPrometheusDetails();

        prometheusMetadata.provider = provider?.kind;
        prometheusMetadata.autoDetected = !cluster.preferences.prometheusProvider?.type;

        if (!prometheusPath) {
          prometheusMetadata.success = false;

          return { response: {} };
        }

        // return data in same structure as query
        if (typeof payload === "string") {
          const [data] = await loadMetrics([payload], cluster, prometheusPath, queryParams, logFailure);

          return { response: data };
        }

        if (Array.isArray(payload)) {
          const data = await loadMetrics(payload, cluster, prometheusPath, queryParams, logFailure);

          return { response: data };
        }

        if (isObject(payload)) {
          const data = payload as Record<string, Record<string, string>>;
          // A name the provider has no query for costs only its own metric as well.
          const queries = object.entries(data).map(([queryName, queryOpts]) => {
            try {
              return provider.getQuery({ ...queryOpts, mountpoints }, queryName);
            } catch (error) {
              logFailure(error);

              return undefined;
            }
          });
          const loaded = await loadMetrics(
            queries.filter((query): query is string => query !== undefined),
            cluster,
            prometheusPath,
            queryParams,
            logFailure,
          );
          let next = 0;
          const result = queries.map((query) => (query === undefined ? {} : loaded[next++]));
          const response = object.fromEntries(object.keys(data).map((metricName, i) => [metricName, result[i]]));

          prometheusMetadata.success = failures < queries.length;

          return { response };
        }

        return { response: {} };
      } catch (error) {
        prometheusMetadata.success = false;
        logFailure(error);

        return { response: {} };
      } finally {
        runInAction(() => {
          cluster.metadata[ClusterMetadataKey.PROMETHEUS] = prometheusMetadata;
        });
      }
    });
  },
});

export default addMetricsRouteInjectable;
