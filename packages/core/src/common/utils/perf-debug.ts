/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Gate for performance debug logging. Only true in development builds.
 * Webpack's DefinePlugin replaces process.env.NODE_ENV at compile time,
 * allowing dead-code elimination of guarded blocks in production.
 */
export const PERF_DEBUG = process.env.NODE_ENV === "development";
