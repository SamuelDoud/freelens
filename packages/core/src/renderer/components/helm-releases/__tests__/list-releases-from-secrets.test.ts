/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  createReleaseSummaryCache,
  decodeRelease,
  formatLastDeployed,
  listReleasesFromSecrets,
  maximumListedReleases,
} from "../list-releases-from-secrets";
import expectedRows from "./helm-ls-synthetic.json";
import { releaseBody, syntheticCases, toSecret } from "./synthetic-release-secrets";

import type { ListedHelmRelease } from "../../../../features/helm-releases/common/channels";

const byNameThenNamespace = (rows: ListedHelmRelease[]) =>
  [...rows].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.namespace < b.namespace ? -1 : 1));

describe("listReleasesFromSecrets", () => {
  it("builds the rows `helm ls` printed for the same Secrets, field by field", async () => {
    const rows = await listReleasesFromSecrets(syntheticCases(), createReleaseSummaryCache());

    expect(rows).toBeDefined();
    // Helm leaves the order of equal names to chance, so ties are ordered by namespace on both sides.
    expect(rows?.map((row) => row.name)).toEqual(expectedRows.map((row) => row.name));
    expect(byNameThenNamespace(rows ?? [])).toEqual(byNameThenNamespace(expectedRows));
  });

  it("decodes only the latest revision of each release, once per resourceVersion", async () => {
    const secrets = syntheticCases();
    const decode = vi.fn(decodeRelease);
    const cache = createReleaseSummaryCache();

    await listReleasesFromSecrets(secrets, cache, decode);

    // One per release in the synthetic set that has a helm Secret, not one per revision.
    const releases = new Set(
      secrets
        .filter((s) => s.metadata.labels?.owner === "helm")
        .map((s) => `${s.metadata.namespace}/${s.metadata.labels?.name}`),
    );

    expect(decode).toHaveBeenCalledTimes(releases.size);

    await listReleasesFromSecrets(secrets, cache, decode);

    expect(decode).toHaveBeenCalledTimes(releases.size);

    const changed = secrets.find((s) => s.metadata.labels?.name === "multi" && s.metadata.labels.version === "6");

    changed!.metadata.resourceVersion = "new";
    await listReleasesFromSecrets(secrets, cache, decode);

    expect(decode).toHaveBeenCalledTimes(releases.size + 1);
  });

  it("forgets the Secrets that are gone", async () => {
    const secrets = syntheticCases();
    const cache = createReleaseSummaryCache();

    await listReleasesFromSecrets(secrets, cache);

    const before = cache.entries.size;

    await listReleasesFromSecrets(
      secrets.filter((s) => s.metadata.labels?.name !== "multi"),
      cache,
    );

    expect(cache.entries.size).toBe(before - 1);
  });

  it("hides what `helm ls` hides: unknown statuses", async () => {
    const rows = await listReleasesFromSecrets(syntheticCases(), createReleaseSummaryCache());
    const names = rows?.map((row) => row.name);

    expect(names).not.toContain("unknown-r");
    expect(names).not.toContain("weird-status");
    expect(names).toContain("gone-kept");
    expect(names).toContain("superseded-only");
  });

  it("falls back to helm when there are no release Secrets", async () => {
    expect(await listReleasesFromSecrets([], createReleaseSummaryCache())).toBeUndefined();
    expect(
      await listReleasesFromSecrets(
        [{ metadata: { name: "x", namespace: "a", labels: {} }, data: {} }],
        createReleaseSummaryCache(),
      ),
    ).toBeUndefined();
  });

  it("falls back to helm when the latest revision does not decode", async () => {
    const body = releaseBody({
      name: "r",
      namespace: "n",
      version: 1,
      status: "deployed",
      chart: { name: "c", version: "1" },
    });

    expect(
      await listReleasesFromSecrets([toSecret(body, { corruptData: true })], createReleaseSummaryCache()),
    ).toBeUndefined();
  });

  it("falls back to helm when a body disagrees with the labels of its Secret", async () => {
    const body = releaseBody({
      name: "r",
      namespace: "n",
      version: 1,
      status: "deployed",
      chart: { name: "c", version: "1" },
    });
    const secret = toSecret(body);

    secret.metadata.labels = { ...secret.metadata.labels, version: "2" };

    expect(await listReleasesFromSecrets([secret], createReleaseSummaryCache())).toBeUndefined();
    expect(
      await listReleasesFromSecrets([toSecret(body, { namespace: "elsewhere" })], createReleaseSummaryCache()),
    ).toBeUndefined();
  });

  it("falls back to helm when two Secrets claim the same revision", async () => {
    const body = releaseBody({
      name: "r",
      namespace: "n",
      version: 1,
      status: "deployed",
      chart: { name: "c", version: "1" },
    });

    expect(
      await listReleasesFromSecrets([toSecret(body), toSecret(body)], createReleaseSummaryCache()),
    ).toBeUndefined();
  });

  it("cuts the list where `helm ls --max` does", async () => {
    const secrets = Array.from({ length: maximumListedReleases + 3 }, (_, index) =>
      toSecret(
        releaseBody({
          name: `r-${String(index).padStart(5, "0")}`,
          namespace: "n",
          version: 1,
          status: "deployed",
          chart: { name: "c", version: "1" },
        }),
      ),
    );
    const rows = await listReleasesFromSecrets(secrets, createReleaseSummaryCache());

    expect(rows).toHaveLength(maximumListedReleases);
    expect(rows?.at(-1)?.name).toBe(`r-${String(maximumListedReleases - 1).padStart(5, "0")}`);
  });
});

describe("decodeRelease", () => {
  it("undoes the double base64 and the gzip", async () => {
    const json = JSON.stringify({ name: "x", version: 3 });
    const helmValue = gzipSync(json).toString("base64");

    expect(await decodeRelease(Buffer.from(helmValue).toString("base64"))).toEqual({ name: "x", version: 3 });
  });

  it("reads a release stored before compression", async () => {
    const helmValue = Buffer.from(JSON.stringify({ name: "x" })).toString("base64");

    expect(await decodeRelease(Buffer.from(helmValue).toString("base64"))).toEqual({ name: "x" });
  });
});

describe("formatLastDeployed", () => {
  it("prints Go's time string, trimming trailing zeros of the fraction", () => {
    expect(formatLastDeployed("2026-01-02T06:41:45.305994380Z")).toBe("2026-01-02 06:41:45.30599438 +0000 UTC");
    expect(formatLastDeployed("2026-01-02T06:41:45.000Z")).toBe("2026-01-02 06:41:45 +0000 UTC");
  });

  it("prints a dash for a missing or zero time", () => {
    expect(formatLastDeployed(undefined)).toBe("-");
    expect(formatLastDeployed("")).toBe("-");
    expect(formatLastDeployed("0001-01-01T00:00:00Z")).toBe("-");
  });
});
