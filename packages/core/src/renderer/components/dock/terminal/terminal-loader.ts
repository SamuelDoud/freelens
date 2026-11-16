/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";

// xterm and its addons are large and a session that opens no terminal never
// needs them, so the renderer loads them the first time a terminal is about to
// show. The terminal views wait for the load before they connect a terminal,
// and the extension loader waits for it before an extension's entry point
// runs, so `terminalStore.connect()` is synchronous wherever it is called.

type TerminalModule = typeof import("./terminal");

let loadedTerminal: TerminalModule | undefined;
let pendingTerminal: Promise<TerminalModule> | undefined;

/** The terminal module if it has been loaded, otherwise `undefined`. */
export const getLoadedTerminal = (): TerminalModule | undefined => loadedTerminal;

/** Loads xterm on first call; later calls share the same promise. */
export const loadTerminal = (): Promise<TerminalModule> => {
  pendingTerminal ??= import("./terminal").then((module) => {
    loadedTerminal = module;

    return module;
  });

  // A failed load must not poison later attempts.
  pendingTerminal.catch(() => {
    pendingTerminal = undefined;
  });

  return pendingTerminal;
};

/** Whether xterm is loaded, loading it when it is not. */
export const useTerminalLoaded = (): boolean => {
  const [loaded, setLoaded] = React.useState(() => loadedTerminal !== undefined);

  React.useEffect(() => {
    if (loaded) {
      return;
    }

    let cancelled = false;

    loadTerminal().then(
      () => {
        if (!cancelled) {
          setLoaded(true);
        }
      },
      () => {},
    );

    return () => {
      cancelled = true;
    };
  }, [loaded]);

  return loaded;
};
