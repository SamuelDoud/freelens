/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { loadRevisions } from "./load-revisions";

import type { HelmReleaseRevision } from "../../../../common/k8s-api/endpoints/helm-releases.api/request-history.injectable";

const revision = (n: number) => ({ revision: n }) as HelmReleaseRevision;

describe("loadRevisions", () => {
  it("returns the newest revision first", async () => {
    const result = await loadRevisions(
      async () => [revision(1), revision(3), revision(2)],
      "r",
      "ns",
      () => true,
    );

    expect(result).toEqual({ status: "loaded", revisions: [revision(3), revision(2), revision(1)] });
  });

  it("reports a failed request instead of rejecting", async () => {
    const error = new Error("no history");

    expect(
      await loadRevisions(
        async () => {
          throw error;
        },
        "r",
        "ns",
        () => true,
      ),
    ).toEqual({ status: "failed", error });
  });

  it("ignores a reply, or a failure, for a release the dialog has left", async () => {
    expect(
      await loadRevisions(
        async () => [revision(1)],
        "r",
        "ns",
        () => false,
      ),
    ).toEqual({ status: "stale" });
    expect(
      await loadRevisions(
        async () => {
          throw new Error("x");
        },
        "r",
        "ns",
        () => false,
      ),
    ).toEqual({ status: "stale" });
  });
});
