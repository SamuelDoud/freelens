/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "@testing-library/jest-dom/vitest";

import { serviceAccountApiInjectable } from "@freelensapp/kube-api-specifics";
import { Pod } from "@freelensapp/kube-object";
import { beforeEach, describe, expect, it } from "vitest";
import directoryForLensLocalStorageInjectable from "../../../../common/directory-for-lens-local-storage/directory-for-lens-local-storage.injectable";
import { getDiForUnitTesting } from "../../../getDiForUnitTesting";
import currentlyInClusterFrameInjectable from "../../../routes/currently-in-cluster-frame.injectable";
import getMaybeDetailsUrlInjectable from "../../kube-detail-params/get-maybe-details-url.injectable";
import { renderFor } from "../../test-utils/renderFor";
import { PodDetails } from "../pod-details";

import type { DiRender } from "../../test-utils/renderFor";

const makePod = (serviceAccountName?: string) =>
  new Pod({
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: "some-pod",
      namespace: "default",
      resourceVersion: "1",
      selfLink: "/api/v1/namespaces/default/pods/some-pod",
      uid: "some-uid",
    },
    spec: {
      containers: [],
      ...(serviceAccountName ? { serviceAccountName } : {}),
    },
  });

describe("<PodDetails /> service account", () => {
  let render: DiRender;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    di.override(directoryForLensLocalStorageInjectable, () => "some-directory-for-lens-local-storage");

    di.override(serviceAccountApiInjectable, () => ({ formatUrlForNotListing: () => "/some-url" }) as any);

    di.override(currentlyInClusterFrameInjectable, () => true);
    di.override(getMaybeDetailsUrlInjectable, () => (url: string) => url);

    render = renderFor(di);
  });

  it("shows the service account of the pod", () => {
    const result = render(<PodDetails object={makePod("some-account")} />);

    expect(result.getByText("Service Account")).toBeInTheDocument();
    expect(result.getAllByText("some-account").length).toBeGreaterThan(0);
  });

  it("hides the service account when the pod has none", () => {
    const result = render(<PodDetails object={makePod()} />);

    expect(result.getByText("QoS Class")).toBeInTheDocument();
    expect(result.queryByText("Service Account")).not.toBeInTheDocument();
  });
});
