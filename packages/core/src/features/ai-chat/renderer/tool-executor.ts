/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { dump } from "js-yaml";
import {
  anyFieldId,
  createConditionId,
  textSearchOperators,
  timeSearchOperators,
} from "../../advanced-search/common/conditions";
import { findAiTool } from "../common/tools";
import { describeApiError, formatAge, formatObjectTable, sanitizeObject, truncate } from "./format";
import { apiVersionOf, collectionPath, namedViewPaths, objectPath, resolveResource, viewPathOf } from "./resources";

import type { KubeApiResource } from "../../../common/rbac";
import type { SearchCondition } from "../../advanced-search/common/conditions";
import type { AiToolResult } from "../common/channels";
import type { RawObject } from "./format";

export interface AiKubeClient {
  get: (path: string, query?: Record<string, string | number | boolean>) => Promise<unknown>;
  patch: (path: string, patch: unknown, contentType: string) => Promise<unknown>;
  del: (path: string) => Promise<unknown>;
}

export interface AiToolExecutorDependencies {
  knownResources: () => readonly KubeApiResource[];
  kube: AiKubeClient;
  navigate: (path: string) => void;
  showDetails: (selfLink: string) => void;
  currentLocation: () => { pathname: string; search: string };
  namespaces: { selected: () => readonly string[]; allSelected: () => boolean; select: (namespaces: string[]) => void };
  quickSearch: { get: () => string; set: (text: string) => void };
  advancedSearch: {
    get: (viewKey: string) => readonly SearchCondition[];
    set: (viewKey: string, conditions: SearchCondition[]) => void;
  };
  now: () => number;
}

/** What a chat decides for each call: whether it may change things, and the user's approval. */
export interface AiToolCallContext {
  allowChanges: () => boolean;
  /** Resolves true to go ahead. */
  approve: (description: string) => Promise<boolean>;
}

type Args = Record<string, unknown>;

class ToolError extends Error {}

const str = (args: Args, key: string, required = false): string | undefined => {
  const value = args[key];

  if (value === undefined || value === null || value === "") {
    if (required) throw new ToolError(`"${key}" is required.`);

    return undefined;
  }

  if (typeof value !== "string") throw new ToolError(`"${key}" must be a string.`);

  return value;
};

const num = (args: Args, key: string, fallback: number, max: number) => {
  const value = args[key];

  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.min(max, Math.floor(value))) : fallback;
};

const patchContentTypes: Record<string, string> = {
  merge: "application/merge-patch+json",
  strategic: "application/strategic-merge-patch+json",
  json: "application/json-patch+json",
};

const scalableKinds: Record<string, string> = {
  deployment: "Deployment",
  statefulset: "StatefulSet",
  replicaset: "ReplicaSet",
};
const restartableKinds: Record<string, string> = {
  deployment: "Deployment",
  statefulset: "StatefulSet",
  daemonset: "DaemonSet",
};

/** Runs the chat's tools against the cluster and the Freelens window of the cluster frame. */
export class AiToolExecutor {
  constructor(private readonly dependencies: AiToolExecutorDependencies) {}

  async execute(name: string, rawArgs: unknown, context: AiToolCallContext): Promise<AiToolResult> {
    const tool = findAiTool(name);

    if (!tool) {
      return { ok: false, text: `There is no tool ${name}.` };
    }

    // Checked here as well as where the tools are offered: the user can untick the box mid-turn.
    if (tool.access === "change" && !context.allowChanges()) {
      return { ok: false, text: 'Changes are not allowed in this chat: the user has to tick "Allow changes".' };
    }

    const args: Args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? (rawArgs as Args) : {};

    try {
      return { ok: true, text: truncate(await this.run(name, args, context)) };
    } catch (error) {
      return { ok: false, text: error instanceof ToolError ? error.message : describeApiError(error) };
    }
  }

  private resource(args: Args): KubeApiResource {
    const kind = str(args, "kind", true) as string;
    const group = str(args, "apiGroup");
    const resource = resolveResource(this.dependencies.knownResources(), kind, group);

    if (!resource) {
      throw new ToolError(
        `The cluster does not serve the kind ${kind}${group ? ` in the group ${group}` : ""}. Use list_resource_kinds.`,
      );
    }

    return resource;
  }

  private objectRef(args: Args) {
    const resource = this.resource(args);
    const name = str(args, "name", true) as string;
    const namespace = str(args, "namespace");

    if (resource.namespaced && !namespace) {
      throw new ToolError(`${resource.kind} is namespaced: "namespace" is required.`);
    }

    return {
      resource,
      name,
      namespace,
      path: objectPath(resource, name, namespace),
      label: `${resource.kind} ${namespace ? `${namespace}/` : ""}${name}`,
    };
  }

  private async change(context: AiToolCallContext, description: string, act: () => Promise<unknown>) {
    if (!(await context.approve(description))) {
      throw new ToolError(`The user rejected: ${description}`);
    }

    await act();

    return `Done: ${description}`;
  }

