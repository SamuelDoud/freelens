/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { KubeApiResource } from "../../../common/rbac";

// Higher for a version the API server prefers: v2 > v1 > v1beta2 > v1beta1 > v1alpha1.
const versionRank = (version: string) => {
  const match = /^v(\d+)(?:(alpha|beta)(\d+))?$/.exec(version);

  if (!match) {
    return 0;
  }

  const [, major, stage, minor] = match;
  const stageRank = stage === "alpha" ? Number(minor) : stage === "beta" ? 100 + Number(minor) : 1000;

  return Number(major) * 10000 + stageRank;
};

// When a kind exists in several groups, the core and the Kubernetes groups come first.
const groupRank = (group: string) => (group === "" ? 0 : !group.includes(".") || group.endsWith(".k8s.io") ? 1 : 2);

/**
 * The resource for a kind, matched by kind or by plural name, case-insensitively, in the given
 * group or else in the most Kubernetes-like group, at the version the cluster prefers.
 */
export function resolveResource(
  known: readonly KubeApiResource[],
  kind: string,
  group?: string,
): KubeApiResource | undefined {
  const wanted = kind.trim().toLowerCase();
  const candidates = known.filter(
    (resource) =>
      !resource.apiName.includes("/") &&
      (resource.kind.toLowerCase() === wanted || resource.apiName.toLowerCase() === wanted) &&
      (group === undefined || resource.group === group),
  );

  return [...candidates].sort(
    (left, right) =>
      groupRank(left.group) - groupRank(right.group) || versionRank(right.version) - versionRank(left.version),
  )[0];
}

export const apiVersionOf = ({ group, version }: KubeApiResource) => (group ? `${group}/${version}` : version);

/** The API path of a resource's collection, in one namespace or across all of them. */
export function collectionPath(resource: KubeApiResource, namespace?: string) {
  const base = resource.group ? `/apis/${resource.group}/${resource.version}` : `/api/${resource.version}`;
  const scope = resource.namespaced && namespace ? `/namespaces/${encodeURIComponent(namespace)}` : "";

  return `${base}${scope}/${resource.apiName}`;
}

export const objectPath = (resource: KubeApiResource, name: string, namespace?: string) =>
  `${collectionPath(resource, namespace)}/${encodeURIComponent(name)}`;

/** The Freelens list view of the built-in kinds; custom resources have /crd/<group>/<plural>. */
export const kindViewPaths: Record<string, string> = {
  pod: "/pods",
  deployment: "/deployments",
  daemonset: "/daemonsets",
  statefulset: "/statefulsets",
  replicaset: "/replicasets",
  replicationcontroller: "/replication-controllers",
  job: "/jobs",
  cronjob: "/cronjobs",
  configmap: "/configmaps",
  secret: "/secrets",
  resourcequota: "/resourcequotas",
  limitrange: "/limitranges",
  horizontalpodautoscaler: "/hpa",
  verticalpodautoscaler: "/vpa",
  poddisruptionbudget: "/poddisruptionbudgets",
  priorityclass: "/priorityclasses",
  runtimeclass: "/runtimeclasses",
  lease: "/leases",
  mutatingwebhookconfiguration: "/mutatingwebhookconfigurations",
  validatingwebhookconfiguration: "/validatingwebhookconfigurations",
  validatingadmissionpolicy: "/validatingadmissionpolicies",
  validatingadmissionpolicybinding: "/validatingadmissionpolicybindings",
  mutatingadmissionpolicy: "/mutatingadmissionpolicies",
  mutatingadmissionpolicybinding: "/mutatingadmissionpolicybindings",
  service: "/services",
  endpoints: "/endpoints",
  endpointslice: "/endpoint-slices",
  ingress: "/ingresses",
  ingressclass: "/ingress-classes",
  networkpolicy: "/network-policies",
  persistentvolumeclaim: "/persistent-volume-claims",
  persistentvolume: "/persistent-volumes",
  storageclass: "/storage-classes",
  namespace: "/namespaces",
  event: "/events",
  node: "/nodes",
  serviceaccount: "/service-accounts",
  role: "/roles",
  clusterrole: "/cluster-roles",
  rolebinding: "/role-bindings",
  clusterrolebinding: "/cluster-role-bindings",
  customresourcedefinition: "/crd/definitions",
  podsecuritypolicy: "/pod-security-policies",
  podtemplate: "/pod-templates",
  controllerrevision: "/controller-revisions",
  flowschema: "/flow-schemas",
  prioritylevelconfiguration: "/priority-level-configurations",
  apiservice: "/api-services",
  storageversionmigration: "/storage-version-migrations",
  servicecidr: "/service-cidrs",
  ipaddress: "/ip-addresses",
  volumeattributesclass: "/volume-attributes-classes",
  volumeattachment: "/volume-attachments",
  csidriver: "/csi-drivers",
  csinode: "/csi-nodes",
  csistoragecapacity: "/csi-storage-capacities",
  certificatesigningrequest: "/certificate-signing-requests",
  clustertrustbundle: "/cluster-trust-bundles",
  podcertificaterequest: "/pod-certificate-requests",
  deviceclass: "/device-classes",
  resourceslice: "/resource-slices",
  resourceclaim: "/resource-claims",
  resourceclaimtemplate: "/resource-claim-templates",
  devicetaintrule: "/device-taint-rules",
};

export const namedViewPaths: Record<string, string> = {
  "cluster-overview": "/overview",
  "workloads-overview": "/workloads",
  "helm-releases": "/helm/releases",
  "helm-charts": "/helm/charts",
  "port-forwards": "/port-forwards",
};

/** The list view of a resource in Freelens, if it has one. */
export function viewPathOf(resource: KubeApiResource): string | undefined {
  const builtIn = kindViewPaths[resource.kind.toLowerCase()];

  if (builtIn) {
    return builtIn;
  }

  return resource.group.includes(".") && !resource.group.endsWith(".k8s.io")
    ? `/crd/${resource.group}/${resource.apiName}`
    : undefined;
}
