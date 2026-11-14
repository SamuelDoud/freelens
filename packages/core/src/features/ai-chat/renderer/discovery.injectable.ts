/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { requestFromChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { observable, runInAction } from "mobx";
import { getAiDiscoveryChannel, refreshAiDiscoveryChannel } from "../common/channels";
import { initialAiDiscovery } from "../common/discovery";

import type { AiDiscovery } from "../common/discovery";

/** What the CLIs on this computer offer, as the main process discovered it, in this frame. */
export class AiDiscoveryMirror {
  private readonly current = observable.box<AiDiscovery>(initialAiDiscovery, { deep: false });
  private loaded = false;

  constructor(
    private readonly dependencies: { get: () => Promise<AiDiscovery>; refresh: () => Promise<AiDiscovery> },
  ) {}

  /** The discovery, asked for on first use. */
  get(): AiDiscovery {
    if (!this.loaded) {
      this.loaded = true;
      void this.dependencies.get().then((discovery) => this.set(discovery));
    }

    return this.current.get();
  }

  set(discovery: AiDiscovery) {
    runInAction(() => this.current.set(discovery));
  }

  async refresh() {
    this.set(await this.dependencies.refresh());
  }
}

const aiDiscoveryMirrorInjectable = getInjectable({
  id: "ai-discovery-mirror",
  instantiate: (di) => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return new AiDiscoveryMirror({
      get: () => requestFromChannel(getAiDiscoveryChannel),
      refresh: () => requestFromChannel(refreshAiDiscoveryChannel),
    });
  },
});

export default aiDiscoveryMirrorInjectable;