  private async run(name: string, args: Args, context: AiToolCallContext): Promise<string> {
    const { kube, now } = this.dependencies;

    switch (name) {
      case "get_current_view": {
        const { pathname, search } = this.dependencies.currentLocation();
        const params = new URLSearchParams(search);

        return dump({
          path: pathname,
          namespaces: this.dependencies.namespaces.allSelected() ? "all" : this.dependencies.namespaces.selected(),
          quickSearch: this.dependencies.quickSearch.get() || undefined,
          detailsOpenFor: params.get("kube-details") || undefined,
        });
      }

      case "list_resource_kinds": {
        const query = (str(args, "query") ?? "").toLowerCase();
        const kinds = this.dependencies
          .knownResources()
          .filter((resource) => !resource.apiName.includes("/"))
          .filter(
            (resource) => !query || resource.kind.toLowerCase().includes(query) || resource.group.includes(query),
          );
        const unique = new Map(
          kinds.map((resource) => [
            `${resource.group}/${resource.kind}`,
            resolveResource(kinds, resource.kind, resource.group),
          ]),
        );

        return [...unique.values()]
          .filter((resource): resource is KubeApiResource => resource !== undefined)
          .map(
            (resource) =>
              `${resource.kind}\t${apiVersionOf(resource)}\t${resource.namespaced ? "namespaced" : "cluster"}`,
          )
          .sort()
          .join("\n");
      }

      case "list_resources": {
        const resource = this.resource(args);
        const namespace = str(args, "namespace");
        const nameContains = str(args, "nameContains")?.toLowerCase();
        const limit = num(args, "limit", 100, 500);
        const query: Record<string, string> = {};
        const labelSelector = str(args, "labelSelector");
        const fieldSelector = str(args, "fieldSelector");

        if (labelSelector) query.labelSelector = labelSelector;
        if (fieldSelector) query.fieldSelector = fieldSelector;

        const list = (await kube.get(collectionPath(resource, namespace), query)) as RawObject;
        const items: RawObject[] = (list?.items ?? []).filter(
          (item: RawObject) =>
            !nameContains ||
            String(item.metadata?.name ?? "")
              .toLowerCase()
              .includes(nameContains),
        );
        const shown = items.slice(0, limit);
        const table = formatObjectTable(resource.kind, shown, now());

        return `${items.length} ${resource.kind}${items.length === 1 ? "" : "s"}${namespace ? ` in ${namespace}` : ""}${
          items.length > shown.length ? `, the first ${shown.length} shown` : ""
        }${table ? `\n${table}` : ""}`;
      }

      case "get_resource": {
        const { path } = this.objectRef(args);

        return dump(sanitizeObject((await kube.get(path)) as RawObject), { lineWidth: 160, noRefs: true });
      }

      case "get_events": {
        const namespace = str(args, "namespace");
        const kind = str(args, "kind");
        const objectName = str(args, "name");
        const selectors = [
          ...(kind ? [`involvedObject.kind=${kind}`] : []),
          ...(objectName ? [`involvedObject.name=${objectName}`] : []),
          ...(args.warningsOnly === true ? ["type=Warning"] : []),
        ];
        const list = (await kube.get(
          namespace ? `/api/v1/namespaces/${encodeURIComponent(namespace)}/events` : "/api/v1/events",
          selectors.length ? { fieldSelector: selectors.join(",") } : undefined,
        )) as RawObject;
        const time = (event: RawObject) =>
          Date.parse(event.lastTimestamp ?? event.eventTime ?? event.metadata?.creationTimestamp ?? "") || 0;
        const events: RawObject[] = [...(list?.items ?? [])].sort((left, right) => time(right) - time(left));
        const shown = events.slice(0, num(args, "limit", 50, 500));

        return [
          `${events.length} events${events.length > shown.length ? `, the newest ${shown.length} shown` : ""}`,
          ...shown.map((event) =>
            [
              formatAge(time(event), now()),
              event.type,
              event.reason,
              `${event.involvedObject?.kind}/${event.involvedObject?.namespace ? `${event.involvedObject.namespace}/` : ""}${event.involvedObject?.name}`,
              (event.count ?? 1) > 1 ? `(x${event.count})` : "",
              String(event.message ?? "").trim(),
            ]
              .filter(Boolean)
              .join("  "),
          ),
        ].join("\n");
      }

      case "get_pod_logs": {
        const podName = str(args, "name", true) as string;
        const namespace = str(args, "namespace", true) as string;
        const container = str(args, "container");
        const log = await kube.get(
          `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log`,
          {
            tailLines: num(args, "tailLines", 100, 1000),
            ...(container ? { container } : {}),
            ...(args.previous === true ? { previous: true } : {}),
          },
        );

        return typeof log === "string" ? log || "(the log is empty)" : JSON.stringify(log);
      }

      case "open_view": {
        const view = str(args, "view");
        const path = view ? namedViewPaths[view] : viewPathOf(this.resource(args));

        if (!path) {
          throw new ToolError(view ? `There is no view ${view}.` : "Freelens has no list view for this kind.");
        }

        this.dependencies.navigate(path);

        return `Opened ${path}`;
      }

      case "show_details": {
        const { path, label } = this.objectRef(args);

        this.dependencies.showDetails(path);

        return `Showing the details of ${label}`;
      }

      case "select_namespaces": {
        const namespaces = Array.isArray(args.namespaces)
          ? args.namespaces.filter((namespace): namespace is string => typeof namespace === "string")
          : [];

        this.dependencies.namespaces.select(namespaces);

        return namespaces.length ? `Selected the namespaces ${namespaces.join(", ")}` : "Selected all namespaces";
      }

      case "set_search": {
        const text = typeof args.text === "string" ? args.text : "";

        this.dependencies.quickSearch.set(text);

        return text ? `Searching for "${text}"` : "Cleared the search";
      }

      case "set_advanced_search": {
        const resource = this.resource(args);
        const path = viewPathOf(resource);
        const conditions = (Array.isArray(args.conditions) ? args.conditions : []).map((condition, index) =>
          this.toCondition(condition, index),
        );

        if (!path) {
          throw new ToolError("Freelens has no list view for this kind.");
        }

        this.dependencies.advancedSearch.set(`${apiVersionOf(resource)}/${resource.kind}`, conditions);
        this.dependencies.navigate(path);

        return `Set ${conditions.length} advanced search condition${conditions.length === 1 ? "" : "s"} on ${path}`;
      }

      case "scale_workload": {
        const kind = scalableKinds[String(args.kind).toLowerCase()];
        const replicas = args.replicas;

        if (!kind) throw new ToolError("Only a Deployment, StatefulSet or ReplicaSet can be scaled.");
        if (typeof replicas !== "number" || !Number.isInteger(replicas) || replicas < 0) {
          throw new ToolError('"replicas" must be a whole number of at least 0.');
        }

        const { path, label } = this.objectRef({ ...args, kind, apiGroup: "apps" });

        return this.change(context, `scale ${label} to ${replicas} replicas`, () =>
          kube.patch(`${path}/scale`, { spec: { replicas } }, patchContentTypes.merge),
        );
      }

      case "restart_workload": {
        const kind = restartableKinds[String(args.kind).toLowerCase()];

        if (!kind) throw new ToolError("Only a Deployment, StatefulSet or DaemonSet can be restarted.");

        const { path, label } = this.objectRef({ ...args, kind, apiGroup: "apps" });

        // What `kubectl rollout restart` does.
        return this.change(context, `restart ${label}`, () =>
          kube.patch(
            path,
            {
              spec: {
                template: {
                  metadata: { annotations: { "kubectl.kubernetes.io/restartedAt": new Date(now()).toISOString() } },
                },
              },
            },
            patchContentTypes.merge,
          ),
        );
      }

      case "delete_resource": {
        const { path, label } = this.objectRef(args);

        return this.change(context, `delete ${label}`, () => kube.del(path));
      }

      case "patch_resource": {
        const { path, label } = this.objectRef(args);
        const patchType = str(args, "patchType", true) as string;
        const contentType = patchContentTypes[patchType];

        if (!contentType) throw new ToolError('"patchType" must be merge, strategic or json.');
        if (patchType === "json" ? !Array.isArray(args.patch) : typeof args.patch !== "object" || args.patch === null) {
          throw new ToolError(
            patchType === "json" ? "A JSON Patch is an array of operations." : "The patch must be an object.",
          );
        }

        return this.change(context, `patch ${label} with ${JSON.stringify(args.patch)}`, () =>
          kube.patch(path, args.patch, contentType),
        );
      }

      case "set_node_schedulable": {
        const nodeName = str(args, "name", true) as string;
        const schedulable = args.schedulable === true;

        return this.change(context, `${schedulable ? "uncordon" : "cordon"} node ${nodeName}`, () =>
          kube.patch(
            `/api/v1/nodes/${encodeURIComponent(nodeName)}`,
            { spec: { unschedulable: !schedulable } },
            patchContentTypes.merge,
          ),
        );
      }

      default:
        throw new ToolError(`There is no tool ${name}.`);
    }
  }

  private toCondition(raw: unknown, index: number): SearchCondition {
    const condition = raw && typeof raw === "object" ? (raw as Args) : {};
    const field = str(condition, "field", true) as string;
    const operator = str(condition, "operator", true) as string;
    const value = typeof condition.value === "string" ? condition.value : String(condition.value ?? "");
    const negate = condition.negate === true;

    if (textSearchOperators.some(({ id }) => id === operator)) {
      return {
        id: createConditionId(),
        kind: "text",
        field: field === "any" ? anyFieldId : field,
        operator: operator as never,
        value,
        negate,
      };
    }

    if (timeSearchOperators.some(({ id }) => id === operator)) {
      return { id: createConditionId(), kind: "time", field, operator: operator as never, value, negate };
    }

    throw new ToolError(`Condition ${index + 1}: unknown operator "${operator}".`);
  }
}
