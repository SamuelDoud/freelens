/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";

import type { AuthorizationV1Api, V1ResourceRule } from "@kubernetes/client-node";

import type { KubeApiResource } from "../rbac";

export type CanListResource = (resource: KubeApiResource) => boolean;

/**
 * Requests the permissions for actions on the kube cluster
 * @param namespace The namespace of the resources
 */
export type RequestNamespaceListPermissions = (namespace: string) => Promise<CanListResource>;

export type CreateRequestNamespaceListPermissions = (api: AuthorizationV1Api) => RequestNamespaceListPermissions;

/**
 * Builds the predicate for the resource rules of one namespace. The rules are
 * indexed on the first call, not on creation, so that malformed rules fail
 * when the predicate is used, as they always did.
 */
export const createCanListResource = (resourceRules: V1ResourceRule[]): CanListResource => {
  // The index reads every rule's verbs up front, where the scan below read them only for
  // rules matching the resource. Rules without a verbs array fail differently between the
  // two, so they keep the scan.
  if (!resourceRules.every(({ verbs }) => Array.isArray(verbs))) {
    return (resource) =>
      resourceRules
        .filter(({ apiGroups = ["*"] }) => apiGroups.includes("*") || apiGroups.includes(resource.group))
        .filter(({ resources = ["*"] }) => resources.includes("*") || resources.includes(resource.apiName))
        .some(({ verbs }) => verbs.includes("*") || verbs.includes("list"));
  }

  let listRules: { anyGroup: boolean; groups: Set<string>; anyResource: boolean; resources: Set<string> }[] | undefined;

  return (resource) => {
    if (!listRules) {
      listRules = [];

      for (const { apiGroups = ["*"], resources = ["*"], verbs } of resourceRules) {
        if (verbs.includes("*") || verbs.includes("list")) {
          listRules.push({
            anyGroup: apiGroups.includes("*"),
            groups: new Set(apiGroups),
            anyResource: resources.includes("*"),
            resources: new Set(resources),
          });
        }
      }
    }

    for (const rule of listRules) {
      if (
        (rule.anyGroup || rule.groups.has(resource.group)) &&
        (rule.anyResource || rule.resources.has(resource.apiName))
      ) {
        return true;
      }
    }

    return false;
  };
};

const createRequestNamespaceListPermissionsInjectable = getInjectable({
  id: "create-request-namespace-list-permissions",
  instantiate: (di): CreateRequestNamespaceListPermissions => {
    const logger = di.inject(loggerInjectionToken);

    return (api) => async (namespace) => {
      try {
        const { status } = await api.createSelfSubjectRulesReview({
          body: {
            apiVersion: "authorization.k8s.io/v1",
            kind: "SelfSubjectRulesReview",
            spec: { namespace },
          },
        });

        if (!status || status.incomplete) {
          logger.warn(
            `[AUTHORIZATION-NAMESPACE-REVIEW]: allowing all resources in namespace="${namespace}" due to incomplete SelfSubjectRulesReview: ${status?.evaluationError}`,
          );

          return () => true;
        }

        const { resourceRules } = status;

        return createCanListResource(resourceRules);
      } catch (error) {
        logger.error(`[AUTHORIZATION-NAMESPACE-REVIEW]: failed to create subject rules review`, { namespace, error });

        return () => true;
      }
    };
  },
});

export default createRequestNamespaceListPermissionsInjectable;
