/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { ResourceSlice } from "./resource-slice";

describe("ResourceSlice.getDevices", () => {
  const slice = (devices: object[]) =>
    new ResourceSlice({
      apiVersion: "resource.k8s.io/v1beta1",
      kind: "ResourceSlice",
      metadata: { name: "s", uid: "u", resourceVersion: "1", selfLink: "/s" },
      spec: { devices },
    } as never);

  it("lifts attributes and capacity out of the `basic` wrapper of the beta versions", () => {
    expect(
      slice([{ name: "gpu0", basic: { attributes: { model: { string: "a100" } }, capacity: {} } }]).getDevices(),
    ).toEqual([{ name: "gpu0", attributes: { model: { string: "a100" } }, capacity: {} }]);
  });

  it("keeps v1 devices as they are", () => {
    expect(slice([{ name: "gpu0", attributes: { a: 1 } }]).getDevices()).toEqual([
      { name: "gpu0", attributes: { a: 1 } },
    ]);
  });
});
