/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

export interface ResourceDefinition {
  /** What it is, in a sentence or two. */
  readonly text: string;
  /** The Kubernetes kind the view lists. */
  readonly kind?: string;
  /** Whether its objects live in a namespace or in the cluster as a whole. */
  readonly scope?: "Namespaced" | "Cluster";
}

const namespaced = (kind: string, text: string): ResourceDefinition => ({ text, kind, scope: "Namespaced" });

const clusterWide = (kind: string, text: string): ResourceDefinition => ({ text, kind, scope: "Cluster" });

/**
 * Short definitions of what the cluster's views show, keyed by the id of their sidebar item. The
 * tabs of a section use the same ids, so one definition serves both.
 */
export const resourceDefinitions: Readonly<Record<string, ResourceDefinition>> = {
  // Sections and views that list no single kind.
  "sidebar-item-favorites": { text: "The views you pinned, gathered in one place." },
  "favorites-overview-sidebar-item": { text: "The views you pinned, side by side." },
  "sidebar-item-cluster-overview": {
    text: "The cluster at a glance: how much CPU, memory and pods its nodes have and use, and what needs attention.",
  },
  "sidebar-item-workloads": {
    text: "The objects that run your containers: Pods, and the controllers that create and replace them.",
  },
  "sidebar-item-workloads-overview": { text: "How many workloads of each kind run, and how many are failing." },
  "sidebar-item-config": {
    text: "The configuration of applications and of the cluster: settings, secrets, quotas, policies and autoscaling.",
  },
  "sidebar-item-network": {
    text: "How traffic reaches Pods: Services, Ingresses, their endpoints and the rules that allow or deny it.",
  },
  "sidebar-item-storage": { text: "The volumes Pods keep data on, how they are provisioned and attached." },
  "sidebar-item-devices": {
    text: "Dynamic resource allocation: hardware such as GPUs that drivers offer and Pods claim.",
  },
  "sidebar-item-helm": {
    text: "Helm, the package manager of Kubernetes: the charts you can install and what is installed.",
  },
  "sidebar-item-user-management": {
    text: "Who may do what in the cluster: accounts, roles, the bindings that grant them, and certificates.",
  },
  "sidebar-item-custom-resources": {
    text: "Kinds that the cluster's extensions add to the Kubernetes API, defined by CustomResourceDefinitions.",
  },
  "sidebar-item-port-forwards": {
    text: "Ports of Pods and Services forwarded to this computer by Freelens, so that you can reach them locally.",
  },
  "sidebar-item-helm-charts": { text: "The packages in your Helm repositories, ready to install in the cluster." },
  "sidebar-item-helm-releases": {
    text: "The Helm charts installed in the cluster, each an installed release with its own history.",
  },

  // Cluster
  "sidebar-item-nodes": clusterWide(
    "Node",
    "A machine, physical or virtual, that runs Pods. The scheduler places each Pod on a node with room for it.",
  ),
  "sidebar-item-namespaces": clusterWide(
    "Namespace",
    "A named space that groups objects, so that names, access and quotas can be set per team or application.",
  ),
  "sidebar-item-events": namespaced(
    "Event",
    "A record of something that happened to an object, such as a Pod being scheduled or a container failing. Events expire after about an hour.",
  ),

  // Workloads
  "sidebar-item-pods": namespaced(
    "Pod",
    "The smallest unit Kubernetes runs: one or more containers that share a network address and volumes, scheduled together on one node.",
  ),
  "sidebar-item-deployments": namespaced(
    "Deployment",
    "Keeps a number of identical Pods running, and rolls out a new version by replacing them gradually through ReplicaSets.",
  ),
  "sidebar-item-daemon-sets": namespaced(
    "DaemonSet",
    "Runs one copy of a Pod on every node, or on each node that matches, such as a log collector or a network agent.",
  ),
  "sidebar-item-stateful-sets": namespaced(
    "StatefulSet",
    "Runs Pods that keep an identity: stable names, ordered start and stop, and a volume of their own each, as databases need.",
  ),
  "sidebar-item-replica-sets": namespaced(
    "ReplicaSet",
    "Keeps a set number of identical Pods running. A Deployment creates one per version and scales them during a rollout.",
  ),
  "sidebar-item-replication-controller": namespaced(
    "ReplicationController",
    "The original way to keep a number of Pods running, replaced by ReplicaSets and Deployments.",
  ),
  "sidebar-item-jobs": namespaced(
    "Job",
    "Runs Pods until a task completes successfully a set number of times, retrying the ones that fail.",
  ),
  "sidebar-item-cron-jobs": namespaced("CronJob", "Creates a Job on a repeating schedule, written like a cron line."),
  "sidebar-item-pod-templates": namespaced(
    "PodTemplate",
    "A stored description of a Pod that other objects can copy. Controllers usually carry their template inline instead.",
  ),
  "sidebar-item-controller-revisions": namespaced(
    "ControllerRevision",
    "A saved version of a StatefulSet's or DaemonSet's Pod template, which lets it roll back.",
  ),

  // Config
  "sidebar-item-config-maps": namespaced(
    "ConfigMap",
    "Settings stored as keys and values, which Pods read as environment variables or as files.",
  ),
  "sidebar-item-secrets": namespaced(
    "Secret",
    "Like a ConfigMap, for sensitive values such as passwords, tokens and keys. Values are base64-encoded, not encrypted, unless the cluster encrypts them at rest.",
  ),
  "sidebar-item-resource-quotas": namespaced(
    "ResourceQuota",
    "Limits how much CPU, memory, storage and how many objects a namespace may use in total.",
  ),
  "sidebar-item-limit-ranges": namespaced(
    "LimitRange",
    "Sets default, minimum and maximum resources for each Pod or container in a namespace.",
  ),
  "sidebar-item-horizontal-pod-autoscalers": namespaced(
    "HorizontalPodAutoscaler",
    "Adds or removes Pods of a workload to keep a metric, such as CPU use, near a target.",
  ),
  "sidebar-item-vertical-pod-autoscalers": namespaced(
    "VerticalPodAutoscaler",
    "Recommends, or sets, the CPU and memory requests of a workload's Pods from what they actually use.",
  ),
  "sidebar-item-pod-disruption-budgets": namespaced(
    "PodDisruptionBudget",
    "How many Pods of an application may be down at once during voluntary disruptions, such as draining a node.",
  ),
  "sidebar-item-priority-classes": clusterWide(
    "PriorityClass",
    "A priority for Pods: when the cluster is full, higher-priority Pods are scheduled first and may evict lower ones.",
  ),
  "sidebar-item-runtime-classes": clusterWide(
    "RuntimeClass",
    "Selects the container runtime configuration a Pod runs with, such as a sandboxed runtime.",
  ),
  "sidebar-item-leases": namespaced(
    "Lease",
    "A lightweight lock with a holder and an expiry, used for leader election and for nodes' heartbeats.",
  ),
  "sidebar-item-mutating-webhook-configurations": clusterWide(
    "MutatingWebhookConfiguration",
    "Webhooks the API server calls to change objects as they are created or updated, before they are stored.",
  ),
  "sidebar-item-validating-webhook-configurations": clusterWide(
    "ValidatingWebhookConfiguration",
    "Webhooks the API server calls to accept or reject objects as they are created, updated or deleted.",
  ),
  "sidebar-item-validating-admission-policies": clusterWide(
    "ValidatingAdmissionPolicy",
    "Rules written in CEL that the API server itself checks to accept or reject requests, without a webhook.",
  ),
  "sidebar-item-validating-admission-policy-bindings": clusterWide(
    "ValidatingAdmissionPolicyBinding",
    "Applies a ValidatingAdmissionPolicy to the resources and namespaces it selects, with its parameters.",
  ),
  "sidebar-item-mutating-admission-policies": clusterWide(
    "MutatingAdmissionPolicy",
    "Changes that the API server itself applies to objects as they are admitted, written in CEL, without a webhook.",
  ),
  "sidebar-item-mutating-admission-policy-bindings": clusterWide(
    "MutatingAdmissionPolicyBinding",
    "Applies a MutatingAdmissionPolicy to the resources and namespaces it selects, with its parameters.",
  ),
  "sidebar-item-flow-schemas": clusterWide(
    "FlowSchema",
    "Sorts requests to the API server into priority levels, so that one client cannot starve the others.",
  ),
  "sidebar-item-priority-level-configurations": clusterWide(
    "PriorityLevelConfiguration",
    "How much of the API server's capacity a priority level gets, and how its excess requests queue.",
  ),
  "sidebar-item-api-services": clusterWide(
    "APIService",
    "A group and version of the Kubernetes API, served by the API server itself or by an extension server behind it.",
  ),
  "sidebar-item-storage-version-migrations": clusterWide(
    "StorageVersionMigration",
    "Rewrites the stored objects of a resource in its current storage version, for example after an API version changes.",
  ),

  // Network
  "sidebar-item-services": namespaced(
    "Service",
    "A stable address and name for a set of Pods chosen by labels, which spreads traffic among them as they come and go.",
  ),
  "sidebar-item-endpoints": namespaced(
    "Endpoints",
    "The addresses of the Pods behind a Service, kept up to date by Kubernetes. Replaced by EndpointSlices.",
  ),
  "sidebar-item-endpoint-slices": namespaced(
    "EndpointSlice",
    "A part of the list of addresses behind a Service, which scales to large Services better than Endpoints.",
  ),
  "sidebar-item-ingresses": namespaced(
    "Ingress",
    "Rules that route HTTP and HTTPS from outside the cluster to Services, by host name and path, through an ingress controller.",
  ),
  "sidebar-item-ingress-classes": clusterWide(
    "IngressClass",
    "Names an ingress controller, so that each Ingress says which controller handles it.",
  ),
  "sidebar-item-network-policies": namespaced(
    "NetworkPolicy",
    "Which traffic may reach or leave the Pods it selects. The cluster's network plugin enforces it.",
  ),
  "sidebar-item-ip-addresses": clusterWide(
    "IPAddress",
    "An IP address allocated to a Service, which keeps two Services from getting the same one.",
  ),
  "sidebar-item-service-cidrs": clusterWide(
    "ServiceCIDR",
    "A range of IP addresses that Services' cluster IPs are allocated from.",
  ),

  // Storage
  "sidebar-item-persistent-volume-claims": namespaced(
    "PersistentVolumeClaim",
    "A request for storage of a size and access mode, which a Pod mounts. It binds to a PersistentVolume, made on demand by a StorageClass.",
  ),
  "sidebar-item-persistent-volumes": clusterWide(
    "PersistentVolume",
    "A piece of storage in the cluster, such as a disk or a network share, which a claim binds to.",
  ),
  "sidebar-item-storage-classes": clusterWide(
    "StorageClass",
    "A kind of storage the cluster offers, with the provisioner that creates volumes of it on demand.",
  ),
  "sidebar-item-volume-attachments": clusterWide(
    "VolumeAttachment",
    "Records that a volume is attached, or should be, to a node, for CSI drivers that attach volumes.",
  ),
  "sidebar-item-volume-attributes-classes": clusterWide(
    "VolumeAttributesClass",
    "Settings of a volume that can change while it is in use, such as its IOPS or throughput.",
  ),
  "sidebar-item-csi-drivers": clusterWide(
    "CSIDriver",
    "A storage driver installed in the cluster through the Container Storage Interface, and how Kubernetes should use it.",
  ),
  "sidebar-item-csi-nodes": clusterWide(
    "CSINode",
    "The storage drivers installed on a node, with how many volumes each can attach there.",
  ),
  "sidebar-item-csi-storage-capacities": namespaced(
    "CSIStorageCapacity",
    "How much storage of a StorageClass is left in a part of the cluster, which the scheduler uses to place Pods.",
  ),

  // Devices
  "sidebar-item-device-classes": clusterWide(
    "DeviceClass",
    "A category of devices, such as a model of GPU, that claims can ask for, with its configuration.",
  ),
  "sidebar-item-resource-claims": namespaced(
    "ResourceClaim",
    "A request for devices, such as a GPU, that a Pod uses. The scheduler allocates matching devices to it.",
  ),
  "sidebar-item-resource-claim-templates": namespaced(
    "ResourceClaimTemplate",
    "A template from which each Pod gets a ResourceClaim of its own.",
  ),
  "sidebar-item-resource-slices": clusterWide(
    "ResourceSlice",
    "The devices a driver offers on a node or in a pool, published for the scheduler.",
  ),
  "sidebar-item-device-taint-rules": clusterWide(
    "DeviceTaintRule",
    "Marks devices as tainted, so that Pods without a matching toleration do not use them.",
  ),

  // Access control
  "sidebar-item-service-accounts": namespaced(
    "ServiceAccount",
    "An identity for the processes in Pods, used to reach the API server. Roles are bound to it.",
  ),
  "sidebar-item-roles": namespaced(
    "Role",
    "A set of permissions, the verbs allowed on resources, within one namespace.",
  ),
  "sidebar-item-role-bindings": namespaced(
    "RoleBinding",
    "Grants a Role, or a ClusterRole, to users, groups or service accounts within one namespace.",
  ),
  "sidebar-item-cluster-roles": clusterWide(
    "ClusterRole",
    "A set of permissions that applies to the whole cluster, or that RoleBindings reuse in a namespace.",
  ),
  "sidebar-item-cluster-role-bindings": clusterWide(
    "ClusterRoleBinding",
    "Grants a ClusterRole to users, groups or service accounts across the whole cluster.",
  ),
  "sidebar-item-pod-security-policies": clusterWide(
    "PodSecurityPolicy",
    "Rules on what Pods may do, such as run privileged. Removed in Kubernetes 1.25 in favour of Pod Security admission.",
  ),
  "sidebar-item-certificate-signing-requests": clusterWide(
    "CertificateSigningRequest",
    "A request for a signed certificate, such as a user's or a kubelet's, which is approved and then signed.",
  ),
  "sidebar-item-cluster-trust-bundles": clusterWide(
    "ClusterTrustBundle",
    "A bundle of certificate authorities that Pods can trust, published for the whole cluster.",
  ),
  "sidebar-item-pod-certificate-requests": namespaced(
    "PodCertificateRequest",
    "A request, made for a Pod, for a certificate that identifies it, signed by a signer the cluster trusts.",
  ),

  // Custom resources
  "sidebar-item-custom-resource-definitions": clusterWide(
    "CustomResourceDefinition",
    "Adds a new kind to the Kubernetes API, with its schema, so that its objects can be stored and listed like built-in ones.",
  ),
};
