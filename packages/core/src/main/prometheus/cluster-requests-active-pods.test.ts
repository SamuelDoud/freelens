/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import helmPrometheusProviderInjectable from "@freelensapp/prometheus/src/helm-provider.injectable";
import lensPrometheusProviderInjectable from "@freelensapp/prometheus/src/lens-provider.injectable";
import operatorPrometheusProviderInjectable from "@freelensapp/prometheus/src/operator-provider.injectable";
import stacklightPrometheusProviderInjectable from "@freelensapp/prometheus/src/stacklight-provider.injectable";
import { createContainer } from "@ogre-tools/injectable";
import { describe, expect, it } from "vitest";

const injectables = [
  lensPrometheusProviderInjectable,
  helmPrometheusProviderInjectable,
  operatorPrometheusProviderInjectable,
  stacklightPrometheusProviderInjectable,
];

const di = createContainer("prometheus-cluster-requests-test");
di.register(...injectables);
const providers = injectables.map((injectable) => di.inject(injectable));

describe("cluster resource requests in the prometheus providers", () => {
  it.each([
    ["memoryRequests", "memory"],
    ["cpuRequests", "cpu"],
  ])("leave out the pods that are not Pending or Running in %s", (queryName, resource) => {
    for (const provider of providers) {
      for (const nodes of [undefined, "worker-1|worker-2"]) {
        const query = provider.getQuery({ category: "cluster", ...(nodes ? { nodes } : {}) }, queryName);

        expect(query, provider.kind).toContain(`kube_pod_container_resource_requests{resource="${resource}"`);
        expect(query, provider.kind).toContain(
          `* on (namespace, pod) group_left() max by (namespace, pod) (kube_pod_status_phase{phase=~"Pending|Running"} == 1)`,
        );

        if (nodes) {
          expect(query, provider.kind).toContain(`node=~"worker-1|worker-2"`);
        }
      }
    }
  });
});
