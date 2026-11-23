/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/** The path under which the local proxy serves a cluster's rows service. */
export const apiRowsPrefix = "/api-rows";

/**
 * The status the proxy answers with when the rows service cannot serve this
 * cluster for the rest of the session: the option is off, the binary is missing,
 * or the user may not list pods in every namespace. The lists then use full
 * objects instead.
 */
export const rowsServiceUnavailableStatus = 501;
