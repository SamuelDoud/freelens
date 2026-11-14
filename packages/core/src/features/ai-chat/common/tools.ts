/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * What a tool does: `read` reads the cluster, `navigate` drives the Freelens window, and `change`
 * changes the cluster. Change tools are given to the model only while the chat allows changes.
 */
export type AiToolAccess = "read" | "navigate" | "change";

export interface AiToolSpec {
  readonly name: string;
  readonly access: AiToolAccess;
  readonly description: string;
  /** A JSON Schema object for the arguments. */
  readonly inputSchema: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required?: readonly string[];
    readonly additionalProperties?: boolean;
  };
}

const kindProperties = {
  kind: { type: "string", description: 'The kind, e.g. "Pod", "Deployment", or a custom resource kind.' },
  apiGroup: {
    type: "string",
    description: 'The API group, when the kind is ambiguous (e.g. "apps"); omit it for the core group.',
  },
};

const objectProperties = {
  ...kindProperties,
  name: { type: "string" },
  namespace: { type: "string", description: "The namespace of a namespaced object." },
};

export const aiTools: readonly AiToolSpec[] = [
  {
    name: "get_current_view",
    access: "read",
    description:
      "What the user is looking at in Freelens: the path of the view, the selected namespaces, the quick search, and the object whose details are open.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_resource_kinds",
    access: "read",
    description: "The kinds of resources the cluster serves, with their API group, version and scope.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Keep only kinds whose name or group contains this." } },
      additionalProperties: false,
    },
  },
  {
    name: "list_resources",
    access: "read",
    description:
      "List objects of a kind as a compact table (name, namespace, age, and status for common kinds). Filter as narrowly as you can.",
    inputSchema: {
      type: "object",
      properties: {
        ...kindProperties,
        namespace: { type: "string", description: "Only this namespace; omit for all namespaces." },
        labelSelector: { type: "string" },
        fieldSelector: { type: "string", description: 'e.g. "status.phase!=Running" or "spec.nodeName=node-1".' },
        nameContains: { type: "string" },
        limit: { type: "number", description: "At most this many rows (default 100, at most 500)." },
      },
      required: ["kind"],
      additionalProperties: false,
    },
  },
  {
    name: "get_resource",
    access: "read",
    description: "One object as YAML, without managed fields. Secret values are redacted.",
    inputSchema: {
      type: "object",
      properties: objectProperties,
      required: ["kind", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_events",
    access: "read",
    description: "Recent events, newest first, optionally only those about one object.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string" },
        kind: { type: "string", description: "The kind of the object the events are about." },
        name: { type: "string", description: "The name of the object the events are about." },
        warningsOnly: { type: "boolean" },
        limit: { type: "number", description: "At most this many events (default 50)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_pod_logs",
    access: "read",
    description: "The last lines of a pod container's log.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        namespace: { type: "string" },
        container: { type: "string", description: "Required when the pod has more than one container." },
        tailLines: { type: "number", description: "Default 100, at most 1000." },
        previous: { type: "boolean", description: "The log of the previous, terminated container." },
      },
      required: ["name", "namespace"],
      additionalProperties: false,
    },
  },
  {
    name: "open_view",
    access: "navigate",
    description:
      'Open the list view of a kind in the Freelens window, or one of the views "cluster-overview", "workloads-overview", "helm-releases", "helm-charts", "port-forwards".',
    inputSchema: {
      type: "object",
      properties: {
        ...kindProperties,
        view: { type: "string", description: "A named view instead of a kind." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "show_details",
    access: "navigate",
    description: "Open the details panel of one object in the Freelens window.",
    inputSchema: {
      type: "object",
      properties: objectProperties,
      required: ["kind", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "select_namespaces",
    access: "navigate",
    description: "Select the namespaces the Freelens lists show; an empty list selects all namespaces.",
    inputSchema: {
      type: "object",
      properties: { namespaces: { type: "array", items: { type: "string" } } },
      required: ["namespaces"],
      additionalProperties: false,
    },
  },
  {
    name: "set_search",
    access: "navigate",
    description: "Set the quick search text of the list view; an empty text clears it.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "set_advanced_search",
    access: "navigate",
    description:
      'Replace the advanced search conditions of a kind\'s list view and open it. Fields: "name", "namespace", "labels" (key=value), "annotations", "owner" (Kind/name), "age", "any"; Pods also "status", "controlledBy", "node", "ip", "qos", "restarts", "image"; Events "type", "reason", "message", "lastSeen". Conditions on one field are ORed, different fields ANDed, negated ones always ANDed. Text operators: exactly, startsWith, contains, regex. Time operators for age/lastSeen: on, before, after (a local date-time like 2026-11-14T09:00) and olderThan, newerThan (a duration like 30m, 2h, 3d, 1w).',
    inputSchema: {
      type: "object",
      properties: {
        ...kindProperties,
        conditions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              operator: { type: "string" },
              value: { type: "string" },
              negate: { type: "boolean" },
            },
            required: ["field", "operator", "value"],
          },
        },
      },
      required: ["kind", "conditions"],
      additionalProperties: false,
    },
  },
  {
    name: "scale_workload",
    access: "change",
    description: "Set the replicas of a Deployment, StatefulSet or ReplicaSet.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["Deployment", "StatefulSet", "ReplicaSet"] },
        name: { type: "string" },
        namespace: { type: "string" },
        replicas: { type: "number" },
      },
      required: ["kind", "name", "namespace", "replicas"],
      additionalProperties: false,
    },
  },
  {
    name: "restart_workload",
    access: "change",
    description: "Restart the pods of a Deployment, StatefulSet or DaemonSet with a rolling restart.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["Deployment", "StatefulSet", "DaemonSet"] },
        name: { type: "string" },
        namespace: { type: "string" },
      },
      required: ["kind", "name", "namespace"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_resource",
    access: "change",
    description: "Delete one object.",
    inputSchema: {
      type: "object",
      properties: objectProperties,
      required: ["kind", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "patch_resource",
    access: "change",
    description:
      'Patch one object. patchType "merge" takes a JSON merge patch object, "strategic" a strategic merge patch object (built-in kinds only), "json" a JSON Patch array.',
    inputSchema: {
      type: "object",
      properties: {
        ...objectProperties,
        patchType: { type: "string", enum: ["merge", "strategic", "json"] },
        patch: { description: "The patch: an object, or an array for a JSON Patch." },
      },
      required: ["kind", "name", "patchType", "patch"],
      additionalProperties: false,
    },
  },
  {
    name: "set_node_schedulable",
    access: "change",
    description: "Cordon (schedulable false) or uncordon (schedulable true) a node. It does not drain the node.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, schedulable: { type: "boolean" } },
      required: ["name", "schedulable"],
      additionalProperties: false,
    },
  },
];

export const findAiTool = (name: string) => aiTools.find((tool) => tool.name === name);

/** The tools the model is given: the change tools only while the chat allows changes. */
export const getAvailableAiTools = (allowChanges: boolean) =>
  aiTools.filter((tool) => allowChanges || tool.access !== "change");
