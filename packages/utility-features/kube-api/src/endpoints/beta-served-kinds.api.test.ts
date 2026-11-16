/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { DeviceClassApi } from "./device-class.api";
import { ServiceCIDRApi } from "./service-cidr.api";
import { VolumeAttributesClassApi } from "./volume-attributes-class.api";

import type { KubeJsonApi } from "../kube-json-api";

const apiServing = (group: string, version: string, resource: string) =>
  ({
    get: vi.fn(async (path: string) => {
      if (path === `/apis/${group}`) {
        return {
          preferredVersion: { groupVersion: `${group}/${version}`, version },
          versions: [{ groupVersion: `${group}/${version}`, version }],
        };
      }

      if (path === `/apis/${group}/${version}`) {
        return { resources: [{ name: resource }] };
      }

      throw new Error(`unexpected ${path}`);
    }),
  }) as Partial<KubeJsonApi> as KubeJsonApi;

const deps = (maybeKubeApi: KubeJsonApi) => ({
  logDebug: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  maybeKubeApi,
});

describe("kinds that older clusters serve under a beta version", () => {
  it.each([
    [ServiceCIDRApi, "networking.k8s.io", "v1beta1", "servicecidrs"],
    [DeviceClassApi, "resource.k8s.io", "v1beta2", "deviceclasses"],
    [VolumeAttributesClassApi, "storage.k8s.io", "v1beta1", "volumeattributesclasses"],
  ] as const)("%o resolves the served version", async (Api, group, version, resource) => {
    const request = apiServing(group, version, resource);
    const api = new Api(deps(request), { request });

    await api.list().catch(() => undefined);

    expect((request.get as ReturnType<typeof vi.fn>).mock.calls.map(([p]) => p)).toContain(
      `/apis/${group}/${version}/${resource}`,
    );
  });
});
