/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// Release Secrets as Helm 4 writes them, for the cases `helm ls` has rules for. `helm-ls-synthetic.json` is what the
// bundled `helm ls` (4.3.2) printed for these Secrets on a fake API server, with TZ=UTC.

import { gzipSync } from "node:zlib";

import type { ReleaseSecretLike } from "../list-releases-from-secrets";

let uidCounter = 0;

export interface ReleaseSpec {
  name: string;
  namespace: string;
  version: number;
  status: string;
  chart?: { name: string; version: string; appVersion?: string } | null | "nometadata";
  lastDeployed?: string;
  omitVersion?: boolean;
}

interface ReleaseBody {
  name: string;
  info: Record<string, unknown> & { status: string; last_deployed?: string };
  chart?: unknown;
  manifest: string;
  config: unknown;
  version?: number;
  namespace: string;
}

export function releaseBody({
  name,
  namespace,
  version,
  status,
  chart,
  lastDeployed,
  omitVersion = false,
}: ReleaseSpec): ReleaseBody {
  const body: ReleaseBody = {
    name,
    info: { first_deployed: "2025-01-01T00:00:00Z", status, description: "x" },
    chart:
      chart === null
        ? undefined
        : chart === "nometadata"
          ? {}
          : {
              metadata: {
                name: chart?.name ?? "chart",
                version: chart?.version ?? "1.0.0",
                ...(chart?.appVersion !== undefined && { appVersion: chart.appVersion }),
                apiVersion: "v2",
              },
              templates: [],
            },
    manifest: "kind: ConfigMap\n",
    config: { password: "synthetic" },
    version: omitVersion ? undefined : version,
    namespace,
  };
  if (lastDeployed !== undefined) body.info.last_deployed = lastDeployed;
  return body;
}

export function toSecret(
  body: ReleaseBody,
  {
    corruptData = false,
    namespace = body.namespace,
    resourceVersion,
  }: { corruptData?: boolean; namespace?: string; resourceVersion?: string } = {},
): ReleaseSecretLike & { type: string } {
  const json = Buffer.from(JSON.stringify(body));
  const inner = gzipSync(json, { level: 9 });
  const helmValue = Buffer.from(corruptData ? "not-base64-@@@" : inner.toString("base64"));
  uidCounter += 1;
  return {
    metadata: {
      name: `sh.helm.release.v1.${body.name}.v${body.version ?? 0}`,
      namespace,
      uid: `uid-${uidCounter}`,
      resourceVersion: resourceVersion ?? String(1000 + uidCounter),
      labels: {
        name: body.name,
        owner: "helm",
        status: body.info.status,
        version: String(body.version ?? 0),
        modifiedAt: "1",
      },
    },
    type: "helm.sh/release.v1",
    data: { release: helmValue.toString("base64") },
  };
}

const t = (i: number, offset = "Z", frac = "") =>
  `2026-0${1 + (i % 9)}-1${i % 10}T0${i % 10}:${10 + (i % 40)}:${10 + (i % 49)}${frac}${offset}`;

