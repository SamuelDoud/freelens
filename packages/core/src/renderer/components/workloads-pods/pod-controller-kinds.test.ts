/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Pod } from "@freelensapp/kube-object";
import { describe, expect, it } from "vitest";
import { getPodControllerKinds } from "./pod-controller-kinds";

const makePod = (ownerKinds: string[], labels?: Record<string, string>) =>
  new Pod({
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: "pod",
      namespace: "default",
      uid: "uid",
      resourceVersion: "1",
      selfLink: "/api/v1/namespaces/default/pods/pod",
      labels,
      ownerReferences: ownerKinds.map((kind, index) => ({
        apiVersion: "apps/v1",
        kind,
        name: `owner-${index}`,
        uid: `owner-uid-${index}`,
        controller: true,
      })),
    },
  });

describe("getPodControllerKinds", () => {
  it("gives the kinds of the pod's owner references", () => {
    expect(getPodControllerKinds(makePod(["DaemonSet"]))).toEqual(["DaemonSet"]);
    expect(getPodControllerKinds(makePod(["StatefulSet"]))).toEqual(["StatefulSet"]);
    expect(getPodControllerKinds(makePod(["Job"]))).toEqual(["Job"]);
    expect(getPodControllerKinds(makePod(["Node"]))).toEqual(["Node"]);
  });

  it("adds Deployment for the pod of a ReplicaSet that a Deployment manages", () => {
    expect(getPodControllerKinds(makePod(["ReplicaSet"], { app: "api", "pod-template-hash": "5d8f" }))).toEqual([
      "ReplicaSet",
      "Deployment",
    ]);
  });

  it("does not add Deployment for the pod of a ReplicaSet without the Deployment's label", () => {
    expect(getPodControllerKinds(makePod(["ReplicaSet"], { app: "api" }))).toEqual(["ReplicaSet"]);
  });

  it("gives None for a pod without owner references", () => {
    expect(getPodControllerKinds(makePod([]))).toEqual(["None"]);
  });
});
