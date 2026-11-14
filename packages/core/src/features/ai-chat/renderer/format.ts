/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/** What the tools read from the API: plain JSON, loosely typed. */
export type RawObject = Record<string, any>;

/** "3d4h", "17m", "45s": the age format of kubectl. */
export function formatAge(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000));

  if (seconds < 120) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 120) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);

  if (hours < 48) return `${hours}h${minutes % 60 ? `${minutes % 60}m` : ""}`;

  const days = Math.floor(hours / 24);

  return `${days}d${hours % 24 ? `${hours % 24}h` : ""}`;
}

const createdAge = (object: RawObject, nowMs: number) => {
  const created = Date.parse(object.metadata?.creationTimestamp ?? "");

  return Number.isFinite(created) ? formatAge(created, nowMs) : "";
};

function podStatus(pod: RawObject): string {
  const statuses: RawObject[] = pod.status?.containerStatuses ?? [];
  const waiting = statuses.find((status) => status.state?.waiting?.reason)?.state.waiting.reason;
  const terminated = statuses.find((status) => status.state?.terminated?.reason)?.state.terminated.reason;

  if (pod.metadata?.deletionTimestamp) return "Terminating";

  return waiting ?? (pod.status?.phase === "Running" ? "Running" : (terminated ?? pod.status?.phase ?? ""));
}

/** The columns kubectl shows for the common kinds, after name and namespace. */
function statusColumns(kind: string, object: RawObject): Record<string, string | number> {
  const spec = object.spec ?? {};
  const status = object.status ?? {};

  switch (kind) {
    case "Pod": {
      const statuses: RawObject[] = status.containerStatuses ?? [];

      return {
        ready: `${statuses.filter((container) => container.ready).length}/${(spec.containers ?? []).length}`,
        status: podStatus(object),
        restarts: statuses.reduce((sum, container) => sum + (container.restartCount ?? 0), 0),
        node: spec.nodeName ?? "",
      };
    }
    case "Deployment":
    case "StatefulSet":
    case "ReplicaSet":
      return { ready: `${status.readyReplicas ?? 0}/${spec.replicas ?? 0}`, available: status.availableReplicas ?? 0 };
    case "DaemonSet":
      return { ready: `${status.numberReady ?? 0}/${status.desiredNumberScheduled ?? 0}` };
    case "Job":
      return {
        completions: `${status.succeeded ?? 0}/${spec.completions ?? 1}`,
        active: status.active ?? 0,
        failed: status.failed ?? 0,
      };
    case "CronJob":
      return {
        schedule: spec.schedule ?? "",
        suspend: String(spec.suspend ?? false),
        lastSchedule: status.lastScheduleTime ?? "",
      };
    case "Node": {
      const ready = (status.conditions ?? []).find((condition: RawObject) => condition.type === "Ready");

      return {
        status: `${ready?.status === "True" ? "Ready" : "NotReady"}${spec.unschedulable ? ",SchedulingDisabled" : ""}`,
        roles:
          Object.keys(object.metadata?.labels ?? {})
            .filter((label) => label.startsWith("node-role.kubernetes.io/"))
            .map((label) => label.slice("node-role.kubernetes.io/".length))
            .join(",") || "<none>",
        version: status.nodeInfo?.kubeletVersion ?? "",
      };
    }
    case "Service":
      return {
        type: spec.type ?? "",
        clusterIP: spec.clusterIP ?? "",
        ports: (spec.ports ?? []).map((port: RawObject) => `${port.port}/${port.protocol ?? "TCP"}`).join(","),
      };
    case "PersistentVolumeClaim":
      return {
        status: status.phase ?? "",
        capacity: status.capacity?.storage ?? "",
        storageClass: spec.storageClassName ?? "",
      };
    case "PersistentVolume":
      return {
        status: status.phase ?? "",
        capacity: spec.capacity?.storage ?? "",
        claim: spec.claimRef ? `${spec.claimRef.namespace}/${spec.claimRef.name}` : "",
      };
    case "Namespace":
      return { status: status.phase ?? "" };
    default:
      return {};
  }
}

/** A table of objects, one per line, tab-separated, with a header. */
export function formatObjectTable(kind: string, objects: readonly RawObject[], nowMs: number): string {
  const rows = objects.map((object) => ({
    name: object.metadata?.name ?? "",
    ...(object.metadata?.namespace ? { namespace: object.metadata.namespace } : {}),
    ...statusColumns(kind, object),
    age: createdAge(object, nowMs),
  }));

  if (rows.length === 0) {
    return "";
  }

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];

  return [
    columns.join("\t"),
    ...rows.map((row) => columns.map((column) => String((row as RawObject)[column] ?? "")).join("\t")),
  ].join("\n");
}

const lastAppliedAnnotation = "kubectl.kubernetes.io/last-applied-configuration";

/** A copy without managed fields and, for a Secret, without the values of its data. */
export function sanitizeObject(object: RawObject): RawObject {
  const copy: RawObject = structuredClone(object);

  if (copy.metadata) {
    delete copy.metadata.managedFields;
  }

  if (copy.kind === "Secret") {
    for (const field of ["data", "stringData"]) {
      if (copy[field] && typeof copy[field] === "object") {
        copy[field] = Object.fromEntries(
          Object.entries(copy[field] as Record<string, string>).map(([key, value]) => [
            key,
            `<redacted, ${String(value).length} characters>`,
          ]),
        );
      }
    }

    // It holds the data as it was applied.
    if (copy.metadata?.annotations?.[lastAppliedAnnotation]) {
      copy.metadata.annotations[lastAppliedAnnotation] = "<redacted>";
    }
  }

  return copy;
}

/** Long tool output is cut, so that one call cannot fill the model's context. */
export function truncate(text: string, maxCharacters = 40000): string {
  return text.length <= maxCharacters
    ? text
    : `${text.slice(0, maxCharacters)}\n… (${text.length - maxCharacters} more characters cut; narrow the request)`;
}

/** The message of an error the Kubernetes API or JsonApi throws. */
export function describeApiError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const record = error as RawObject;

    return String(record.message ?? record.reason ?? JSON.stringify(record));
  }

  return String(error);
}
