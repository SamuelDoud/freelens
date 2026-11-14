/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { MutatingAdmissionPolicyBinding } from "@freelensapp/kube-object";
import { beforeEach, describe, expect, it } from "vitest";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import { renderFor } from "../test-utils/renderFor";
import { MutatingAdmissionPolicyBindingDetails } from "./mutating-admission-policy-bindings-details";

import type {
  KubeJsonApiData,
  KubeObjectMetadata,
  KubeObjectScope,
  MutatingAdmissionPolicyBindingSpec,
} from "@freelensapp/kube-object";

import type { RenderResult } from "@testing-library/react";

import type { DiRender } from "../test-utils/renderFor";

const mutatingAdmissionPolicyBinding: KubeJsonApiData<
  KubeObjectMetadata<KubeObjectScope.Cluster>,
  void,
  MutatingAdmissionPolicyBindingSpec
> = {
  apiVersion: "admissionregistration.k8s.io/v1",
  kind: "MutatingAdmissionPolicyBinding",
  metadata: {
    name: "demo-binding.example.com",
    resourceVersion: "1",
    uid: "demo-binding.example.com",
    selfLink: "/apis/admissionregistration.k8s.io/v1/mutatingadmissionpolicybindings/demo-binding.example.com",
  },
  spec: {
    policyName: "demo-mutation.example.com",
    paramRef: {
      name: "sidecar-config",
      namespace: "default",
      parameterNotFoundAction: "Deny",
    },
    matchResources: {
      matchPolicy: "Equivalent",
      namespaceSelector: {
        matchLabels: { "kubernetes.io/metadata.name": "team-a" },
        matchExpressions: [{ key: "environment", operator: "In", values: ["dev", "test"] }],
      },
      resourceRules: [
        {
          apiGroups: ["apps"],
          apiVersions: ["v1"],
          operations: ["CREATE", "UPDATE"],
          resources: ["deployments"],
        },
      ],
    },
  },
};

describe("MutatingAdmissionPolicyBindingDetails", () => {
  let result: RenderResult;
  let render: DiRender;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    render = renderFor(di);
  });

  it("renders", () => {
    const binding = new MutatingAdmissionPolicyBinding(mutatingAdmissionPolicyBinding);

    result = render(<MutatingAdmissionPolicyBindingDetails object={binding} />);

    expect(result.baseElement).toMatchSnapshot();
  });

  it("renders with no param ref", () => {
    const binding = new MutatingAdmissionPolicyBinding({
      ...mutatingAdmissionPolicyBinding,
      spec: {
        policyName: "demo-mutation.example.com",
      },
    });

    result = render(<MutatingAdmissionPolicyBindingDetails object={binding} />);

    expect(result.baseElement).toMatchSnapshot();
  });
});
