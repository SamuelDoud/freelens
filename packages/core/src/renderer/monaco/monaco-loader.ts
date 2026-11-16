/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// Monaco is large, and most sessions never open an editor, so the renderer
// loads it the first time something needs it. There is exactly one instance:
// every caller, including the extension API's `MonacoEditor` singleton, gets
// the namespace this module resolved.

export type MonacoModule = typeof import("monaco-editor");

type MonacoLoadedHook = (monaco: MonacoModule) => void;

let loadedMonaco: MonacoModule | undefined;
let pendingMonaco: Promise<MonacoModule> | undefined;
const loadedHooks: MonacoLoadedHook[] = [];

/** The Monaco namespace if it has been loaded, otherwise `undefined`. */
export const getLoadedMonaco = (): MonacoModule | undefined => loadedMonaco;

/**
 * Runs `hook` once Monaco is available, before any `loadMonaco()` caller
 * resumes: now when it is already loaded, otherwise right after it loads. Used
 * for global setup such as custom themes, which an editor needs defined before
 * it is created.
 */
export const onMonacoLoaded = (hook: MonacoLoadedHook): void => {
  if (loadedMonaco) {
    hook(loadedMonaco);
  } else {
    loadedHooks.push(hook);
  }
};

/** Loads Monaco on first call; later calls share the same promise. */
export const loadMonaco = (): Promise<MonacoModule> => {
  pendingMonaco ??= import("./monaco-chunk").then(({ monaco }) => {
    loadedMonaco = monaco;

    for (const hook of loadedHooks.splice(0)) {
      hook(monaco);
    }

    return monaco;
  });

  // A failed load (for example a chunk that could not be fetched) must not
  // poison later attempts.
  pendingMonaco.catch(() => {
    pendingMonaco = undefined;
  });

  return pendingMonaco;
};
