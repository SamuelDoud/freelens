/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { usesRemoteHost } from "../common/preferences";

import type { AiChatPreferences } from "../common/preferences";
import type { AiCliHost } from "./cli-host";

/**
 * Where the CLIs run, as the preferences say at each call. A remote host is kept while its
 * settings stay the same; another host, or going back to this computer, closes its connection.
 */
export function createCliHostSelector(dependencies: {
  preferences: () => AiChatPreferences;
  local: AiCliHost;
  createRemote: (remoteHost: AiChatPreferences["remoteHost"]) => AiCliHost;
}) {
  let remote: { key: string; host: AiCliHost } | undefined;

  return (): AiCliHost => {
    const preferences = dependencies.preferences();

    if (!usesRemoteHost(preferences)) {
      // The shared connection would otherwise stay open until its idle timeout.
      remote?.host.close();
      remote = undefined;

      return dependencies.local;
    }

    const key = JSON.stringify(preferences.remoteHost);

    if (remote?.key !== key) {
      remote?.host.close();
      remote = { key, host: dependencies.createRemote(preferences.remoteHost) };
    }

    return remote.host;
  };
}