/** Several families of cases, each as a list of Secrets. */
export function syntheticCases() {
  const items: (ReleaseSecretLike & { type: string })[] = [];
  const add = (spec: ReleaseSpec, opts?: Parameters<typeof toSecret>[1]) =>
    items.push(toSecret(releaseBody(spec), opts));
  let i = 0;
  // several revisions, the latest deployed
  for (let v = 1; v <= 6; v++)
    add({
      name: "multi",
      namespace: "ns-a",
      version: v,
      status: v === 6 ? "deployed" : "superseded",
      chart: { name: "app", version: `1.${v}.0`, appVersion: `v${v}` },
      lastDeployed: t(v, "-07:00", ".5"),
    });
  // the latest failed, an earlier one deployed
  add({
    name: "failed-latest",
    namespace: "ns-a",
    version: 1,
    status: "superseded",
    chart: { name: "f", version: "0.1.0" },
    lastDeployed: t(1),
  });
  add({
    name: "failed-latest",
    namespace: "ns-a",
    version: 2,
    status: "deployed",
    chart: { name: "f", version: "0.1.0" },
    lastDeployed: t(2),
  });
  add({
    name: "failed-latest",
    namespace: "ns-a",
    version: 3,
    status: "failed",
    chart: { name: "f", version: "0.2.0" },
    lastDeployed: t(3, "+05:30", ".123456789"),
  });
  // pending states
  for (const [n, s] of [
    ["pend-install", "pending-install"],
    ["pend-upgrade", "pending-upgrade"],
    ["pend-rollback", "pending-rollback"],
    ["uninstalling-r", "uninstalling"],
    ["gone-kept", "uninstalled"],
    ["superseded-only", "superseded"],
    ["unknown-r", "unknown"],
    ["weird-status", "mystery"],
  ]) {
    add({
      name: n,
      namespace: "ns-b",
      version: 1,
      status: "superseded",
      chart: { name: n, version: "1.0.0" },
      lastDeployed: t(1),
    });
    add({
      name: n,
      namespace: "ns-b",
      version: 2,
      status: s,
      chart: { name: n, version: "1.0.1", appVersion: "9" },
      lastDeployed: t(++i, "+00:00"),
    });
  }
  // uninstalled with history kept, rolled back earlier
  add({
    name: "hist",
    namespace: "ns-b",
    version: 1,
    status: "deployed",
    chart: { name: "h", version: "2.0.0" },
    lastDeployed: t(4, "+01:00"),
  });
  add({
    name: "hist",
    namespace: "ns-b",
    version: 2,
    status: "superseded",
    chart: { name: "h", version: "2.0.1" },
    lastDeployed: t(5, "+01:00"),
  });
  add({
    name: "hist",
    namespace: "ns-b",
    version: 3,
    status: "uninstalled",
    chart: { name: "h", version: "2.0.1" },
    lastDeployed: t(6, "+01:00"),
  });
  // two-digit revisions sort numerically, not as text
  for (let v = 1; v <= 12; v++)
    add({
      name: "twelve",
      namespace: "ns-c",
      version: v,
      status: v === 12 ? "deployed" : "superseded",
      chart: { name: "t", version: "3.0.0-rc.1+build.5" },
      lastDeployed: t(v),
    });
  // same name in many namespaces
  for (let n = 0; n < 60; n++)
    add({
      name: n % 3 ? "shared" : "Shared.Name-x",
      namespace: `team-${n}`,
      version: 1 + (n % 4),
      status: "deployed",
      chart: { name: "s", version: "1.0.0" },
      lastDeployed: t(n, n % 2 ? "-08:00" : "Z"),
    });
  // chart oddities and times
  add({ name: "no-chart", namespace: "ns-d", version: 1, status: "deployed", chart: null, lastDeployed: t(1) });
  add({
    name: "no-metadata",
    namespace: "ns-d",
    version: 1,
    status: "deployed",
    chart: "nometadata",
    lastDeployed: t(1),
  });
  add({ name: "no-time", namespace: "ns-d", version: 1, status: "deployed", chart: { name: "c", version: "1" } });
  add({
    name: "empty-time",
    namespace: "ns-d",
    version: 1,
    status: "deployed",
    chart: { name: "c", version: "1" },
    lastDeployed: "",
  });
  add({
    name: "zero-time",
    namespace: "ns-d",
    version: 1,
    status: "deployed",
    chart: { name: "c", version: "1" },
    lastDeployed: "0001-01-01T00:00:00Z",
  });
  add({
    name: "frac-0",
    namespace: "ns-d",
    version: 1,
    status: "deployed",
    chart: { name: "c", version: "1", appVersion: "" },
    lastDeployed: "2026-05-05T05:05:05.000Z",
  });
  add({
    name: "frac-3",
    namespace: "ns-d",
    version: 1,
    status: "deployed",
    chart: { name: "c", version: "1" },
    lastDeployed: "2026-05-05T05:05:05.120+09:00",
  });
  add({
    name: "frac-9",
    namespace: "ns-d",
    version: 1,
    status: "deployed",
    chart: { name: "c", version: "1" },
    lastDeployed: "2026-05-05T05:05:05.000000001-03:30",
  });
  add({
    name: "no-version-field",
    namespace: "ns-d",
    version: 0,
    omitVersion: true,
    status: "deployed",
    chart: { name: "c", version: "1" },
    lastDeployed: t(1),
  });
  // a pre-compression release: plain JSON in base64
  {
    const body = releaseBody({
      name: "plain-json",
      namespace: "ns-d",
      version: 1,
      status: "deployed",
      chart: { name: "p", version: "1" },
      lastDeployed: t(2),
    });
    const secret = toSecret(body);

    secret.data = { release: Buffer.from(Buffer.from(JSON.stringify(body)).toString("base64")).toString("base64") };
    items.push(secret);
  }
  // noise: not helm secrets, a non-latest revision that does not decode (helm skips it)
  items.push({
    metadata: { name: "tls", namespace: "ns-d", uid: "u-noise", resourceVersion: "5", labels: { app: "x" } },
    type: "kubernetes.io/tls",
    data: { "tls.crt": "eA==" },
  });
  add(
    {
      name: "bad-old",
      namespace: "ns-d",
      version: 1,
      status: "superseded",
      chart: { name: "c", version: "1" },
      lastDeployed: t(1),
    },
    { corruptData: true },
  );
  add({
    name: "bad-old",
    namespace: "ns-d",
    version: 2,
    status: "deployed",
    chart: { name: "c", version: "2" },
    lastDeployed: t(2),
  });
  return items;
}
