/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Pod } from "@freelensapp/kube-object";
import { withInjectables } from "@ogre-tools/injectable-react";
import os from "os";
import React from "react";
import { v4 as uuidv4 } from "uuid";
import { App } from "../../../extensions/common-api";
import userPreferencesStateInjectable from "../../../features/user-preferences/common/state.injectable";
import createTerminalTabInjectable from "../dock/terminal/create-terminal-tab.injectable";
import openExternalTerminalInjectable from "../dock/terminal/open-external-terminal.injectable";
import sendCommandInjectable, { type SendCommand } from "../dock/terminal/send-command.injectable";
import hideDetailsInjectable, { type HideDetails } from "../kube-detail-params/hide-details.injectable";
import PodMenuItem from "./pod-menu-item";

import type { Container, EphemeralContainer } from "@freelensapp/kube-object";

import type { UserPreferencesState } from "../../../features/user-preferences/common/state.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { OpenExternalTerminal } from "../dock/terminal/open-external-terminal.injectable";

export interface PodShellMenuProps {
  object: any;
  toolbar: boolean;
}

interface Dependencies {
  createTerminalTab: (tabParams: DockTabCreateSpecific) => void;
  openExternalTerminal: OpenExternalTerminal;
  sendCommand: SendCommand;
  hideDetails: HideDetails;
  state: UserPreferencesState;
}

const NonInjectablePodShellMenu: React.FC<PodShellMenuProps & Dependencies> = (props) => {
  const { object, toolbar, createTerminalTab, openExternalTerminal, sendCommand, hideDetails, state } = props;

  if (!object) return null;
  let pod: Pod;

  try {
    pod = new Pod(object);
  } catch (ex) {
    console.log(ex);

    return null;
  }

  const containers = pod.getRunningContainersWithType();
  const statuses = pod.getContainerStatuses();

  const execShell = async (container: Container | EphemeralContainer) => {
    const containerName = container.name;
    const kubectlPath = App.Preferences.getKubectlPath() || "kubectl";
    const commandParts = [kubectlPath, "exec", "-i", "-t", "-n", pod.getNs(), pod.getName()];

    if (containerName) {
      commandParts.push("-c", containerName);
    }

    commandParts.push("--");

    if (pod.getSelectedNodeOs() === "windows") {
      commandParts.push("powershell");
    } else {
      commandParts.push('sh -c "clear; (bash || ash || sh)"');
    }

    if (state.useExternalTerminal) {
      openExternalTerminal(commandParts.join(" "));
      hideDetails();
      return;
    }

    if (os.platform() !== "win32") {
      commandParts.unshift("exec");
    }

    const shellId = uuidv4();

    createTerminalTab({
      title: `Pod: ${pod.getName()} (namespace: ${pod.getNs()})`,
      id: shellId,
    });

    sendCommand(commandParts.join(" "), {
      enter: true,
      tabId: shellId,
    }).then(hideDetails);
  };

  return (
    <PodMenuItem
      svg="ssh"
      title="Shell"
      tooltip="Pod Shell"
      toolbar={toolbar}
      containers={containers}
      statuses={statuses}
      onMenuItemClick={execShell}
    />
  );
};

export const PodShellMenu = withInjectables<Dependencies, PodShellMenuProps>(NonInjectablePodShellMenu, {
  getProps: (di, props) => ({
    ...props,
    createTerminalTab: di.inject(createTerminalTabInjectable),
    openExternalTerminal: di.inject(openExternalTerminalInjectable),
    sendCommand: di.inject(sendCommandInjectable),
    hideDetails: di.inject(hideDetailsInjectable),
    state: di.inject(userPreferencesStateInjectable),
  }),
});
