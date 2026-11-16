/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { onKeyboardShortcut } from "@freelensapp/utilities";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import { broadcastMessage } from "../../../common/ipc";
import isMacInjectable from "../../../common/vars/is-mac.injectable";
import hostedClusterIdInjectable from "../../cluster-frame-context/hosted-cluster-id.injectable";
import legacyOnChannelListenInjectable from "../../ipc/legacy-channel-listen.injectable";
import matchedClusterIdInjectable from "../../navigation/matched-cluster-id.injectable";
import windowAddEventListenerInjectable from "../../window/event-listener.injectable";
import { Dialog } from "../dialog";
import styles from "./command-container.module.scss";
import { CommandDialog } from "./command-dialog";
import commandOverlayInjectable from "./command-overlay.injectable";

import type { IComputedValue } from "mobx";

import type { ClusterId } from "../../../common/cluster-types";
import type { ipcRendererOn } from "../../../common/ipc";
import type { AddWindowEventListener } from "../../window/event-listener.injectable";
import type { CommandOverlay } from "./command-overlay.injectable";

interface Dependencies {
  addWindowEventListener: AddWindowEventListener;
  commandOverlay: CommandOverlay;
  clusterId: ClusterId | undefined;
  matchedClusterId: IComputedValue<ClusterId | undefined>;
  isMac: boolean;
  legacyOnChannelListen: typeof ipcRendererOn;
}

/**
 * What opens the palette: in a cluster frame, that frame's own; in the root frame, the one of the cluster the
 * page shows, which lives in that cluster's frame, or else the root frame's own.
 */
export const getOpenCommandPalette =
  ({
    clusterId,
    matchedClusterId,
    openHere,
    broadcast,
  }: {
    clusterId: ClusterId | undefined;
    matchedClusterId: IComputedValue<ClusterId | undefined>;
    openHere: () => void;
    broadcast: (channel: string) => void;
  }) =>
  () => {
    if (clusterId) {
      return openHere();
    }

    const matchedId = matchedClusterId.get();

    if (matchedId) {
      broadcast(`command-palette:${matchedId}:open`);
    } else {
      openHere();
    }
  };

@observer
class NonInjectedCommandContainer extends React.Component<Dependencies> {
  private readonly disposers: (() => void)[] = [];

  componentDidMount() {
    const { clusterId, addWindowEventListener, commandOverlay, matchedClusterId, isMac } = this.props;

    const action = getOpenCommandPalette({
      clusterId,
      matchedClusterId,
      openHere: () => commandOverlay.open(<CommandDialog />),
      broadcast: broadcastMessage,
    });
    const ipcChannel = clusterId ? `command-palette:${clusterId}:open` : "command-palette:open";

    this.disposers.push(
      this.props.legacyOnChannelListen(ipcChannel, action),
      addWindowEventListener("keydown", onKeyboardShortcut(isMac ? "Shift+Cmd+P" : "Shift+Ctrl+P", action)),
      addWindowEventListener("keydown", (event) => {
        if (event.code === "Escape") {
          event.stopPropagation();
          this.props.commandOverlay.close();
        }
      }),
    );
  }

  componentWillUnmount() {
    this.disposers.forEach((dispose) => dispose());
  }

  render() {
    const { commandOverlay } = this.props;

    return (
      <Dialog isOpen={commandOverlay.isOpen} animated={false} onClose={commandOverlay.close} modal={false}>
        <div className={styles.CommandContainer} data-testid="command-container">
          {commandOverlay.component}
        </div>
      </Dialog>
    );
  }
}

export const CommandContainer = withInjectables<Dependencies>(NonInjectedCommandContainer, {
  getProps: (di, props) => ({
    ...props,
    clusterId: di.inject(hostedClusterIdInjectable),
    addWindowEventListener: di.inject(windowAddEventListenerInjectable),
    commandOverlay: di.inject(commandOverlayInjectable),
    matchedClusterId: di.inject(matchedClusterIdInjectable),
    isMac: di.inject(isMacInjectable),
    legacyOnChannelListen: di.inject(legacyOnChannelListenInjectable),
  }),
});
