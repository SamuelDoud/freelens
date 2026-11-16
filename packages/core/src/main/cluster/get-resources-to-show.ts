/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { formatKubeApiResource } from "../../common/rbac";

import type { RequestNamespaceListPermissions } from "../../common/cluster/create-request-namespace-list-permissions.injectable";
import type { KubeApiResource } from "../../common/rbac";

export const namespaceReviewConcurrency = 16;

/**
 * The known resources that at least one of the namespaces lets the user list.
 *
 * The answer is a union over the namespaces, so it cannot change once every
 * resource is covered. An admin's first review covers everything, which spares
 * one request per namespace. Workers pull namespaces off a shared queue, so
 * the number of reviews in flight stays bounded however many namespaces there
 * are.
 */
export const getResourcesToShow = async (
  allowedNamespaces: string[],
  knownResources: KubeApiResource[],
  req: RequestNamespaceListPermissions,
) => {
  if (!allowedNamespaces.length) {
    return [];
  }

  const covered = new Array<boolean>(knownResources.length).fill(false);
  let uncovered = knownResources.length;
  let nextNamespace = 0;

  const review = async () => {
    const canList = await req(allowedNamespaces[nextNamespace++]);

    for (let i = 0; i < knownResources.length; i += 1) {
      if (!covered[i] && canList(knownResources[i])) {
        covered[i] = true;
        uncovered -= 1;
      }
    }
  };
  const worker = async () => {
    while (uncovered > 0 && nextNamespace < allowedNamespaces.length) {
      await review();
    }
  };

  // The first review runs alone: when it covers everything, nothing else is asked.
  if (uncovered > 0) {
    await review();
  }

  await Promise.all(Array.from({ length: Math.min(namespaceReviewConcurrency, allowedNamespaces.length) }, worker));

  return knownResources.filter((_, i) => covered[i]).map(formatKubeApiResource);
};
