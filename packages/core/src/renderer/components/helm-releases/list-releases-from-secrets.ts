/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// Builds the rows `helm ls` prints from the release Secrets of the Helm secrets storage driver, the way Helm 4.3.2
// does (pkg/action/list.go, pkg/cmd/list.go, pkg/storage/driver/secrets.go and util.go):
//
// - every Secret labelled `owner=helm` holds one revision of one release, as base64 of base64 of gzip of JSON: the
//   Secret API's own base64 wraps the base64 text Helm stores;
// - only the latest revision of each release (by namespace and name) is listed, whatever its status;
// - revisions in the status `unknown` are left out, as is every status Helm does not list, which `helm ls` with the
//   state flags the application passes (all but unknown) does too;
// - rows are sorted by name and cut at the 9999 rows the application asks `helm ls` for.
//
// Only the latest revision of a release is decoded. The row is built from what the labels already tell, and the body
// is decoded only for that one revision, once per resourceVersion of its Secret.

import type { ListedHelmRelease } from "../../../features/helm-releases/common/channels";

/** The most rows the application asks `helm ls` for (`--max`). */
export const maximumListedReleases = 9999;

/** The statuses `helm ls` lists when it is given every state flag but unknown. */
const listedStatuses = new Set([
  "deployed",
  "uninstalled",
  "uninstalling",
  "pending-install",
  "pending-upgrade",
  "pending-rollback",
  "superseded",
  "failed",
]);

/** The part of a Secret this module reads. */
export interface ReleaseSecretLike {
  metadata: {
    uid?: string;
    name?: string;
    namespace?: string;
    resourceVersion?: string;
    labels?: Partial<Record<string, string>>;
  };
  data?: Partial<Record<string, string>>;
}

/** What a revision contributes to a row: the body of the release is not kept. */
export interface ReleaseSummary {
  name: string;
  namespace: string;
  version: number;
  status: string;
  chart: string;
  appVersion: string;
  updated: string;
}

export interface ReleaseSummaryCache {
  /** The summary of the Secret with this uid, valid for one resourceVersion. */
  entries: Map<string, { resourceVersion: string; summary: ReleaseSummary }>;
}

export const createReleaseSummaryCache = (): ReleaseSummaryCache => ({ entries: new Map() });

export type DecodeRelease = (secretValue: string) => Promise<unknown>;

const gzipMagic = [0x1f, 0x8b, 0x08];

const base64ToBytes = (text: string): Uint8Array => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

const gunzip = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();

  // Written and read together: awaiting the write first would wait for a reader that is not there yet.
  void writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => writer.close());

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    chunks.push(chunk.value);
    length += chunk.value.length;
  }

  const result = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
};

/**
 * Decodes the `release` value of a Secret as the Secret API gives it. Helm stores base64 text, which the API
 * encodes again; an old release that was stored before compression is plain JSON and is not unzipped.
 */
export const decodeRelease: DecodeRelease = async (secretValue) => {
  const helmValue = new TextDecoder().decode(base64ToBytes(secretValue));
  let bytes = base64ToBytes(helmValue);

  if (bytes.length > 3 && gzipMagic.every((byte, index) => bytes[index] === byte)) {
    bytes = await gunzip(bytes);
  }

  return JSON.parse(new TextDecoder().decode(bytes));
};

const pad = (value: number, length = 2) => String(Math.abs(value)).padStart(length, "0");

const formatOffset = (offsetMinutes: number) =>
  `${offsetMinutes < 0 ? "-" : "+"}${pad(Math.trunc(Math.abs(offsetMinutes) / 60))}${pad(Math.abs(offsetMinutes) % 60)}`;

// CLDR knows the abbreviation of a zone only in the locales where it is in common use (JST in Japanese, IST in en-IN),
// while the tz database Go reads has it in every locale, so the locales are tried in turn.
const abbreviationLocales = [
  "en-US",
  "en-GB",
  "en-IE",
  "en-AU",
  "en-CA",
  "en-NZ",
  "en-ZA",
  "en-IN",
  "en-SG",
  "ja",
  "ko",
  "zh",
];

let abbreviationFormatters: Intl.DateTimeFormat[] | undefined;

/** What Go calls the abbreviation of the local zone, to the extent Intl can tell. */
const localZoneName = (instant: Date, offsetMinutes: number) => {
  abbreviationFormatters ??= abbreviationLocales.map(
    (locale) => new Intl.DateTimeFormat(locale, { timeZoneName: "short" }),
  );

  for (const formatter of abbreviationFormatters) {
    const name = formatter.formatToParts(instant).find((part) => part.type === "timeZoneName")?.value;

    if (name && /^[A-Z]+$/.test(name)) {
      return name;
    }
  }

  // Go prints the offset for a zone without an abbreviation, hours only when the minutes are zero.
  const hours = pad(Math.trunc(Math.abs(offsetMinutes) / 60));
  const minutes = Math.abs(offsetMinutes) % 60;

  return `${offsetMinutes < 0 ? "-" : "+"}${hours}${minutes ? pad(minutes) : ""}`;
};

const rfc3339 = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:([Zz])|([+-])(\d{2}):(\d{2}))$/;

/**
 * Formats a release's `last_deployed` the way `helm ls` prints it, Go's `time.Time.String()`:
 * `2026-03-30 19:04:35.020334713 -0700 -0700`. The wall clock is the one stored with the release. The zone name is
 * the local zone's when the stored offset is the local offset at that instant, and the offset itself otherwise.
 * Go's own abbreviation of a local zone comes from the tz database, Intl's from CLDR: they differ for some zones
 * (and a consumer that strips the name, as `HelmRelease.getUpdated` does, does not see it).
 * The zero time and a missing time print as `-`.
 */
