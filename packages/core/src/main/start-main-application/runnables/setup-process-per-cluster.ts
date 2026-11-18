/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Every host a cluster's frame is served from (`<clusterId>.renderer.freelens.app`)
 * and the window's own (`renderer.freelens.app`). They are one site, so
 * Chromium keeps them in one renderer process unless told otherwise. The
 * wildcard isolates each subdomain in a process of its own, so a cluster added
 * while the application runs gets one too; it names no port, because the proxy
 * port is not known before the application is ready, and the pattern matches
 * on any.
 */
export const clusterOriginsPattern = "https://[*.]renderer.freelens.app";

/**
 * The value of the `isolate-origins` switch with the cluster origins added, or
 * the existing value untouched when it has them already. The switch is a
 * comma-separated list, and setting it a second time replaces the first value,
 * so what the user passed on the command line has to be carried along.
 */
export const withClusterOriginsIsolated = (existingIsolateOrigins: string): string => {
  const origins = existingIsolateOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.includes(clusterOriginsPattern) ? origins.join(",") : [...origins, clusterOriginsPattern].join(",");
};

/**
 * Whether the user's preferences ask for a process per cluster. The switch has
 * to be set before the application is ready, which is before the preference
 * store is loaded, so the stored file is read here directly. Anything missing
 * or unreadable means the default, on.
 */
export const readProcessPerClusterPreference = (readStore: () => unknown): boolean => {
  try {
    const store = readStore() as { preferences?: { processPerCluster?: unknown } } | undefined;

    return store?.preferences?.processPerCluster !== false;
  } catch {
    return true;
  }
};
