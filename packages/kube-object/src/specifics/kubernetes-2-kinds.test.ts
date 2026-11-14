/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { APIService } from "./api-service";
import { CertificateSigningRequest } from "./certificate-signing-request";
import { ClusterTrustBundle } from "./cluster-trust-bundle";
import { ControllerRevision } from "./controller-revision";
import { DeviceTaintRule } from "./device-taint-rule";
import { IPAddress } from "./ip-address";
import { PodTemplate } from "./pod-template";
import { ResourceClaim } from "./resource-claim";
import { VolumeAttributesClass } from "./volume-attributes-class";

const metadata = (name: string, namespace?: string) => ({
  name,
  ...(namespace ? { namespace } : {}),
  uid: `${name}-uid`,
  resourceVersion: "1",
  selfLink: `/x/${name}`,
});

const condition = (type: string, status = "True") => ({ type, status });

describe("CertificateSigningRequest", () => {
  const csr = (conditions: { type: string; status: string }[], certificate?: string) =>
    new CertificateSigningRequest({
      apiVersion: "certificates.k8s.io/v1",
      kind: "CertificateSigningRequest",
      metadata: metadata("csr"),
      spec: { signerName: "kubernetes.io/kube-apiserver-client", username: "alice" },
      status: { conditions, certificate },
    });

  it("is pending until approved or denied", () => {
    expect(csr([]).isPending()).toBe(true);
    expect(csr([]).getCondition()).toBe("Pending");
  });

  it("shows its condition as kubectl does", () => {
    expect(csr([condition("Approved")]).getCondition()).toBe("Approved");
    expect(csr([condition("Approved")], "LS0t").getCondition()).toBe("Approved,Issued");
    expect(csr([condition("Denied")]).getCondition()).toBe("Denied");
    expect(csr([condition("Denied")]).isPending()).toBe(false);
  });
});

describe("ResourceClaim", () => {
  const claim = (status?: object) =>
    new ResourceClaim({
      apiVersion: "resource.k8s.io/v1",
      kind: "ResourceClaim",
      metadata: metadata("gpu", "ml"),
      spec: { devices: { requests: [{ name: "gpu", exactly: { deviceClassName: "gpu.nvidia.com" } }] } },
      status,
    });

  it("is pending, allocated, or allocated and reserved", () => {
    expect(claim().getState()).toBe("pending");
    expect(claim({ allocation: {} }).getState()).toBe("allocated");
    expect(claim({ allocation: {}, reservedFor: [{ resource: "pods", name: "trainer" }] }).getState()).toBe(
      "allocated,reserved",
    );
    expect(
      claim()
        .getRequests()
        .map((request) => request.name),
    ).toEqual(["gpu"]);
  });
});

describe("APIService", () => {
  it("names its service and availability", () => {
    const service = new APIService({
      apiVersion: "apiregistration.k8s.io/v1",
      kind: "APIService",
      metadata: metadata("v1beta1.metrics.k8s.io"),
      spec: { service: { namespace: "kube-system", name: "metrics-server" } },
      status: { conditions: [{ type: "Available", status: "False", reason: "MissingEndpoints" }] },
    });
    const local = new APIService({
      apiVersion: "apiregistration.k8s.io/v1",
      kind: "APIService",
      metadata: metadata("v1."),
      spec: {},
      status: { conditions: [condition("Available")] },
    });

    expect(service.getServiceName()).toBe("kube-system/metrics-server");
    expect(service.getAvailability()).toBe("False (MissingEndpoints)");
    expect(local.getServiceName()).toBe("Local");
    expect(local.getAvailability()).toBe("True");
  });
});

describe("the kinds with fields beside spec", () => {
  it("keep them", () => {
    const template = new PodTemplate({
      apiVersion: "v1",
      kind: "PodTemplate",
      metadata: metadata("t", "a"),
      template: { spec: { containers: [{ name: "app", image: "nginx" }] } },
    });
    const revision = new ControllerRevision({
      apiVersion: "apps/v1",
      kind: "ControllerRevision",
      metadata: {
        ...metadata("web-5d8f", "a"),
        ownerReferences: [{ apiVersion: "apps/v1", kind: "StatefulSet", name: "web", uid: "u", controller: true }],
      },
      revision: 3,
      data: { spec: {} },
    });
    const attributes = new VolumeAttributesClass({
      apiVersion: "storage.k8s.io/v1",
      kind: "VolumeAttributesClass",
      metadata: metadata("fast"),
      driverName: "ebs.csi.aws.com",
      parameters: { iops: "3000" },
    });

    expect(template.getContainers()).toEqual([{ name: "app", image: "nginx" }]);
    expect(revision.revision).toBe(3);
    expect(revision.getController()).toBe("StatefulSet/web");
    expect(attributes.driverName).toBe("ebs.csi.aws.com");
    expect(attributes.parameters).toEqual({ iops: "3000" });
  });
});

describe("IPAddress, DeviceTaintRule and ClusterTrustBundle", () => {
  it("describe their parent, taint and certificates", () => {
    const address = new IPAddress({
      apiVersion: "networking.k8s.io/v1",
      kind: "IPAddress",
      metadata: metadata("10.96.0.1"),
      spec: { parentRef: { group: "", resource: "services", namespace: "default", name: "kubernetes" } },
    });
    const rule = new DeviceTaintRule({
      apiVersion: "resource.k8s.io/v1",
      kind: "DeviceTaintRule",
      metadata: metadata("maintenance"),
      spec: { taint: { key: "maintenance", value: "true", effect: "NoSchedule" } },
    });
    const bundle = new ClusterTrustBundle({
      apiVersion: "certificates.k8s.io/v1",
      kind: "ClusterTrustBundle",
      metadata: metadata("roots"),
      spec: {
        trustBundle:
          "-----BEGIN CERTIFICATE-----\nA\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nB\n-----END CERTIFICATE-----\n",
      },
    });

    expect(address.getParent()).toBe("services default/kubernetes");
    expect(rule.getTaint()).toBe("maintenance=true:NoSchedule");
    expect(bundle.getCertificateCount()).toBe(2);
  });
});
