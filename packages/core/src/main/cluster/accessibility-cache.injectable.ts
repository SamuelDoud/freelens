/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import directoryForUserDataInjectable from "../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import readJsonFileInjectable from "../../common/fs/read-json-file.injectable";
import writeJsonFileInjectable from "../../common/fs/write-json-file.injectable";
import joinPathsInjectable from "../../common/path/join-paths.injectable";

import type { Cluster } from "../../common/cluster/cluster";
import type { KubeApiResource } from "../../common/rbac";

/**
 * Bumped when the shape of the file changes: a file of another version is
 * ignored, and overwritten by the next refresh.
 */
export const accessibilityCacheVersion = 2;

/**
 * Who the answers were given to. Only names and the address of the API server,
 * never a credential: the cache has to be dropped when the kubeconfig points
 * the context at another user or server, and nothing else is needed for that.
 */
export interface AccessibilityIdentity {
  contextName: string;
  userName: string;
  server: string;
}

/**
 * What the connection learns about a cluster by asking it: which resources it
 * serves, what the user may do with them, and which namespaces they can see.
 */
export interface Accessibility {
  isAdmin: boolean;
  isGlobalWatchEnabled: boolean;
  isGlobalListEnabled: boolean;
  allowedNamespaces: string[];
  knownResources: KubeApiResource[];
  resourcesToShow: string[];
}

interface AccessibilityCacheFile {
  version: typeof accessibilityCacheVersion;
  identity: AccessibilityIdentity;
  savedAt: string;
  accessibility: Accessibility;
}

export interface AccessibilityCache {
  /** The last answers for this identity, or `undefined` when there are none that apply. Never rejects. */
  read(identity: AccessibilityIdentity): Promise<Accessibility | undefined>;
  /** Never rejects. */
  write(identity: AccessibilityIdentity, accessibility: Accessibility): Promise<void>;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isKubeApiResource = (value: unknown): value is KubeApiResource => {
  const resource = value as Partial<KubeApiResource> | null;

  return (
    typeof resource === "object" &&
    resource !== null &&
    typeof resource.kind === "string" &&
    typeof resource.group === "string" &&
    typeof resource.version === "string" &&
    typeof resource.apiName === "string" &&
    typeof resource.namespaced === "boolean"
  );
};

const isAccessibility = (value: unknown): value is Accessibility => {
  const accessibility = value as Partial<Accessibility> | null;

  return (
    typeof accessibility === "object" &&
    accessibility !== null &&
    typeof accessibility.isAdmin === "boolean" &&
    typeof accessibility.isGlobalWatchEnabled === "boolean" &&
    typeof accessibility.isGlobalListEnabled === "boolean" &&
    isStringArray(accessibility.allowedNamespaces) &&
    Array.isArray(accessibility.knownResources) &&
    accessibility.knownResources.every(isKubeApiResource) &&
    isStringArray(accessibility.resourcesToShow)
  );
};

const sameIdentity = (a: AccessibilityIdentity, b: Partial<AccessibilityIdentity> | undefined) =>
  a.contextName === b?.contextName && a.userName === b?.userName && a.server === b?.server;

const accessibilityCacheInjectable = getInjectable({
  id: "accessibility-cache",
  instantiate: (di, cluster): AccessibilityCache => {
    const logger = di.inject(loggerInjectionToken);
    const readJsonFile = di.inject(readJsonFileInjectable);
    const writeJsonFile = di.inject(writeJsonFileInjectable);
    const joinPaths = di.inject(joinPathsInjectable);
    const directoryForUserData = di.inject(directoryForUserDataInjectable);
    // The id of a cluster is the id of its catalog entry: keep it to a file name
    const filePath = joinPaths(
      directoryForUserData,
      "cluster-accessibility",
      `${cluster.id.replace(/[^A-Za-z0-9_-]/g, "_")}.json`,
    );

    return {
      read: async (identity) => {
        try {
          const file = (await readJsonFile(filePath)) as Partial<AccessibilityCacheFile> | null;

          if (
            file?.version !== accessibilityCacheVersion ||
            !sameIdentity(identity, file.identity) ||
            !isAccessibility(file.accessibility)
          ) {
            return undefined;
          }

          return file.accessibility;
        } catch {
          // Absent, unreadable or torn: there is nothing to start from
          return undefined;
        }
      },
      write: async (identity, accessibility) => {
        try {
          const file: AccessibilityCacheFile = {
            version: accessibilityCacheVersion,
            identity,
            savedAt: new Date().toISOString(),
            accessibility,
          };

          await writeJsonFile(filePath, file);
        } catch (error) {
          logger.warn(`[CLUSTER]: failed to cache the accessibility of "${cluster.contextName.get()}"`, error);
        }
      },
    };
  },
  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (di, cluster: Cluster) => cluster.id,
  }),
});

export default accessibilityCacheInjectable;
