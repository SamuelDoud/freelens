/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import * as yaml from "js-yaml";
import * as lockFile from "proper-lockfile";
import readFileInjectable from "../../../common/fs/read-file.injectable";
import writeFileInjectable from "../../../common/fs/write-file.injectable";

import type { KubeConfigData } from "../../../common/kube-config";

export type SaveKubeconfig = (config: KubeConfigData, path: string) => Promise<void>;

type KubeconfigDocument = Record<string, unknown> & { contexts?: { name?: string }[] };

const readOriginal = async (
  readFile: (path: string) => Promise<string>,
  filePath: string,
  loadYaml: (yaml: string) => unknown,
): Promise<KubeconfigDocument | undefined> => {
  try {
    const document = loadYaml(await readFile(filePath));

    return document && typeof document === "object" && !Array.isArray(document)
      ? (document as KubeconfigDocument)
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * KubeConfig.exportConfig() writes only the fields it models, so it drops what
 * it does not know, such as the `extensions` of a cluster that an exec
 * credential plugin reads. Only the contexts and the current context change
 * when a cluster is deleted, so everything else stays as the file had it.
 */
const applyContexts = (original: KubeconfigDocument, config: KubeConfigData): KubeconfigDocument => {
  const remaining = new Set(config.contexts.map((context) => context.name));

  return {
    ...original,
    contexts: (original.contexts ?? []).filter((context) => context.name && remaining.has(context.name)),
    "current-context": config.currentContext,
  };
};

const saveKubeconfigInjectable = getInjectable({
  id: "save-kubeconfig",
  instantiate: (di): SaveKubeconfig => {
    const readFile = di.inject(readFileInjectable);
    const writeFile = di.inject(writeFileInjectable);

    return async (config, filePath) => {
      const release = await lockFile.lock(filePath);

      try {
        // js-yaml directly: `dumpYaml` and `loadYaml` of @kubernetes/client-node only pass their input on
        // to it, and importing them would bundle the API models of the client into the renderer.
        const original = await readOriginal(readFile, filePath, (text) => yaml.load(text));
        const contents = yaml.dump(original ? applyContexts(original, config) : JSON.parse(config.exportConfig()));

        await writeFile(filePath, contents);
      } finally {
        await release();
      }
    };
  },
  causesSideEffects: true,
});

export default saveKubeconfigInjectable;
