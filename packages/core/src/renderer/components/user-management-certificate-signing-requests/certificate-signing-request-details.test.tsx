/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { CertificateSigningRequest } from "@freelensapp/kube-object";
import { describe, expect, it } from "vitest";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import storesAndApisCanBeCreatedInjectable from "../../stores-apis-can-be-created.injectable";
import { renderFor } from "../test-utils/renderFor";
import { CertificateSigningRequestDetails } from "./certificate-signing-request-details";

const request = (conditions: { type: string; status: string }[]) =>
  new CertificateSigningRequest({
    apiVersion: "certificates.k8s.io/v1",
    kind: "CertificateSigningRequest",
    metadata: {
      name: "csr-1",
      uid: "u",
      resourceVersion: "1",
      selfLink: "/apis/certificates.k8s.io/v1/certificatesigningrequests/csr-1",
    },
    spec: {
      signerName: "kubernetes.io/kube-apiserver-client",
      username: "alice",
      groups: ["system:authenticated"],
      usages: ["client auth"],
      expirationSeconds: 86400,
    },
    status: { conditions },
  });

const renderDetails = (object: CertificateSigningRequest) => {
  const di = getDiForUnitTesting();

  // The actions reach the request's API.
  di.override(storesAndApisCanBeCreatedInjectable, () => true);

  return renderFor(di)(<CertificateSigningRequestDetails object={object} />);
};

describe("CertificateSigningRequestDetails", () => {
  it("offers Approve and Deny for a pending request", () => {
    const result = renderDetails(request([]));

    expect(result.getByTestId("csr-actions")).toBeTruthy();
    expect(result.getByText("Approve")).toBeTruthy();
    expect(result.getByText("Deny")).toBeTruthy();
    expect(result.getByText("alice")).toBeTruthy();
    expect(result.getByText("86400s")).toBeTruthy();
  });

  it("does not offer them once the request is decided", () => {
    const result = renderDetails(request([{ type: "Approved", status: "True" }]));

    expect(result.queryByTestId("csr-actions")).toBeNull();
    expect(result.getAllByText("Approved").length).toBeGreaterThan(0);
  });
});
