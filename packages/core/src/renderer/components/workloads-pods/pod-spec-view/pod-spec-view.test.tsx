/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Pod } from "@freelensapp/kube-object";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PodSpecView } from "./pod-spec-view";

const diffLinesMock = vi.hoisted(() => vi.fn());

vi.mock("./diff-lines", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./diff-lines")>();

  diffLinesMock.mockImplementation(actual.diffLines);

  return { ...actual, diffLines: diffLinesMock };
});

vi.mock("../../monaco-editor", () => ({ MonacoEditor: () => null }));

const pod = new Pod({
  apiVersion: "v1",
  kind: "Pod",
  metadata: { uid: "uid", name: "web-1", resourceVersion: "1", namespace: "default", selfLink: "/api/v1/pods/web-1" },
  spec: { containers: [{ name: "app", image: "app:1" }], nodeName: "node-1" },
} as never);

const owner = {
  ref: { kind: "ReplicaSet", name: "web", uid: "rs", apiVersion: "apps/v1" },
  apiPath: "/apis/apps/v1/rs",
};

describe("PodSpecView", () => {
  beforeEach(() => {
    diffLinesMock.mockClear();
  });

  it("shows the lines the pod has and its template has not, and diffs once however often it renders", async () => {
    const requestKubeResource = vi.fn().mockResolvedValue({
      callWasSuccessful: true,
      response: {
        spec: { template: { spec: { containers: [{ name: "app", image: "app:1" }] } } },
        getOwnerRefs: () => [],
      },
    });
    const { rerender } = render(<PodSpecView pod={pod} owner={owner} requestKubeResource={requestKubeResource} />);

    const diff = await screen.findByTestId("pod-spec-diff");

    expect(diff).toHaveTextContent("+ nodeName: node-1");
    expect(diffLinesMock).toHaveBeenCalledTimes(1);

    rerender(<PodSpecView pod={pod} owner={owner} requestKubeResource={requestKubeResource} />);
    rerender(<PodSpecView pod={pod} owner={owner} requestKubeResource={requestKubeResource} />);

    expect(diffLinesMock).toHaveBeenCalledTimes(1);
  });

  it("reads the template of the next pod's controller when it is shown in place of the first", async () => {
    const templateOf = (image: string) => ({
      callWasSuccessful: true,
      response: {
        spec: { template: { spec: { containers: [{ name: "app", image }] } } },
        getOwnerRefs: () => [],
      },
    });
    const requestKubeResource = vi.fn(async (apiPath: string) =>
      templateOf(apiPath.endsWith("/other") ? "app:2" : "app:1"),
    );
    const otherOwner = { ref: { ...owner.ref, name: "other", uid: "rs2" }, apiPath: "/apis/apps/v1/other" };
    const otherPod = new Pod({
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        uid: "uid2",
        name: "other-1",
        resourceVersion: "1",
        namespace: "default",
        selfLink: "/api/v1/pods/other-1",
      },
      spec: { containers: [{ name: "app", image: "app:2" }] },
    } as never);
    const { rerender } = render(<PodSpecView pod={pod} owner={owner} requestKubeResource={requestKubeResource} />);

    await screen.findByTestId("pod-spec-diff");
    rerender(<PodSpecView pod={otherPod} owner={otherOwner} requestKubeResource={requestKubeResource} />);

    await vi.waitFor(() => expect(requestKubeResource).toHaveBeenCalledWith("/apis/apps/v1/other"));
    expect(await screen.findByTestId("pod-spec-origin")).toHaveTextContent("ReplicaSet other");
    expect(screen.getByTestId("pod-spec-diff")).not.toHaveTextContent("app:1");
  });
});
