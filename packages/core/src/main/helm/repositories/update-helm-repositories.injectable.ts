/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import execHelmInjectable from "../exec-helm/exec-helm.injectable";

import type { ExecHelm } from "../exec-helm/exec-helm.injectable";

/**
 * How long a successful `helm repo update` is reused. It spans the requests a
 * single click makes (versions, readme, values), and no more.
 */
const updateHelmRepositoriesReuseMs = 10_000;

export interface UpdateHelmRepositories {
  /** Runs `helm repo update`, or joins the run in progress or the one that just succeeded. */
  (): ReturnType<ExecHelm>;
  /** Forgets the last run, for when the set of repositories changed. */
  invalidate(): void;
}

const updateHelmRepositoriesInjectable = getInjectable({
  id: "update-helm-repositories",

  instantiate: (di): UpdateHelmRepositories => {
    const execHelm = di.inject(execHelmInjectable);

    let current: { result: ReturnType<ExecHelm>; finishedAt?: number } | undefined;

    const update = (() => {
      if (
        current &&
        (current.finishedAt === undefined || Date.now() - current.finishedAt < updateHelmRepositoriesReuseMs)
      ) {
        return current.result;
      }

      const entry: NonNullable<typeof current> = { result: execHelm(["repo", "update"]) };

      current = entry;
      void entry.result.then((result) => {
        if (current !== entry) {
          return;
        }

        if (result.callWasSuccessful) {
          entry.finishedAt = Date.now();
        } else {
          current = undefined;
        }
      });

      return entry.result;
    }) as UpdateHelmRepositories;

    update.invalidate = () => {
      current = undefined;
    };

    return update;
  },
});

export default updateHelmRepositoriesInjectable;