export const formatLastDeployed = (value: unknown): string => {
  if (typeof value !== "string" || value === "") {
    return "-";
  }

  const match = rfc3339.exec(value);

  if (!match) {
    throw new Error(`unparsable time ${value}`);
  }

  const [, year, month, day, hour, minute, second, fraction = "", utc, sign, offsetHour, offsetMinute] = match;

  if (year === "0001" && month === "01" && day === "01" && /^0+$/.test(`${hour}${minute}${second}${fraction}`)) {
    if (utc || (Number(offsetHour) === 0 && Number(offsetMinute) === 0)) {
      return "-";
    }
  }

  const trimmedFraction = fraction.replace(/0+$/, "");
  const wallClock = `${year}-${month}-${day} ${hour}:${minute}:${second}${trimmedFraction ? `.${trimmedFraction}` : ""}`;

  if (utc) {
    return `${wallClock} +0000 UTC`;
  }

  const offsetMinutes = (sign === "-" ? -1 : 1) * (Number(offsetHour) * 60 + Number(offsetMinute));
  const instant = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHour}:${offsetMinute}`);
  // getTimezoneOffset is positive west of UTC.
  const localOffsetMinutes = -instant.getTimezoneOffset();
  const offset = formatOffset(offsetMinutes);

  return `${wallClock} ${offset} ${localOffsetMinutes === offsetMinutes ? localZoneName(instant, offsetMinutes) : offset}`;
};

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The fields of a decoded release a row is built from, as `helm ls` builds them. */
export const summarizeRelease = (release: unknown): ReleaseSummary => {
  if (!isRecord(release) || !isRecord(release.info)) {
    throw new Error("a release without info");
  }

  const metadata = isRecord(release.chart) && isRecord(release.chart.metadata) ? release.chart.metadata : undefined;
  const version = release.version ?? 0;

  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new Error("a release without an integer version");
  }

  return {
    name: asString(release.name),
    namespace: asString(release.namespace),
    version,
    status: asString(release.info.status),
    chart: metadata ? `${asString(metadata.name)}-${asString(metadata.version)}` : "MISSING",
    appVersion: metadata ? asString(metadata.appVersion) : "MISSING",
    updated: formatLastDeployed(release.info.last_deployed),
  };
};

/** How many releases are decoded before the thread is given back. */
const decodeBatchSize = 50;

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The rows of `helm ls` for the given Secrets, or `undefined` when the Secrets do not tell reliably: there are no
 * release Secrets (another storage driver, or no release), the latest revision of a release cannot be told from the
 * labels or does not decode, or its body disagrees with its labels. The caller then asks `helm ls`.
 */
export const listReleasesFromSecrets = async (
  secrets: readonly ReleaseSecretLike[],
  cache: ReleaseSummaryCache,
  decode: DecodeRelease = decodeRelease,
): Promise<ListedHelmRelease[] | undefined> => {
  const latestByRelease = new Map<string, { secret: ReleaseSecretLike; version: number }>();

  for (const secret of secrets) {
    const labels = secret.metadata.labels;

    if (labels?.owner !== "helm") {
      continue;
    }

    const name = labels.name;
    const labelledVersion = labels.version;

    if (!name || !labelledVersion || !/^\d+$/.test(labelledVersion)) {
      return undefined;
    }

    const version = Number(labelledVersion);
    const key = `${secret.metadata.namespace ?? ""}/${name}`;
    const latest = latestByRelease.get(key);

    if (latest?.version === version) {
      return undefined;
    }

    if (!latest || latest.version < version) {
      latestByRelease.set(key, { secret, version });
    }
  }

  if (latestByRelease.size === 0) {
    return undefined;
  }

  const seen = new Set<string>();
  const summaries: ReleaseSummary[] = [];

  let decodedCount = 0;

  const summarize = async ({ secret, version }: { secret: ReleaseSecretLike; version: number }) => {
    const { uid = "", resourceVersion = "", namespace = "", labels } = secret.metadata;
    const cached = uid ? cache.entries.get(uid) : undefined;
    let summary = cached && resourceVersion && cached.resourceVersion === resourceVersion ? cached.summary : undefined;

    if (!summary) {
      const value = secret.data?.release;

      if (!value) {
        throw new Error("a release Secret without data");
      }

      decodedCount += 1;
      summary = summarizeRelease(await decode(value));

      if (uid && resourceVersion) {
        cache.entries.set(uid, { resourceVersion, summary });
      }
    }

    if (summary.name !== labels?.name || summary.namespace !== namespace || summary.version !== version) {
      throw new Error("a release that disagrees with the labels of its Secret");
    }

    seen.add(uid);
    summaries.push(summary);
  };

  try {
    const latest = [...latestByRelease.values()];

    // In batches, with the thread given back in between: decoding a cold cache of thousands of releases is
    // seconds of parsing that would otherwise freeze the window.
    for (let start = 0; start < latest.length; start += decodeBatchSize) {
      const decodedBefore = decodedCount;

      await Promise.all(latest.slice(start, start + decodeBatchSize).map(summarize));

      if (decodedCount > decodedBefore && start + decodeBatchSize < latest.length) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  } catch {
    return undefined;
  }

  for (const uid of cache.entries.keys()) {
    if (!seen.has(uid)) {
      cache.entries.delete(uid);
    }
  }

  return summaries
    .filter((summary) => listedStatuses.has(summary.status))
    .sort((a, b) => compareText(a.name, b.name) || compareText(a.namespace, b.namespace))
    .slice(0, maximumListedReleases)
    .map((summary) => ({
      name: summary.name,
      namespace: summary.namespace,
      revision: String(summary.version),
      updated: summary.updated,
      status: summary.status,
      chart: summary.chart,
      app_version: summary.appVersion,
    }));
};
