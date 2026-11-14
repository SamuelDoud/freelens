/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * The directory the agents run in, so that no project's instructions reach them, and a kubeconfig
 * without clusters, so that nothing they run reaches a cluster except through Freelens.
 */
export function aiWorkDir() {
  const workDir = path.join(tmpdir(), "freelens-ai-chat");
  const emptyKubeconfig = path.join(workDir, "no-cluster.kubeconfig");

  mkdirSync(workDir, { recursive: true, mode: 0o700 });
  writeFileSync(emptyKubeconfig, "", { mode: 0o600 });

  return { workDir, emptyKubeconfig };
}
