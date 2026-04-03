/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ipcRenderer } from "electron";
import hostedClusterIdInjectable from "../../../cluster-frame-context/hosted-cluster-id.injectable";

export type OpenExternalTerminal = (command?: string) => void;

const openExternalTerminalInjectable = getInjectable({
  id: "open-external-terminal",

  instantiate: (di): OpenExternalTerminal => {
    const clusterId = di.inject(hostedClusterIdInjectable);

    return (command?: string) => {
      ipcRenderer.invoke("cluster:open-external-terminal", clusterId, command);
    };
  },
});

export default openExternalTerminalInjectable;
