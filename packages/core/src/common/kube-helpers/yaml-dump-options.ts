/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { DumpOptions } from "js-yaml";

// Apart from `kube-helpers.ts` so that renderer code can use the options
// without bundling the Kubernetes client that module imports.
export const defaultYamlDumpOptions: DumpOptions = {
  seqNoIndent: true,
  noRefs: true,
  quoteStyle: "double",
  sortKeys: true,
};
