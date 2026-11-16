/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { isClusterTrustBundle } from "./cluster-trust-bundle-details-item.injectable";
import { isDeviceClass } from "./device-class-details-item.injectable";
import { isIPAddress } from "./ip-address-details-item.injectable";
import { isMutatingAdmissionPolicy } from "./mutating-admission-policies-details-item.injectable";
import { isPodCertificateRequest } from "./pod-certificate-request-details-item.injectable";
import { isResourceSlice } from "./resource-slice-details-item.injectable";
import { isServiceCIDR } from "./service-cidr-details-item.injectable";
import { isStorageVersionMigration } from "./storage-version-migration-details-item.injectable";
import { isValidatingAdmissionPolicy } from "./validating-admission-policies-details-item.injectable";
import { isVolumeAttributesClass } from "./volume-attributes-class-details-item.injectable";

import type { KubeObject } from "@freelensapp/kube-object";

const object = (kind: string, apiVersion: string) => ({ kind, apiVersion }) as KubeObject;

describe("details items for kinds an older cluster serves under a beta version", () => {
  it.each([
    [isDeviceClass, "DeviceClass", "resource.k8s.io/v1beta1"],
    [isResourceSlice, "ResourceSlice", "resource.k8s.io/v1beta2"],
    [isServiceCIDR, "ServiceCIDR", "networking.k8s.io/v1beta1"],
    [isIPAddress, "IPAddress", "networking.k8s.io/v1beta1"],
    [isVolumeAttributesClass, "VolumeAttributesClass", "storage.k8s.io/v1beta1"],
    [isClusterTrustBundle, "ClusterTrustBundle", "certificates.k8s.io/v1beta1"],
    [isPodCertificateRequest, "PodCertificateRequest", "certificates.k8s.io/v1alpha1"],
    [isStorageVersionMigration, "StorageVersionMigration", "storagemigration.k8s.io/v1beta1"],
    [isValidatingAdmissionPolicy, "ValidatingAdmissionPolicy", "admissionregistration.k8s.io/v1beta1"],
    [isMutatingAdmissionPolicy, "MutatingAdmissionPolicy", "admissionregistration.k8s.io/v1alpha1"],
  ])("%o matches %s of %s", (isFor, kind, apiVersion) => {
    expect(isFor(object(kind, apiVersion))).toBe(true);
  });
});
