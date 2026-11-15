/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import execHelmEnvInjectable from "../exec-helm/exec-env.injectable";
import execHelmInjectable from "../exec-helm/exec-helm.injectable";
import helmBinaryPathInjectable from "../helm-binary-path.injectable";

import type { AsyncResult } from "@freelensapp/utilities";

export type HelmEnv = Record<string, string> & {
  HELM_REPOSITORY_CACHE?: string;
  HELM_REPOSITORY_CONFIG?: string;
};

const getHelmEnvInjectable = getInjectable({
  id: "get-helm-env",

  instantiate: (di) => {
    const execHelm = di.inject(execHelmInjectable);
    const execHelmEnv = di.inject(execHelmEnvInjectable);
    const helmBinaryPath = di.inject(helmBinaryPathInjectable);

    // `helm env` prints a function of the binary and of the environment it
    // runs in, so a success stays valid for as long as both are the same.
    // Failures are not kept.
    let memo: { key: string; result: Promise<Awaited<AsyncResult<HelmEnv>>> } | undefined;

    const getHelmEnv = async (): AsyncResult<HelmEnv> => {
      const result = await execHelm(["env"]);

      if (!result.callWasSuccessful) {
        return { callWasSuccessful: false, error: result.error.stderr };
      }

      const lines = result.response.split(/\r?\n/); // split by new line feed
      const env: HelmEnv = {};

      lines.forEach((line: string) => {
        const [key, value] = line.split("=");

        if (key && value) {
          env[key] = value.replace(/"/g, ""); // strip quotas
        }
      });

      return { callWasSuccessful: true, response: env };
    };

    return async (): AsyncResult<HelmEnv> => {
      const key = `${helmBinaryPath}\0${JSON.stringify(execHelmEnv.get())}`;

      if (memo?.key !== key) {
        const entry = { key, result: getHelmEnv() };

        memo = entry;
        void entry.result.then((result) => {
          if (!result.callWasSuccessful && memo === entry) {
            memo = undefined;
          }
        });
      }

      const { result } = memo;
      const outcome = await result;

      // The callers read the variables only, but each gets a copy of its own.
      return outcome.callWasSuccessful ? { callWasSuccessful: true, response: { ...outcome.response } } : outcome;
    };
  },
});

export default getHelmEnvInjectable;
