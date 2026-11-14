/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { object } from "@freelensapp/utilities";
import { apiResourceRecord } from "../../common/rbac";

import type { KubeResource } from "../../common/rbac";

export const ResourceNames: Record<KubeResource, string> = {
  namespaces: "Namespaces",
  nodes: "Nodes",
  events: "Events",
  leases: "Leases",
  resourcequotas: "Resource Quotas",
  services: "Services",
  secrets: "Secrets",
  configmaps: "Config Maps",
  ingresses: "Ingresses",
  ingressclasses: "Ingress Classes",
  networkpolicies: "Network Policies",
  persistentvolumeclaims: "Persistent Volume Claims",
  persistentvolumes: "Persistent Volumes",
  storageclasses: "Storage Classes",
  pods: "Pods",
  daemonsets: "Daemon Sets",
  deployments: "Deployments",
  statefulsets: "Stateful Sets",
  replicasets: "Replica Sets",
  replicationcontrollers: "Replication Controllers",
  jobs: "Jobs",
  cronjobs: "Cron Jobs",
  endpoints: "Endpoints",
  endpointslices: "Endpoint Slices",
  customresourcedefinitions: "Custom Resource Definitions",
  horizontalpodautoscalers: "Horizontal Pod Autoscalers",
  podsecuritypolicies: "Pod Security Policies",
  poddisruptionbudgets: "Pod Disruption Budgets",
  priorityclasses: "Priority Classes",
  runtimeclasses: "Runtime Classes",
  limitranges: "Limit Ranges",
  roles: "Roles",
  rolebindings: "Role Bindings",
  clusterrolebindings: "Cluster Role Bindings",
  clusterroles: "Cluster Roles",
  serviceaccounts: "Service Accounts",
  verticalpodautoscalers: "Vertical Pod Autoscalers",
  mutatingadmissionpolicies: "Mutating Admission Policies",
  mutatingadmissionpolicybindings: "Mutating Admission Policy Bindings",
  mutatingwebhookconfigurations: "Mutating Webhook Configurations",
  validatingadmissionpolicies: "Validating Admission Policies",
  validatingadmissionpolicybindings: "Validating Admission Policy Bindings",
  validatingwebhookconfigurations: "Validating Webhook Configurations",
  podtemplates: "Pod Templates",
  controllerrevisions: "Controller Revisions",
  flowschemas: "Flow Schemas",
  prioritylevelconfigurations: "Priority Levels",
  apiservices: "API Services",
  storageversionmigrations: "Storage Version Migrations",
  servicecidrs: "Service CIDRs",
  ipaddresses: "IP Addresses",
  volumeattributesclasses: "Volume Attributes Classes",
  volumeattachments: "Volume Attachments",
  csidrivers: "CSI Drivers",
  csinodes: "CSI Nodes",
  csistoragecapacities: "CSI Storage Capacities",
  certificatesigningrequests: "Certificate Signing Requests",
  clustertrustbundles: "Cluster Trust Bundles",
  podcertificaterequests: "Pod Certificate Requests",
  deviceclasses: "Device Classes",
  resourceslices: "Resource Slices",
  resourceclaims: "Resource Claims",
  resourceclaimtemplates: "Resource Claim Templates",
  devicetaintrules: "Device Taint Rules",
};

export const ResourceKindMap = object.fromEntries(
  object.entries(apiResourceRecord).map(([resource, { kind }]) => [kind, resource]),
);
