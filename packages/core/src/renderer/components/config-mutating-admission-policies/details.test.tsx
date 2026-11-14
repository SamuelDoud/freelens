/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { MutatingAdmissionPolicy } from "@freelensapp/kube-object";
import { beforeEach, describe, expect, it } from "vitest";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import { renderFor } from "../test-utils/renderFor";
import { MutatingAdmissionPolicyDetails } from "./mutating-admission-policies-details";

import type {
  KubeJsonApiData,
  KubeObjectMetadata,
  KubeObjectScope,
  MutatingAdmissionPolicySpec,
} from "@freelensapp/kube-object";

import type { RenderResult } from "@testing-library/react";

import type { DiRender } from "../test-utils/renderFor";

const mutatingAdmissionPolicy: KubeJsonApiData<
  KubeObjectMetadata<KubeObjectScope.Cluster>,
  void,
  MutatingAdmissionPolicySpec
> = {
  apiVersion: "admissionregistration.k8s.io/v1",
  kind: "MutatingAdmissionPolicy",
  metadata: {
    name: "demo-mutation.example.com",
    resourceVersion: "1",
    uid: "demo-mutation.example.com",
    selfLink: "/apis/admissionregistration.k8s.io/v1/mutatingadmissionpolicies/demo-mutation.example.com",
  },
  spec: {
    failurePolicy: "Fail",
    paramKind: {
      apiVersion: "rules.example.com/v1",
      kind: "SidecarConfig",
    },
    matchConstraints: {
      matchPolicy: "Equivalent",
      resourceRules: [
        {
          apiGroups: ["apps"],
          apiVersions: ["v1"],
          operations: ["CREATE", "UPDATE"],
          resources: ["deployments"],
        },
      ],
    },
    matchConditions: [
      {
        name: "exclude-leases",
        expression: "!(request.resource.group == 'coordination.k8s.io' && request.resource.resource == 'leases')",
      },
    ],
    variables: [
      {
        name: "hasSidecar",
        expression: "object.spec.initContainers.exists(c, c.name == 'mesh-proxy')",
      },
    ],
    reinvocationPolicy: "IfNeeded",
    mutations: [
      {
        patchType: "ApplyConfiguration",
        applyConfiguration: {
          expression: "Object{ spec: Object.spec{ replicas: 1 } }",
        },
      },
      {
        patchType: "JSONPatch",
        jsonPatch: {
          expression: "[JSONPatch{ op: 'add', path: '/metadata/labels/mutated', value: 'true' }]",
        },
      },
    ],
  },
};

describe("MutatingAdmissionPolicyDetails", () => {
  let result: RenderResult;
  let render: DiRender;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    render = renderFor(di);
  });

  it("renders", () => {
    const policy = new MutatingAdmissionPolicy(mutatingAdmissionPolicy);

    result = render(<MutatingAdmissionPolicyDetails object={policy} />);

    expect(result.baseElement).toMatchSnapshot();
  });

  it("renders with no mutations", () => {
    const policy = new MutatingAdmissionPolicy({
      ...mutatingAdmissionPolicy,
      spec: {
        ...mutatingAdmissionPolicy.spec,
        mutations: [],
      },
    });

    result = render(<MutatingAdmissionPolicyDetails object={policy} />);

    expect(result.baseElement).toMatchSnapshot();
  });
});
